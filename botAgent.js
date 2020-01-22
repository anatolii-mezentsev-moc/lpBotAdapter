/* eslint-disable no-restricted-syntax */
const { Agent } = require('node-agent-sdk');
const log = require('./logger')(__filename);
const config = require('./config');

class BotAgent extends Agent {
  constructor(conf) {
    super(conf);
    this.resendAttempts = {};
    this.pingTimeoutId = null;
    this.reconnectionDelay = 0;
    this.accountId = conf.accountId;
    this.initialSkillId = conf.initialSkillId;
    this.nextSkillId = conf.nextSkillId;
    this.timeoutIds = new Set();
    this.publishEventPromise = (event, metadata) =>
      new Promise(resolve => this.publishEvent(event, null, metadata, resolve));
    this.updateConversationFieldPromise = (payload, metadata) =>
      new Promise(resolve => this.updateConversationField(payload, null, metadata, resolve));
    this.updateRingStatePromise = payload =>
      new Promise(resolve => this.updateRingState(payload, resolve));
    this.subscribeMessagingEventsPromise = payload =>
      new Promise(resolve => this.subscribeMessagingEvents(payload, resolve));
    this.init();
  }

  init() {
    this.openConvs = {};
    this.on('connected', () => this.handleConnected());
    this.on('error', err => this.handleSocketError(err));
    this.on('closed', data => this.handleSocketError(data, true));
//    this.on('routing.RoutingTaskNotification', data => this.handleRoutingTaskNotification(data));
//    this.on('cqm.ExConversationChangeNotification', data =>
//      this.handleExConversationChangeNotification(data),
//    );
//    this.on('ms.MessagingEventNotification', data => this.handleMessagingEventNotification(data));
  }

  handleConnected() {
    this.subscribeRoutingTasks({}, (e, resp) =>
      log.debug(resp, 'Subscribed routing tasks for agent'),
    );
    this.subscribeExConversations({ convState: ['OPEN'] }, () =>
      log.info('Subscribed successfully'),
    );
    this.setAgentState({ availability: 'ONLINE' });
    log.info({ username: this.username }, 'Connected');
    this.isReconnecting = false;
    if (this.reconnectionDelay !== 0) {
      this.resetReconnectionTimeoutId = setTimeout(() => {
        this.reconnectionDelay = 0;
      }, config.SOCKET_RECONNECT_INTERVAL_RESET_DELAY);
    }
    this.getClockErrorCount = 0;
    const ping = async () => {
      try {
        if (this.transport && this.transport.ws) {
          this.transport.ws.ping();
        }
        this.getClock({}, err => {
          if (err) {
            this.getClockErrorCount += 1;
            if (this.getClockErrorCount > 2) {
              log.error('Error on getClock!');
              this.handleSocketError(new Error(`getClock error: ${err}`));
            }
          } else {
            this.getClockErrorCount = 0;
          }
        });
        this.pingTimeoutId = setTimeout(ping, config.SOCKET_PING_INTERVAL);
      } catch (err) {
        log.error('Error on pinging socket!');
        this.handleSocketError(err);
      }
    };
    this.pingTimeoutId = setTimeout(ping, config.SOCKET_PING_INTERVAL);
  }

  handleSocketError(err, isClosed) {
    clearTimeout(this.resetReconnectionTimeoutId);
    if (this.isReconnecting && isClosed) {
      log.error({ error: err }, 'Reconnection in progress. Ignoring error.');
      return;
    }
    clearTimeout(this.pingTimeoutId);
    log.error({ error: err }, isClosed ? 'Socket closed' : 'Socket error');
    log.error({ delay: this.reconnectionDelay }, 'Reconnection retry');
    this.isReconnecting = true;
    const isUnauthError = /unauthorized|401/i.test(err.message);
    this.reconnectionTimeoutId = setTimeout(() => {
      // Regenegate token if there was an unauth error or bot failed to login first time
      this.reconnect(!isUnauthError && this.transport);
      if (this.reconnectionDelay < config.SOCKET_RECONNECT_MAX_INTERVAL) {
        this.reconnectionDelay += config.SOCKET_RECONNECT_STEP_INTERVAL;
      } else {
        this.reconnectionDelay = config.SOCKET_RECONNECT_MAX_INTERVAL;
      }
    }, this.reconnectionDelay);
  }

  handleExConversationChangeNotification({ changes }) {
    for (const c of changes) {
      if (c.type === 'DELETE' && c.result && c.result.convId) {
        this.forgetConversation(c.result.convId);
        break;
      }
      if (
        c.type !== 'UPSERT' ||
        !c.result ||
        this.openConvs[c.result.convId] ||
        !c.result.conversationDetails.participants.some(({ id }) => id === this.agentId) ||
        !c.result.lastContentEventNotification
      ) {
        break;
      }
      this.openConvs[c.result.convId] = new Set();
      const fromSeq = c.result.lastContentEventNotification.sequence - 5;
      this.subscribeMessagingEventsPromise({
        fromSeq: fromSeq > 0 ? fromSeq : 0,
        dialogId: c.result.convId,
      }).then(e => {
        if (e) {
          log.error(
            { error: e, convId: c.result.convId },
            'Subscribing for messaging events failed',
          );
          this.forgetConversation(c.result.convId);
          return;
        }
        log.info({ convId: c.result.convId }, 'Subscribed for messaging events');
      });
    }
  }

  handleRoutingTaskNotification({ changes }) {
    for (const c of changes) {
      if (c.type !== 'UPSERT' || c.result.skillId !== this.initialSkillId) {
        break;
      }
      for (const r of c.result.ringsDetails) {
        if (r.ringState !== 'WAITING') {
          break;
        }
        this.updateRingStatePromise({
          ringId: r.ringId,
          ringState: 'ACCEPTED',
        }).then(e => {
          if (e) {
            log.error({ error: e, ringId: r.ringId }, 'Updating ring state to ACCEPTED failed');
            return;
          }
          log.info({ convId: c.result.conversationId }, 'Conversation accepted');
        });
      }
    }
  }

  async handleMessagingEventNotification({ changes }) {
    changes.forEach(async c => {
      if (
        !this.openConvs[c.conversationId] ||
        !c.event ||
        c.event.type !== 'ContentEvent' ||
        !c.event.message ||
        c.originatorId === this.agentId ||
        typeof c.event.message !== 'string'
      ) {
        return;
      }
      if (c.event.message.toLowerCase() === config.LP_TRANSFER_INPUT) {
        setTimeout(async () => {
          try {
            await this.transferConvToSkill({
              timestamp: Date.now(),
              convId: c.conversationId,
              newSkillId: this.nextSkillId,
            });
            this.forgetConversation(c.conversationId);
          } catch (err) {
            log.error({ error: err, convId: c.conversationId }, 'Error transferring conversation');
          }
        }, config.MESSAGE_DELAY);
        return;
      }
      try {
        const message =
          c.event.message.toLowerCase() === config.LP_PING_INPUT
            ? 'pong'
            : `You've entered: ${c.event.message}`;
        const err = await this.sendMessage({
          timestamp: Date.now(),
          convId: c.conversationId,
          payload: {
            type: 'ContentEvent',
            contentType: 'text/plain',
            message,
          },
        });
        if (!err) {
          log.debug({ convId: c.conversationId, text: message }, 'Message was sent');
          return;
        }
      } catch (err) {
        log.error({ error: err, convId: c.conversationId }, 'Error on sending message');
      }
    });
  }

  forgetConversation(convId) {
    if (this.openConvs[convId]) {
      for (const id of this.openConvs[convId]) {
        clearTimeout(id);
      }
      this.openConvs[convId].clear();
      log.info({ convId }, `Conversation has been cleared from the memory`);
    }
    delete this.openConvs[convId];
  }

  async transferConvToSkill({ timestamp, convId, newSkillId }) {
    log.debug({ convId, newSkillId }, 'Transferring conversation...');
    const payload = {
      conversationId: convId,
      conversationField: [
        {
          field: 'ParticipantsChange',
          type: 'REMOVE',
          userId: '',
          role: 'ASSIGNED_AGENT',
        },
        {
          field: 'Skill',
          type: 'UPDATE',
          skill: newSkillId.toString(),
        },
      ],
    };
    const type = 'skill escalation';
    const resendKey = `${timestamp}_${convId}`;
    try {
      const err = await this.updateConversationFieldPromise(payload);
      if (!err) {
        delete this.resendAttempts[resendKey];
        return;
      }
      log.error({ error: err, convId }, 'Error on transferring conversation');
    } catch (err) {
      log.error({ error: err, convId }, 'Error on transferring conversation');
    }
    await this.handleResend({
      func: async () => {
        await this.transferConvToSkill({ timestamp, convId, newSkillId });
      },
      convId,
      resendKey,
      type,
    });
  }

  async sendMessage({ timestamp, convId, payload, metadata }) {
    const event = {
      dialogId: convId,
      event: payload,
    };
    const resendKey = `${timestamp}_${convId}`;
    try {
      const err = await this.publishEventPromise(event, metadata);
      if (!err) {
        delete this.resendAttempts[resendKey];
        return;
      }
      log.error({ error: err, convId }, 'Error on sending message');
    } catch (err) {
      log.error({ error: err, convId }, 'Error on sending message');
    }
    await this.handleResend({
      func: async () => {
        await this.sendMessage({ timestamp, convId, payload, metadata });
      },
      convId,
      resendKey,
      type: payload.type,
    });
  }

  async handleResend({ func, convId, key, type = 'SDK request' }) {
    return new Promise(resolve => {
      if (typeof func !== 'function') {
        throw log.error(
          { convId },
          `Resending function param is not correct function. Resending can't be performed.`,
        );
      }
      if (!this.resendAttempts[key]) {
        this.resendAttempts[key] = 0;
      }
      const attempt = this.resendAttempts[key] + 1;
      if (this.resendAttempts[key] < config.LP_API_RESEND_RETRIES) {
        const delay = config.LP_API_RESEND_DELAY * attempt;
        log.info({ convId, delay, attempt }, `Trying to resend ${type}...`);
        const timeoutId = setTimeout(async () => {
          this.timeoutIds.delete(timeoutId);
          this.openConvs[convId].delete(timeoutId);
          this.resendAttempts[key] += 1;
          resolve(await func());
        }, delay);
        this.timeoutIds.add(timeoutId);
        this.openConvs[convId].add(timeoutId);
      } else {
        log.info(
          { convId },
          `Resending attempts (${attempt}) exceeded. Sending ${type} failed and will not be retried.`,
        );
        delete this.resendAttempts[key];
        resolve();
      }
    });
  }
}

module.exports = BotAgent;
