/**
 * @ignore
 * base for xhr and subdomain
 * @author yiminghe@gmail.com
 */

var util = require('util');
var url = require('url');
var querystring = require('querystring');
var IO = require('./base');
var UA = require('ua');
var OK_CODE = 200,
    supportCORS,
    win = window,
// http://msdn.microsoft.com/en-us/library/cc288060(v=vs.85).aspx
    XDomainRequest_ = UA.ieMode > 7 && win.XDomainRequest,
    NO_CONTENT_CODE = 204,
    NOT_FOUND_CODE = 404,
    NO_CONTENT_CODE2 = 1223,
    XhrTransportBase = {
        proto: {}
    }, lastModifiedCached = {},
    eTagCached = {};

IO.__lastModifiedCached = lastModifiedCached;
IO.__eTagCached = eTagCached;

XhrTransportBase.nativeXhr = win.ActiveXObject ? function (crossDomain, refWin) {
    // consider ie10
    if (!supportCORS && crossDomain && XDomainRequest_) {
        return new XDomainRequest_();
    }
    // ie7 XMLHttpRequest 不能访问本地文件
    return !IO.isLocal && createStandardXHR(crossDomain, refWin) ||
        createActiveXHR(crossDomain, refWin);
} : createStandardXHR;

supportCORS = XhrTransportBase.supportCORS =
    ('withCredentials' in XhrTransportBase.nativeXhr());

function createStandardXHR(_, refWin) {
    try {
        return new (refWin || win).XMLHttpRequest();
    } catch (e) {
    }
    return undefined;
}

function createActiveXHR(_, refWin) {
    try {
        return new (refWin || win).ActiveXObject('Microsoft.XMLHTTP');
    } catch (e) {
    }
    return undefined;
}

XhrTransportBase.XDomainRequest_ = XDomainRequest_;

function isInstanceOfXDomainRequest(xhr) {
    return XDomainRequest_ && (xhr instanceof XDomainRequest_);
}

function getIfModifiedKey(c) {
    var ifModified = c.ifModified,
        ifModifiedKey;
    if (ifModified) {
        ifModifiedKey = c.uri;
        if (c.cache === false) {
            ifModifiedKey = util.clone(ifModifiedKey);
            // remove random timestamp
            // random timestamp is forced to fetch code file from server
            delete ifModifiedKey.query._ksTS;
        }
        ifModifiedKey = url.stringify(ifModifiedKey);
    }
    return ifModifiedKey;
}

util.mix(XhrTransportBase.proto, {
    sendInternal: function () {
        var self = this,
            io = self.io,
            c = io.config,
            nativeXhr = self.nativeXhr,
            files = c.files,
            type = files ? 'post' : c.type,
            async = c.async,
            username,
            mimeType = io.mimeType,
            requestHeaders = io.requestHeaders || {},
            url = io._getUrlForSend(),
            xhrFields,
            ifModifiedKey = getIfModifiedKey(c),
            cacheValue,
            i;

        if (ifModifiedKey) {
            // if io want a conditional load
            // (response status is 304 and responseText is null)
            // u need to set if-modified-since manually!
            // or else
            // u will always get response status 200 and full responseText
            // which is also conditional load but process transparently by browser
            if ((cacheValue = lastModifiedCached[ifModifiedKey])) {
                requestHeaders['If-Modified-Since'] = cacheValue;
            }
            if ((cacheValue = eTagCached[ifModifiedKey])) {
                requestHeaders['If-None-Match'] = cacheValue;
            }
        }

        if ((username = c.username)) {
            nativeXhr.open(type, url, async, username, c.password);
        } else {
            nativeXhr.open(type, url, async);
        }

        xhrFields = c.xhrFields || {};

        if ('withCredentials' in xhrFields) {
            if (!supportCORS) {
                delete xhrFields.withCredentials;
            }
        }

        for (i in xhrFields) {
            try {
                nativeXhr[ i ] = xhrFields[ i ];
            } catch (e) {
            }
        }
        // Override mime type if supported
        if (mimeType && nativeXhr.overrideMimeType) {
            nativeXhr.overrideMimeType(mimeType);
        }

        var xRequestHeader = requestHeaders['X-Requested-With'];

        if (xRequestHeader === false) {
            delete requestHeaders['X-Requested-With'];
        }

        // ie<10 XDomainRequest does not support setRequestHeader
        if (typeof nativeXhr.setRequestHeader !== 'undefined') {
            for (i in requestHeaders) {
                nativeXhr.setRequestHeader(i, requestHeaders[ i ]);
            }
        }

        var sendContent = c.hasContent && c.data || null;

        // support html5 file upload api
        if (files) {
            var originalSentContent = sendContent,
                data = {};
            if (originalSentContent) {
                data = querystring.parse(originalSentContent);
            }
            data = util.mix(data, files);
            sendContent = new FormData();
            util.each(data, function (vs, k) {
                if (util.isArray(vs)) {
                    util.each(vs, function (v) {
                        sendContent.append(k + (c.serializeArray ? '[]' : ''), v);
                    });
                } else {
                    sendContent.append(k, vs);
                }
            });
        }

        nativeXhr.send(sendContent);

        if (!async || nativeXhr.readyState === 4) {
            self._callback();
        } else {
            // XDomainRequest_ 单独的回调机制
            if (isInstanceOfXDomainRequest(nativeXhr)) {
                nativeXhr.onload = function () {
                    nativeXhr.readyState = 4;
                    nativeXhr.status = 200;
                    self._callback();
                };
                nativeXhr.onerror = function () {
                    nativeXhr.readyState = 4;
                    nativeXhr.status = 500;
                    self._callback();
                };
            } else {
                nativeXhr.onreadystatechange = function () {
                    self._callback();
                };
            }
        }
    },
    // 由 io.abort 调用，自己不可以调用 io.abort
    abort: function () {
        this._callback(0, 1);
    },

    _callback: function (event, abort) {
        // Firefox throws exceptions when accessing properties
        // of an xhr when a network error occurred
        // http://helpful.knobs-dials.com/index.php/Component_returned_failure_code:_0x80040111_(NS_ERROR_NOT_AVAILABLE)
        var self = this,
            nativeXhr = self.nativeXhr,
            io = self.io,
            ifModifiedKey,
            lastModified,
            eTag,
            statusText,
            xml,
            c = io.config;
        try {
            //abort or complete
            if (abort || nativeXhr.readyState === 4) {
                // ie6 ActiveObject 设置不恰当属性导致出错
                if (isInstanceOfXDomainRequest(nativeXhr)) {
                    nativeXhr.onerror = util.noop;
                    nativeXhr.onload = util.noop;
                } else {
                    // ie6 ActiveObject 只能设置，不能读取这个属性，否则出错！
                    nativeXhr.onreadystatechange = util.noop;
                }

                if (abort) {
                    // 完成以后 abort 不要调用
                    if (nativeXhr.readyState !== 4) {
                        nativeXhr.abort();
                    }
                } else {
                    ifModifiedKey = getIfModifiedKey(c);

                    var status = nativeXhr.status;

                    // XDomainRequest_ 不能获取响应头
                    if (!isInstanceOfXDomainRequest(nativeXhr)) {
                        io.responseHeadersString = nativeXhr.getAllResponseHeaders();
                    }

                    if (ifModifiedKey) {
                        lastModified = nativeXhr.getResponseHeader('Last-Modified');
                        eTag = nativeXhr.getResponseHeader('ETag');
                        // if u want to set if-modified-since manually
                        // u need to save last-modified after the first request
                        if (lastModified) {
                            lastModifiedCached[ifModifiedKey] = lastModified;
                        }
                        if (eTag) {
                            eTagCached[eTag] = eTag;
                        }
                    }

                    xml = nativeXhr.responseXML;

                    // Construct response list
                    if (xml && xml.documentElement) {
                        io.responseXML = xml;
                    }

                    var text = io.responseText = nativeXhr.responseText;

                    // same with old-ie iframe-upload
                    if (c.files && text) {
                        var bodyIndex, lastBodyIndex;
                        if ((bodyIndex = text.indexOf('<body>')) !== -1) {
                            lastBodyIndex = text.lastIndexOf('</body>');
                            if (lastBodyIndex === -1) {
                                lastBodyIndex = text.length;
                            }
                            text = text.slice(bodyIndex + 6, lastBodyIndex);
                        }
                        // same with old-ie logic
                        io.responseText = util.unEscapeHtml(text);
                    }

                    // Firefox throws an exception when accessing
                    // statusText for faulty cross-domain requests
                    try {
                        statusText = nativeXhr.statusText;
                    } catch (e) {
                        // We normalize with Webkit giving an empty statusText
                        statusText = '';
                    }

                    // Filter status for non standard behaviors
                    // If the request is local and we have data: assume a success
                    // (success with no data won't get notified, that's the best we
                    // can do given current implementations)
                    if (!status && IO.isLocal && !c.crossDomain) {
                        status = io.responseText ? OK_CODE : NOT_FOUND_CODE;
                        // IE - #1450: sometimes returns 1223 when it should be 204
                    } else if (status === NO_CONTENT_CODE2) {
                        status = NO_CONTENT_CODE;
                    }
                    io._ioReady(status, statusText);
                }
            }
        } catch (e) {
            if ('@DEBUG@') {
                console.error(e.stack || e);
                setTimeout(function () {
                    throw e;
                }, 0);
            }
            nativeXhr.onreadystatechange = util.noop;
            if (!abort) {
                io._ioReady(0 - 1, e.message || 'process error');
            }
        }
    }
});

module.exports = XhrTransportBase;