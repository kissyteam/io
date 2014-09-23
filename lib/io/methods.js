/**
 * @ignore
 * encapsulation of io object. as transaction object in yui3
 * @author yiminghe@gmail.com
 */
var util = require('util');
var XPromise = require('promise'),
    IO = require('./base');
var url = require('url');
var OK_CODE = 200,
    MULTIPLE_CHOICES = 300,
    NOT_MODIFIED = 304,
// get individual response header from response header str
    HEADER_REG = /^(.*?):[ \t]*([^\r\n]*)\r?$/mg;

function handleResponseData(io) {
    // text xml 是否原生转化支持
    var text = io.responseText,
        xml = io.responseXML,
        c = io.config,
        converts = c.converters,
        type,
        contentType,
        responseData,
        contents = c.contents,
        dataType = c.dataType;

    // 例如 script 直接是js引擎执行，没有返回值，不需要自己处理初始返回值
    // jsonp 时还需要把 script 转换成 json，后面还得自己来
    if (text || xml) {
        contentType = io.mimeType || io.getResponseHeader('Content-Type');

        // 去除无用的通用格式
        while (dataType[0] === '*') {
            dataType.shift();
        }

        if (!dataType.length) {
            // 获取源数据格式，放在第一个
            for (type in contents) {
                if (contents[type].test(contentType)) {
                    if (dataType[0] !== type) {
                        dataType.unshift(type);
                    }
                    break;
                }
            }
        }

        // 服务器端没有告知（并且客户端没有 mime type ）默认 text 类型
        dataType[0] = dataType[0] || 'text';

        // 获得合适的初始数据
        for (var dataTypeIndex = 0; dataTypeIndex < dataType.length; dataTypeIndex++) {
            if (dataType[dataTypeIndex] === 'text' && text !== undefined) {
                responseData = text;
                break;
            } else if (dataType[dataTypeIndex] === 'xml' && xml !== undefined) {
                // 有 xml 值才直接取，否则可能还要从 xml 转
                responseData = xml;
                break;
            }
        }

        if (!responseData) {
            var rawData = {text: text, xml: xml};
            // 看能否从 text xml 转换到合适数据，并设置起始类型为 text/xml
            util.each(['text', 'xml'], function (prevType) {
                var type = dataType[0],
                    converter = converts[prevType] && converts[prevType][type];
                if (converter && rawData[prevType]) {
                    dataType.unshift(prevType);
                    responseData = prevType === 'text' ? text : xml;
                    return false;
                }
                return undefined;
            });
        }
    }
    var prevType = dataType[0];

    // 按照转化链把初始数据转换成我们想要的数据类型
    for (var i = 1; i < dataType.length; i++) {
        type = dataType[i];

        var converter = converts[prevType] && converts[prevType][type];

        if (!converter) {
            throw new Error('no covert for ' + prevType + ' => ' + type);
        }
        responseData = converter(responseData);

        prevType = type;
    }

    io.responseData = responseData;
}

util.extend(IO, XPromise, {
        // Caches the header
        setRequestHeader: function (name, value) {
            var self = this;
            self.requestHeaders[name] = value;
            return self;
        },

        /**
         * get all response headers as string after request is completed.
         * @member IO
         * @return {String}
         */
        getAllResponseHeaders: function () {
            var self = this;
            return self.state === 2 ? self.responseHeadersString : null;
        },

        /**
         * get header value in response to specified header name
         * @param {String} name header name
         * @return {String} header value
         * @member IO
         */
        getResponseHeader: function (name) {
            var match, responseHeaders,
                self = this;
            // ie8 will be lowercase for content-type
            name = name.toLowerCase();
            if (self.state === 2) {
                if (!(responseHeaders = self.responseHeaders)) {
                    responseHeaders = self.responseHeaders = {};
                    while ((match = HEADER_REG.exec(self.responseHeadersString))) {
                        responseHeaders[match[1].toLowerCase()] = match[2];
                    }
                }
                match = responseHeaders[name];
            }
            return match === undefined ? null : match;
        },

        // Overrides response content-type header
        overrideMimeType: function (type) {
            var self = this;
            if (!self.state) {
                self.mimeType = type;
            }
            return self;
        },

        /**
         * cancel this request
         * @member IO
         * @param {String} [statusText=abort] error reason as current request object's statusText
         * @chainable
         */
        abort: function (statusText) {
            var self = this;
            statusText = statusText || 'abort';
            if (self.transport) {
                self.transport.abort(statusText);
            }
            self._ioReady(0, statusText);
            return self;
        },

        /**
         * get native XMLHttpRequest
         * @member IO
         * @return {XMLHttpRequest}
         */
        getNativeXhr: function () {
            var transport = this.transport;
            if (transport) {
                return transport.nativeXhr;
            }
            return null;
        },

        _ioReady: function (status, statusText) {
            var self = this;
            // 只能执行一次，防止重复执行
            // 例如完成后，调用 abort

            // 到这要么成功，调用success
            // 要么失败，调用 error
            // 最终都会调用 complete
            if (self.state === 2) {
                return;
            }
            self.state = 2;
            self.readyState = 4;
            var isSuccess;
            if (status >= OK_CODE && status < MULTIPLE_CHOICES || status === NOT_MODIFIED) {
                // note: not same with nativeStatusText, such as 'OK'/'Not Modified'
                // 为了整个框架的和谐以及兼容性，用小写，并改变写法
                if (status === NOT_MODIFIED) {
                    statusText = 'not modified';
                    isSuccess = true;
                } else {
                    try {
                        handleResponseData(self);
                        statusText = 'success';
                        isSuccess = true;
                    } catch (e) {
                        if ('@DEBUG@') {
                            console.error(e.stack || e);
                            setTimeout(function () {
                                throw e;
                            }, 0);
                        }
                        statusText = e.message || 'parser error';
                    }
                }
            } else {
                if (status < 0) {
                    status = 0;
                }
            }

            self.status = status;
            self.statusText = statusText;

            var defer = self.defer,
                config = self.config,
                timeoutTimer;
            if ((timeoutTimer = self.timeoutTimer)) {
                clearTimeout(timeoutTimer);
                self.timeoutTimer = 0;
            }
            /**
             * fired after request completes (success or error)
             * @event complete
             * @member IO
             * @static
             * @param {Event.CustomEvent.Object} e
             * @param {IO} e.io current io
             */

            /**
             * fired after request succeeds
             * @event success
             * @member IO
             * @static
             * @param {Event.CustomEvent.Object} e
             * @param {IO} e.io current io
             */

            /**
             * fired after request occurs error
             * @event error
             * @member IO
             * @static
             * @param {Event.CustomEvent.Object} e
             * @param {IO} e.io current io
             */
            var handler = isSuccess ? 'success' : 'error',
                h,
                v = [self.responseData, statusText, self],
                context = config.context,
                eventObject = {
                    // 兼容
                    ajaxConfig: config,
                    io: self
                };
            if ((h = config[handler])) {
                h.apply(context, v);
            }
            if ((h = config.complete)) {
                h.apply(context, v);
            }
            IO.fire(handler, eventObject);
            IO.fire('complete', eventObject);
            defer[isSuccess ? 'resolve' : 'reject'](v);
        },

        _getUrlForSend: function () {
            // for compatible, some server does not decode query
            // uri will encode query
            // x.html?t=1,2
            // =>
            // x.html?t=1%3c2
            // so trim original query when process other query
            // and append when send
            var c = this.config,
                uri = c.uri;
            var search = uri.search || '';
            delete uri.search;
            if (search && !util.isEmptyObject(uri.query)) {
                search = '&' + search.substring(1);
            }
            return url.stringify(uri, c.serializeArray) + search;

        }
    }
);