"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
/**
 * Proxy class for events coming from the LivePerson system.
 */
class LivePersonAgentListener extends events_1.EventEmitter {
    constructor(contentTranslator) {
        super();
        this.contentTranslator = null;
        this.contentTranslator = contentTranslator;
    }
    /**
     * Forwards the event, when the bot is connected as an agent.
     *
     * @param agentId The LivePerson assigned agent ID.
     */
    onConnected(agentId) {
        this.emit(LivePersonAgentListener.CONNECTED, agentId);
    }
    /**
     * This method is called, when the LivePerson bot adapter receives an event (message) from a user.
     *
     * The content is translated into TurnContext instance and forwarded to any code listening to the event.
     *
     * @param livePersonBotAdapter The LivePerson bot adapter.
     * @param contentEvent The content event.
     */
    onMessage(livePersonBotAdapter, contentEvent) {
        this.emit(LivePersonAgentListener.MESSAGE, this.contentTranslator.contentEventToTurnContext(contentEvent, livePersonBotAdapter));
    }
    onConsumerConnect(livePersonBotAdapter, contentEvent) {
        //logger.info("contentEvent found is for consumer is  :: "+JSON.stringify(contentEvent));
        this.emit(LivePersonAgentListener.CUSTOMER_CONNECT, this.contentTranslator.connectEventToTurnContext(contentEvent, livePersonBotAdapter));
    }
}
exports.LivePersonAgentListener = LivePersonAgentListener;
LivePersonAgentListener.CONNECTED = "lp_connected";
LivePersonAgentListener.MESSAGE = "lp_message";
LivePersonAgentListener.CUSTOMER_CONNECT = "lp_customer_connect";
//# sourceMappingURL=livepersonagentlistener.js.map