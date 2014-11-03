function addEvent(el, type, callback) {
    if (el.addEventListener) {
        el.addEventListener(type, callback, false);
    } else if (el.attachEvent) {
        el.attachEvent('on' + type, callback);
    }
}

function removeEvent(el, type, callback) {
    if (el.removeEventListener) {
        el.removeEventListener(type, callback, false);
    } else if (el.detachEvent) {
        el.detachEvent('on' + type, callback);
    }
}

var utils = {
    addEvent: addEvent,
    removeEvent: removeEvent
};

function numberify(s) {
    var c = 0;
    // convert '1.2.3.4' to 1.234
    return parseFloat(s.replace(/\./g, function () {
        return (c++ === 0) ? '.' : '';
    }));
}

var m, v;
var ua = (window.navigator || {}).userAgent || '';
if ((m = ua.match(/MSIE ([^;]*)|Trident.*; rv(?:\s|:)?([0-9.]+)/)) &&
    (v = (m[1] || m[2]))) {
    utils.ie = numberify(v);
    utils.ieMode = document.documentMode || utils.ie;
}

module.exports = utils;