"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @member elements rich content, text, images, buttons
 * @member type - vertical or horizontal
 * @member quickReplies - suggested actions
 */
class RichContent {}
exports.RichContent = RichContent;
class CardContent extends RichContent {
  constructor() {
    super();
    this.type = "vertical";
  }
}
exports.CardContent = CardContent;
class CarouselContent extends RichContent {
  constructor(elements) {
    super();
    this.elements = elements;
    this.type = "carousel";
    this.padding = 10;
  }
}
exports.CarouselContent = CarouselContent;
/**
 * Base class for rich elements
 *
 * @member type text, image, button
 */
class Element {}
exports.Element = Element;
/**
 * Base class for elements containing tooltip
 */
class ElementWithTooltip extends Element {
  constructor(tooltip) {
    if (tooltip) {
      this.tooltip = tooltip;
    }
  }
}
exports.ElementWithTooltip = ElementWithTooltip;
/**
 * Button element class
 *
 * @member click determines behaviour of button
 */
class Button extends ElementWithTooltip {
  constructor(tooltip, title, buttonActions, metadata = null) {
    super(tooltip);
    this.type = "button";
    this.title = title;
    this.click = { actions: buttonActions };
    if (metadata) {
      this.click.metadata = metadata;
    }
  }
}
exports.Button = Button;
/**
 * List Submit Button element class
 *
 * @member click determines behaviour of button
 */
class SubmitButton extends Button {
  constructor(
    tooltip,
    title,
    buttonActions,
    metadata = null,
    disabled = false
  ) {
    super(tooltip, title, buttonActions, metadata);
    this.type = "submitButton";
    this.disabled = disabled;
  }
}
exports.SubmitButton = SubmitButton;
/**
 * Base ButtonActions class
 */
class ButtonActions {}
exports.ButtonActions = ButtonActions;
/**
 * SubmitButtonAction - submit button button action
 */
class SubmitButtonAction extends ButtonActions {
  constructor() {
    super();
    this.type = "submitAsText";
    this.submit = true;
  }
}
exports.SubmitButtonAction = SubmitButtonAction;
/**
 * LinkButtonAction - open URL button action
 */
class LinkButtonAction extends ButtonActions {
  constructor(name, uri) {
    super();
    this.name = name;
    this.uri = uri;
    this.type = "link";
  }
}
exports.LinkButtonAction = LinkButtonAction;
/**
 * Send text button action
 */
class PostBackButtonAction extends ButtonActions {
  constructor(text) {
    super();
    this.text = text;
    this.type = "publishText";
  }
}
exports.PostBackButtonAction = PostBackButtonAction;
/**
 * Simple Text element
 *
 */
class SimpleTextElement extends Element {
  constructor(text) {
    super();
    this.type = "text";
    this.text = text;
  }
}
exports.SimpleTextElement = SimpleTextElement;
/**
 * Text element
 *
 */
class TextElement extends ElementWithTooltip {
  constructor(text, tooltip, style = {}) {
    super(tooltip);
    this.type = "text";
    this.text = text;
    const keys = Object.keys(style);
    if (keys.length) {
      this.style = style;
    }
  }
}
exports.TextElement = TextElement;
/**
 * Image element
 *
 * Note that the URL must be whitelisted in the LivePerson service
 */
class Image extends ElementWithTooltip {
  constructor(url, tooltip) {
    super(tooltip);
    this.type = "image";
    this.url = url;
  }
}
exports.Image = Image;
/**
 * Suggested action button
 */
class QuickReply {
  constructor(value, title) {
    this.type = "button";
    this.tooltip = title;
    this.title = title;
    this.click = {
      actions: [new PostBackButtonAction(value)],
      metadata: [{ type: "ExternalId", id: "ExternalIdValue" }]
    };
  }
}
exports.QuickReply = QuickReply;
TextElement;
/**
 * Suggested actions
 */
class QuickReplies extends Element {
  constructor(itemsPerRow) {
    super();
    this.itemsPerRow = itemsPerRow;
    this.type = "quickReplies";
    this.replies = new Array();
  }
}
exports.QuickReplies = QuickReplies;
class Container extends Element {
  constructor(containerType) {
    super();
    this.type = containerType;
    this.elements = new Array();
  }
}
exports.Container = Container;
class Section extends Container {
  constructor(sectionID) {
    super("section");
    this.sectionID = sectionID;
  }
}
exports.Section = Section;
class CheckBox extends Element {
  constructor(text, value, desc) {
    super();
    this.type = "checkbox";
    this.text = text;
    if (desc) {
      this.tooltip = desc;
    }
    this.click = {
      actions: [{ type: "checked", publishText: text }],
      metadata: [{ type: "ExternalId", id: value }]
    };
  }
}
exports.CheckBox = CheckBox;
var ElementTypes;
(function(ElementTypes) {
  ElementTypes["Container"] = "Container";
  ElementTypes["ColumnSet"] = "ColumnSet";
  ElementTypes["Column"] = "Column";
  ElementTypes["FactSet"] = "FactSet";
  ElementTypes["TextBlock"] = "TextBlock";
  ElementTypes["ImageSet"] = "ImageSet";
  ElementTypes["Image"] = "Image";
  ElementTypes["Media"] = "Media";
  ElementTypes["MultiSelect"] = "Input.ChoiceSet";
  ElementTypes["ActionSet"] = "ActionSet";
})((ElementTypes = exports.ElementTypes || (exports.ElementTypes = {})));
//# sourceMappingURL=richcontentdefinitions.js.map
