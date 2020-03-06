"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_agent_sdk_1 = require("node-agent-sdk");
const botbuilder_1 = require("botbuilder");
const contenttranslator_1 = require("./contenttranslator");
const livepersonagentlistener_1 = require("./livepersonagentlistener");
const helpers_1 = require("./helpers");
/**
 * LivePerson bot adapter.
 *
 * This is the proxy between the LivePerson system and the bot logic.
 *
 * See https://github.com/LivePersonInc/node-agent-sdk for LivePerson Agent SDK documentation/code.
 */
class LivePersonBotAdapter extends botbuilder_1.BotAdapter {
    /**
     * Constructor.
     *
     * @param livePersonConfiguration The LivePerson configuration including the credentials.
     */
    constructor(livePersonConfiguration) {
        super();
        this.livePersonAgent = null;
        this.contentTranslator = null;
        this.livePersonAgentListener = null;
        this._isConnected = false;
        try {
            this.livePersonAgent = new node_agent_sdk_1.Agent(livePersonConfiguration);
            this.initializeLivePersonAgent();
        }
        catch (error) {
            console.error(`Failed to create/initialize the LivePerson agent: ${error}`);
        }
        this.contentTranslator = new contenttranslator_1.ContentTranslator();
        this.livePersonAgentListener = new livepersonagentlistener_1.LivePersonAgentListener(this.contentTranslator);
    }
    /**
     * @returns True, if this bot is connected as a LivePerson agent. False otherwise.
     */
    isConnected() {
        return this._isConnected;
    }
    /**
     * @returns The LivePerson agent (event) listener.
     */
    getListener() {
        return this.livePersonAgentListener;
    }
    /**
     * From BotAdapter.
     * Sends the replies of the bot to the LivePerson system after the content translation.
     *
     * See https://github.com/Microsoft/botbuilder-js/blob/master/libraries/botbuilder/src/botFrameworkAdapter.ts#L500 for reference.
     *
     * @param context Context for the current turn of conversation with the user.
     * @param activities List of activities to send.
     */
    sendActivities(context, activities) {
        return new Promise((resolve, reject) => {
            if (!this.livePersonAgent) {
                reject("No LivePerson agent instance");
                return;
            }
            activities.forEach(activity => {
                let event = this.contentTranslator.activityToLivePersonEvent(activity);
                if (event.type == "RichContent") {
                    this.livePersonAgent.publishEvent({
                        dialogId: activity.conversation.id,
                        event: event
                    }, this.logErrorMessage, [{ type: "ExternalId", id: "MY_CARD_ID" }]);
                }
                else {
                    this.livePersonAgent.publishEvent({
                        dialogId: activity.conversation.id,
                        event: event
                    });
                }
            });
            resolve(true);
        });
    }
    /**
     * Transfers the conversation matching the given dialog ID to another agent.
     *
     * @param dialogId The LivePerson dialog ID.
     * @param targetSkillId The skill the new agent needs to have.
     */
    transferToAnotherAgent(dialogId, targetSkillId) {
        this.livePersonAgent.updateConversationField({
            conversationId: dialogId,
            conversationField: [
                {
                    field: "ParticipantsChange",
                    type: "REMOVE",
                    role: "ASSIGNED_AGENT"
                },
                {
                    field: "Skill",
                    type: "UPDATE",
                    skill: targetSkillId
                }
            ]
        }, (e, resp) => {
            if (e) {
                console.error(e);
            }
            console.log(resp);
        });
    }
    /**
     * Exposes the runMiddleware method, which is a protected method defined in BotAdapter.
     * Call this method explicitly to let the middleware layer to process the context.
     *
     * @param context
     * @param next
     */
    runMiddleware(context, next) {
        return super.runMiddleware(context, next);
    }
    /**
     * This method is not implemented for this (LivePerson) bot adapter.
     * Use runMiddleware() to execute the middleware stack.
     */
    processActivity(req, res, logic) {
        throw new Error("processActivity method is not implemented for LivePersonBotAdapter");
    }
    continueConversation(reference, logic) {
        throw new Error("Method not implemented.");
    }
    deleteActivity(context, reference) {
        throw new Error("Method not implemented.");
    }
    updateActivity(context, activity) {
        throw new Error("Method not implemented.");
    }
    /**
     * Initializes the LivePerson agent; subscribes to events and sets the agent status online.
     * The event handlers here will forward the selected events to bot logic using the
     * LivePersonAgentListener class.
     *
     * The content of thiss method is based the code, in LivePerson repository, licensed under MIT
     * (copyrighted by LivePerson):
     * - Code: https://github.com/LivePersonInc/node-agent-sdk/blob/master/examples/agent-bot/MyCoolAgent.js
     * - License: https://github.com/LivePersonInc/node-agent-sdk/blob/master/LICENSE
     */
    initializeLivePersonAgent() {
        this.reconnectInterval = 5;
        this.reconnectAttempts = 35;
        this.reconnectRatio = 1.25;
        if (!this.livePersonAgent) {
            console.error("No LivePerson agent to initialize");
            return;
        }
        let openConvs = {};
        this.livePersonAgent.on("connected", msg => {
            clearTimeout(this.livePersonAgent._retryConnection);
            this._isConnected = true;
            console.log("LivePerson agent connected:", this.livePersonAgent.conf.id || "", msg);
            this.livePersonAgent.setAgentState({ availability: "ONLINE" });
            this.livePersonAgent.subscribeExConversations({
                agentIds: [this.livePersonAgent.agentId],
                convState: ["OPEN"]
            }, (e, resp) => console.log("subscribeExConversations", this.livePersonAgent.conf.id || "", resp || e));
            this.livePersonAgent.subscribeRoutingTasks({});
            this.livePersonAgent._pingClock = setInterval(() => {
                this.livePersonAgent.getClock({}, (e, resp) => {
                    console.log("\x1b[36m", "ping", "\x1b[0m");
                    if (e) {
                        console.log('\x1b[31m', 'Error :: ', JSON.stringify(e), '\x1b[0m');
                        clearTimeout(this.livePersonAgent._retryConnection);
                        this.livePersonAgent._reconnect();
                    }
                    else {
                        console.log("\x1b[36m", "pong : ", resp, "\x1b[0m");
                    }
                });
            }, 30000);
            this.livePersonAgentListener.onConnected(this.livePersonAgent.agentId);
        });
        this.livePersonAgent._reconnect = (delay = this.reconnectInterval, attempt = 1) => {
            this.livePersonAgent._retryConnection = setTimeout(() => {
                this.livePersonAgent.reconnect();
                if (++attempt <= this.reconnectAttempts) {
                    this.livePersonAgent._reconnect(delay * this.reconnectRatio, attempt);
                }
            }, delay * 1000);
        };
        this.livePersonAgent.on("routing.RoutingTaskNotification", body => {
            body.changes.forEach(c => {
                if (c.type === "UPSERT") {
                    c.result.ringsDetails.forEach(r => {
                        if (r.ringState === "WAITING") {
                            this.livePersonAgent.updateRingState({
                                ringId: r.ringId,
                                ringState: "ACCEPTED"
                            }, (e, resp) => console.log(resp));
                        }
                    });
                }
            });
        });
        // Notification on changes in the open conversation list
        this.livePersonAgent.on("cqm.ExConversationChangeNotification", notificationBody => {
            notificationBody.changes.forEach(change => {
                if (change.type === "UPSERT" && !openConvs[change.result.convId]) {
                    // new conversation for me
                    openConvs[change.result.convId] = {};
                    // demonstration of using the consumer profile calls
                    const consumerId = change.result.conversationDetails.participants.filter(p => p.role === "CONSUMER")[0].id;
                    this.livePersonAgent.getUserProfile(consumerId, (e, profileResp) => {
                        // this.livePersonAgent.publishEvent({
                        //   dialogId: change.result.convId,
                        //   event: {
                        //     type: "ContentEvent",
                        //     contentType: "text/plain",
                        //     message: "FIRST TEST MESSAGE"
                        //   }
                        // });
                        // this.livePersonAgent.publishEvent({
                        //   dialogId: change.result.convId,
                        //   event: {
                        //     type: "ContentEvent",
                        //     contentType: "text/plain",
                        //     message: "SECOND TEST MESSAGE"
                        //   }
                        // });
                    });
                    var messageSequence = "";
                    if (change.result.lastContentEventNotification &&
                        change.result.lastContentEventNotification.sequence === 0) {
                        messageSequence = "0";
                    }
                    var contentEvent = {
                        dialogId: change.result.convId,
                        sequence: messageSequence,
                        message: "",
                        clientprops: ""
                    };
                    let event = Object.assign(Object.assign({}, contentEvent), { consumerId });
                    this.livePersonAgentListener.onConsumerConnect(this, event);
                    this.livePersonAgent.subscribeMessagingEvents({
                        dialogId: change.result.convId,
                        skillId: change.result.conversationDetails,
                        fromSeq: 999999999999999999999999
                    });
                }
                else if (change.type === "DELETE") {
                    // conversation was closed or transferred
                    delete openConvs[change.result.convId];
                }
            });
        });
        this.livePersonAgent.on("ms.MessagingEventNotification", body => {
            let consumerId = "";
            const respond = {};
            body.changes.forEach(c => {
                // In the current version MessagingEventNotification are recived also without subscription
                // Will be fixed in the next api version. So we have to check if this notification is handled by us.
                if (c.metadata) {
                    if (c.metadata.length) {
                        // console.log('META => ', c.metadata);
                    }
                }
                if (openConvs[c.dialogId]) {
                    // add to respond list all content event not by me
                    // console.log(c);
                    if (c.event.type === "ContentEvent" &&
                        c.originatorId !== this.livePersonAgent.agentId) {
                        consumerId = c.originatorId;
                        respond[`${body.dialogId}-${c.sequence}`] = {
                            dialogId: body.dialogId,
                            sequence: c.sequence,
                            message: c.event.message,
                            metadata: c.metadata,
                            serverTimestamp: c.serverTimestamp
                        };
                    }
                    // remove from respond list all the messages that were already read
                    if (c.event.type === "AcceptStatusEvent" &&
                        c.originatorId === this.livePersonAgent.agentId) {
                        c.event.sequenceList.forEach(seq => {
                            delete respond[`${body.dialogId}-${seq}`];
                        });
                    }
                }
            });
            // publish read, and echo
            Object.keys(respond).forEach(key => {
                let contentEvent = respond[key];
                this.livePersonAgent.publishEvent({
                    dialogId: contentEvent.dialogId,
                    event: {
                        type: "AcceptStatusEvent",
                        status: "READ",
                        sequenceList: [contentEvent.sequence]
                    }
                });
                // Notify listener to process the received message and attach customerId from LivePerson to the message
                this.livePersonAgent.getUserProfile(consumerId, (e, profile) => {
                    let customerId = "";
                    if (profile != undefined && typeof profile !== "string") {
                        let ctmrInfo = profile.filter(pr => pr.type == "ctmrinfo")[0];
                        customerId = ctmrInfo.info.customerId || "User";
                    }
                    let event = Object.assign(Object.assign({}, contentEvent), { customerId });
                    if (!helpers_1.exeptionsList.find(e => e === event.message)) {
                        console.log(event);
                        this.livePersonAgentListener.onMessage(this, event);
                    }
                });
            });
        });
        // Tracing
        this.livePersonAgent.on("error", err => this.handleSocketError(err));
        this.livePersonAgent.on("closed", data => this.handleSocketError(data));
    }
    logErrorMessage(error) {
        console.error(`LivePerson bot adapter error: ${error}`);
    }
    handleSocketError(err) {
        console.log('\x1b[31m', 'Error :: ', JSON.stringify(err), '\x1b[0m');
        if (err && err.code === 401) {
            console.log(":: SOCKET ERR - TRYING TO RECONNECT");
            this.livePersonAgent._reconnect();
        }
    }
}
exports.LivePersonBotAdapter = LivePersonBotAdapter;
//# sourceMappingURL=livepersonbotadapter.js.map