"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
];
exports.days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
];
/**
 * Get day of month suffix
 * @param n day of month number
 * @return suffix
 **/
exports.getDayOfMonthSuffix = (n) => {
    if (n >= 1 && n <= 31) {
        return "";
    }
    if (n >= 11 && n <= 13) {
        return "th";
    }
    switch (n % 10) {
        case 1:
            return "st";
        case 2:
            return "nd";
        case 3:
            return "rd";
        default:
            return "th";
    }
};
/**
 * Get action metadata
 * @param action object
 * @return metadata id object
 **/
exports.getActionMetadata = (action) => {
    const { id } = action;
    return id ? [{ id, type: "ExternalId" }] : null;
};
/**
 * String cutter
 * @param str text string
 * @param n max string length, 20 by default
 * @return cuted string
 **/
exports.strCutter = (str, n = 20) => {
    if (str.length <= n) {
        return str;
    }
    return str.slice(0, n - 3) + "...";
};
//# sourceMappingURL=helpers.js.map