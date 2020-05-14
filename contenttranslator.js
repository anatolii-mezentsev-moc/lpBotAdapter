"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const botbuilder_1 = require("botbuilder");
const RichContentDefinitions = require("./richcontentdefinitions");
const helpers_1 = require("./helpers");
/*
 * Translation map
 *
 * | LivePerson  | Microsoft Bot Framework   |
 * |-------------|---------------------------|
 * | customerId  | Activity.channelData.id   |
 * | dialogId    | Activity.conversation.id  |
 * | message     | Activity.text             |
 *
 */
/**
 * Translates content format between the Microsoft Bot Framework and the LivePerson system.
 *
 * More details on rich content in LivePerson:
 * - https://developers.liveperson.com/structured-content-templates-card.html
 * - https://developers.liveperson.com/messaging-agent-sdk-conversation-metadata-guide.html
 */
class ContentTranslator {
    /**
     * Translates the given content to a TurnContext instance, which the bot can interpret.
     *
     * @param contentEvent The content event to translate.
     * @param livePersonBotAdapter The LivePerson bot adapter.
     * @returns A newly created TurnContext instance based on the given content event.
     */
    connectEventToTurnContext(contentEvent, livePersonBotAdapter) {
        let channelAccount = {
            id: contentEvent.customerId,
            name: contentEvent.customerId,
            role: "user",
            clientprops: contentEvent.clientprops
        };
        let conversationAccount = {
            isGroup: false,
            conversationType: "",
            id: contentEvent.dialogId,
            name: "",
            role: botbuilder_1.RoleTypes.User
        };
        let turnContext = new botbuilder_1.TurnContext(livePersonBotAdapter, {
            channelData: channelAccount,
            conversation: conversationAccount,
            channelId: "liveperson",
            text: contentEvent.message,
            type: "message",
            // @ts-ignore
            multiSelectData: contentEvent.metadata,
        });
        return turnContext;
    }
    contentEventToTurnContext(contentEvent, livePersonBotAdapter) {
        let channelAccount = {
            id: contentEvent.customerId,
            name: contentEvent.customerId,
            role: "user"
        };
        let conversationAccount = {
            isGroup: false,
            conversationType: "",
            id: contentEvent.dialogId,
            name: "",
            role: botbuilder_1.RoleTypes.User
        };
        let turnContext = new botbuilder_1.TurnContext(livePersonBotAdapter, {
            channelData: channelAccount,
            conversation: conversationAccount,
            channelId: "liveperson",
            text: contentEvent.message,
            type: "message"
        });
        //let turnContext = new TurnContext(livePersonBotAdapter, message);
        if (contentEvent.skillId) {
            turnContext.skillId = contentEvent.skillId;
        }
        return turnContext;
    }
    /**
     * Translates the given activity into LivePerson event.
     *
     * @param activity The activity to translate.
     * @returns An event object ready to be used to send message via LivePerson.
     */
    activityToLivePersonEvent(activity) {
        let event = {};
        if (activity.text !== undefined) {
            event = {
                type: "ContentEvent",
                contentType: "text/plain",
                message: activity.text
            };
            if (activity.suggestedActions !== undefined) {
                let quickReplies = this.suggestedActionsToLivePersonQuickReplies(activity.suggestedActions);
                event = Object.assign(Object.assign({}, event), { quickReplies });
            }
        }
        const { type, 
        // @ts-ignore
        body, 
        // @ts-ignore
        actions, attachments, attachmentLayout, suggestedActions } = activity;
        if (type === "AdaptiveCard" &&
            (body !== undefined || actions !== undefined)) {
            let elements = new Array();
            let richContent = {
                type: "vertical",
                elements: elements
            };
            const multiSelectCount = body.filter(({ type }) => type === RichContentDefinitions.ElementTypes.MultiSelect).length;
            if (multiSelectCount) {
                const choiceListIndex = body.findIndex(({ type }) => type === RichContentDefinitions.ElementTypes.MultiSelect);
                if (choiceListIndex === -1) {
                    return;
                }
                const beforeBody = body.slice(0, choiceListIndex - 1);
                if (beforeBody.length) {
                    beforeBody.forEach(item => this.botFrameworkItemToLivePersonElement(item, elements));
                }
                const afterBody = body.slice(choiceListIndex - 1);
                this.botFrameworkItemsToLivePersonList(multiSelectCount, afterBody, actions, elements);
            }
            else {
                // translate items
                body.forEach(item => {
                    this.botFrameworkItemToLivePersonElement(item, elements);
                });
                // translate actions
                if (actions && actions.length) {
                    const vr = new RichContentDefinitions.Container("vertical");
                    elements.push(vr);
                    actions.forEach(action => {
                        this.botFrameworkActionToLivePersonElement(action, vr.elements);
                    });
                }
            }
            event.type = "RichContentEvent";
            event.content = richContent;
        }
        if (attachments !== undefined) {
            let richContent = null;
            if (attachmentLayout == "carousel") {
                let elements = new Array();
                attachments.forEach(element => {
                    elements.push(this.botFrameworkAttachmentToLivePersonCard(element.content));
                });
                richContent = new RichContentDefinitions.CarouselContent(elements);
            }
            else {
                richContent = this.botFrameworkAttachmentToLivePersonCard(attachments[0].content);
            }
            if (suggestedActions !== undefined) {
                richContent.quickReplies = this.suggestedActionsToLivePersonQuickReplies(suggestedActions);
            }
            event.type = "RichContentEvent";
            event.content = richContent;
        }
        // HERE
        return event;
    }
    /**
     * Translates the given suggested actions to LivePerson quick replies.
     *
     * @param suggestedActions The suggested actions to translate.
     * @returns LivePerson quick replies.
     */
    suggestedActionsToLivePersonQuickReplies(suggestedActions) {
        var quickReplies = new RichContentDefinitions.QuickReplies(4);
        if (suggestedActions !== undefined) {
            suggestedActions.actions.forEach(element => {
                quickReplies.replies.push(new RichContentDefinitions.QuickReply(element.value, element.title));
            });
        }
        return quickReplies;
    }
    /**
     * Check and convert the Bot Framework fact value to LivePerson messag or link button.
     *
     * @param botFrameworkFactValue The Bot Framework fact value.
     * @returns LivePerson element.
     */
    botFrameworkFactToLivePersonElement(botFrameworkFactValue) {
        const titleRegex = /^\[(.*?)\]/;
        const linkRegex = /\((.*?)\)/;
        const title = botFrameworkFactValue.match(titleRegex);
        const url = botFrameworkFactValue.match(linkRegex);
        if (title && url) {
            let buttonAction = new RichContentDefinitions.LinkButtonAction(title[1], url[1]);
            return new RichContentDefinitions.Button(title[1], title[1], [
                buttonAction
            ]);
        }
        else {
            return new RichContentDefinitions.TextElement(botFrameworkFactValue, helpers_1.strCutter(botFrameworkFactValue));
        }
    }
    /**
     * Convert the Bot Framework message to LivePerson message.
     *
     * @param botFrameworkMessage The Bot Framework message.
     * @returns LivePerson message.
     */
    botFrameworkMessageToLivePersonMessage(botFrameworkMessage) {
        const regex = /{{(.*?)}}/gi;
        const matches = botFrameworkMessage.match(regex);
        if (!matches) {
            return botFrameworkMessage;
        }
        const values = matches.map(m => m.slice(2, m.length - 2));
        const convertValues = values.map(value => {
            if (value.startsWith("DATE")) {
                const dateOptions = value.slice(5, value.length - 1).split(",");
                const date = new Date(dateOptions[0]);
                if (dateOptions[1].toLowerCase() === "long") {
                    return `${helpers_1.days[date.getDay()]}, ${helpers_1.months[date.getMonth()]} ${date.getDate()}${helpers_1.getDayOfMonthSuffix(date.getDate())}, ${date.getFullYear()}`;
                }
                else if (dateOptions[1].toLowerCase() === "short") {
                    return `${helpers_1.days[date.getDay()].slice(0, 3)}, ${helpers_1.months[date.getMonth()].slice(0, 3)} ${date.getDate()}${helpers_1.getDayOfMonthSuffix(date.getDate())}, ${date.getFullYear()}`;
                }
                else {
                    return `${date.getDate()}\/${date.getMonth()}\/${date.getFullYear()}`;
                }
            }
            else if (value.startsWith("TIME")) {
                const date = new Date(value.slice(5, value.length - 1));
                const h = date.getHours() < 10 ? `0${date.getHours()}` : `${date.getHours()}`;
                const m = date.getMinutes() < 10
                    ? `0${date.getMinutes()}`
                    : `${date.getMinutes()}`;
                return `${h}:${m}`;
            }
            else {
                return value;
            }
        });
        let result = botFrameworkMessage;
        for (let i = 0; i < matches.length; i++) {
            result = result.replace(matches[i], convertValues[i]);
        }
        return result;
    }
    /**
     * Translates the Bot Framework items content to LivePerson elements.
     *
     * @param botFrameworkItem The Bot Framework item.
     * @param elements LivePerson elements container.
     */
    botFrameworkItemToLivePersonElement(botFrameworkItem, elements) {
        const { type } = botFrameworkItem;
        if (type === RichContentDefinitions.ElementTypes.Container) {
            botFrameworkItem.items.forEach(columnItem => {
                this.botFrameworkItemToLivePersonElement(columnItem, elements);
            });
        }
        else if (type === RichContentDefinitions.ElementTypes.ColumnSet) {
            const horizontal = new RichContentDefinitions.Container("horizontal");
            elements.push(horizontal);
            botFrameworkItem.columns.forEach(columnItem => {
                this.botFrameworkItemToLivePersonElement(columnItem, horizontal.elements);
            });
        }
        else if (type === RichContentDefinitions.ElementTypes.Column) {
            const vertical = new RichContentDefinitions.Container("vertical");
            elements.push(vertical);
            botFrameworkItem.items.forEach(columnItem => {
                this.botFrameworkItemToLivePersonElement(columnItem, vertical.elements);
            });
        }
        else if (type === RichContentDefinitions.ElementTypes.FactSet) {
            const vertical = new RichContentDefinitions.Container("vertical");
            elements.push(vertical);
            botFrameworkItem.facts.forEach(fact => {
                const horizontal = new RichContentDefinitions.Container("horizontal");
                vertical.elements.push(horizontal);
                horizontal.elements.push(new RichContentDefinitions.TextElement(fact.title, helpers_1.strCutter(fact.title), {
                    bold: true
                }));
                horizontal.elements.push(this.botFrameworkFactToLivePersonElement(fact.value));
            });
        }
        else if (type === RichContentDefinitions.ElementTypes.ImageSet) {
            const horizontal = new RichContentDefinitions.Container("horizontal");
            elements.push(horizontal);
            botFrameworkItem.images.forEach(image => {
                this.botFrameworkItemToLivePersonElement(image, horizontal.elements);
            });
        }
        else if (type === RichContentDefinitions.ElementTypes.TextBlock) {
            const { text, weight, size, color } = botFrameworkItem;
            const style = {};
            if (weight) {
                style.bold = weight === "bolder";
            }
            if (size) {
                style.size = size.toLowerCase();
            }
            if (color) {
                style.color = color;
            }
            const leText = this.botFrameworkMessageToLivePersonMessage(text);
            elements.push(new RichContentDefinitions.TextElement(leText, helpers_1.strCutter(leText), style));
        }
        else if (type === RichContentDefinitions.ElementTypes.Image) {
            const { url, tooltip } = botFrameworkItem;
            elements.push(new RichContentDefinitions.Image(url, tooltip ? tooltip : ""));
        }
        else if (type === RichContentDefinitions.ElementTypes.Media) {
            const { poster } = botFrameworkItem;
            if (poster) {
                elements.push(new RichContentDefinitions.Image(poster, "image tooltip"));
            }
        }
        else if (type === RichContentDefinitions.ElementTypes.MultiSelect) {
            const { id, choices, isMultiSelect, value } = botFrameworkItem;
            const preselectedIds = value ? value.split(",") : [];
            choices.forEach(choise => {
                let buttonAction = new RichContentDefinitions.PostBackButtonAction(choise.title);
                const isSelected = preselectedIds.findIndex(el => choise.value === el) !== -1;
                elements.push(new RichContentDefinitions.Button(choise.title, choise.title, [buttonAction], [
                    {
                        id: `checkbox;${id};${isMultiSelect ? true : false};${choise.value};${isSelected}`,
                        type: "ExternalId"
                    }
                ]));
            });
        }
        else if (type === RichContentDefinitions.ElementTypes.ActionSet) {
            const actions = botFrameworkItem.actions;
            if (actions && actions.length) {
                const vertical = new RichContentDefinitions.Container("vertical");
                elements.push(vertical);
                actions.forEach(action => {
                    this.botFrameworkActionToLivePersonElement(action, vertical.elements);
                });
            }
        }
    }
    /**
     * Translates the Bot Framework items content to LivePerson elements.
     *
     * @param action The Bot Framework item.
     * @param elements LivePerson elements container.
     */
    botFrameworkActionToLivePersonElement(action, elements, isMultiSelect = false) {
        const { type, title } = action;
        const metadata = helpers_1.getActionMetadata(action);
        if (type === "Action.OpenUrl") {
            const { url } = action;
            let buttonAction = new RichContentDefinitions.LinkButtonAction(title, url);
            elements.push(new RichContentDefinitions.Button(helpers_1.strCutter(title), title, [buttonAction], metadata));
        }
        else if (type === "Action.Submit" && isMultiSelect) {
            let buttonAction = new RichContentDefinitions.SubmitButtonAction();
            elements.push(new RichContentDefinitions.SubmitButton(helpers_1.strCutter(title), title, [buttonAction], metadata));
        }
        else {
            let buttonAction = new RichContentDefinitions.PostBackButtonAction(action.title);
            elements.push(new RichContentDefinitions.Button(helpers_1.strCutter(action.title), action.title, [buttonAction], metadata));
        }
    }
    /**
     * Translates the Bot Framework items content to LivePerson List element.
     *
     * @param count choices sets amount.
     * @param items The Bot Framework items.
     * @param actions The Bot Framework actions.
     * @param elements LivePerson elements container.
     */
    botFrameworkItemsToLivePersonList(count, bodyItems, actions, elements) {
        const list = new RichContentDefinitions.Container("list");
        const sectionList = new RichContentDefinitions.Container("sectionList");
        const buttonList = new RichContentDefinitions.Container("buttonList");
        let ch = 0;
        list.elements.push(sectionList);
        if (count > 1) {
            list.elements.unshift(new RichContentDefinitions.SimpleTextElement(""));
        }
        let currentSection;
        for (let i = 0; i < bodyItems.length; i++) {
            const item = bodyItems[i];
            const { type } = item;
            if (ch >= count) {
                break;
            }
            if (type === RichContentDefinitions.ElementTypes.TextBlock) {
                const title = new RichContentDefinitions.SimpleTextElement(item.text);
                currentSection = new RichContentDefinitions.Section("");
                sectionList.elements.push(currentSection);
                if (count === 1) {
                    list.elements.unshift(title);
                }
                else if (count > 1) {
                    currentSection.elements.push(title);
                }
            }
            else if (type === RichContentDefinitions.ElementTypes.MultiSelect) {
                const checkList = new RichContentDefinitions.Container("checklist");
                currentSection.elements.push(checkList);
                const { id, choices } = item;
                currentSection.sectionID = id;
                choices.forEach(({ title, value, desc }) => {
                    checkList.elements.push(new RichContentDefinitions.CheckBox(title, value, desc));
                });
                ch++;
            }
        }
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            this.botFrameworkActionToLivePersonElement(action, buttonList.elements, true);
        }
        list.elements.push(buttonList);
        elements.push(list);
    }
    /**
     * Translates the Bot Framework attachment content to LivePerson rich content.
     *
     * @param botFrameworkAttachmentContent The Bot Framework attachment content (card).
     * @returns A newly created LivePerson card content instance.
     */
    botFrameworkAttachmentToLivePersonCard(botFrameworkAttachmentContent) {
        let elements = new Array();
        if (botFrameworkAttachmentContent.type === "AdaptiveCard") {
            const { body, actions } = botFrameworkAttachmentContent;
            const multiSelectCount = body.filter(({ type }) => type === RichContentDefinitions.ElementTypes.MultiSelect).length;
            if (multiSelectCount) {
                const choiceListIndex = body.findIndex(({ type }) => type === RichContentDefinitions.ElementTypes.MultiSelect);
                if (choiceListIndex === -1) {
                    return;
                }
                const beforeBody = body.slice(0, choiceListIndex - 1);
                if (beforeBody.length) {
                    beforeBody.forEach(item => this.botFrameworkItemToLivePersonElement(item, elements));
                }
                const afterBody = body.slice(choiceListIndex - 1);
                this.botFrameworkItemsToLivePersonList(multiSelectCount, afterBody, actions, elements);
            }
            else {
                // translate items
                body.forEach(item => {
                    this.botFrameworkItemToLivePersonElement(item, elements);
                });
                // translate actions
                if (actions && actions.length) {
                    const vertical = new RichContentDefinitions.Container("vertical");
                    elements.push(vertical);
                    actions.forEach(action => {
                        this.botFrameworkActionToLivePersonElement(action, vertical.elements);
                    });
                }
            }
        }
        else {
            elements.push(new RichContentDefinitions.TextElement(botFrameworkAttachmentContent.title, helpers_1.strCutter(botFrameworkAttachmentContent.title)));
        }
        if (botFrameworkAttachmentContent.subtitle !== undefined) {
            elements.push(new RichContentDefinitions.TextElement(botFrameworkAttachmentContent.title.subtitle, helpers_1.strCutter(botFrameworkAttachmentContent.title.subtitle)));
        }
        if (botFrameworkAttachmentContent.buttons !== undefined) {
            botFrameworkAttachmentContent.buttons.forEach(element => {
                const metadata = helpers_1.getActionMetadata(element);
                if (element.type == "imBack" || element.type == "postBack") {
                    let action = new RichContentDefinitions.PostBackButtonAction(element.value);
                    elements.push(new RichContentDefinitions.Button(helpers_1.strCutter(element.title), element.title, [action], metadata));
                }
                if (element.type == "openUrl") {
                    let action = new RichContentDefinitions.LinkButtonAction(element.title, element.value);
                    elements.push(new RichContentDefinitions.Button(helpers_1.strCutter(element.title), element.title, [action], metadata));
                }
            });
        }
        let richContent = {
            type: "vertical",
            elements: elements
        };
        return richContent;
    }
}
exports.ContentTranslator = ContentTranslator;
//# sourceMappingURL=contenttranslator.js.map