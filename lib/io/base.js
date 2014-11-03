/**
 * @ignore
 * a scalable client io framework
 * @author yiminghe@gmail.com
 */
var util = require('util');
var querystring = require('querystring');
var XPromise = require('promise');
var url = require('url');
var rlocalProtocol = /^(?:about|app|app\-storage|.+\-extension|file|widget):$/,
    rspace = /\s+/,
    mirror = function (s) {
        return s;
    },
    rnoContent = /^(?:GET|HEAD)$/,
    locationHref = location.href,
    locationUrl = url.parse(locationHref),
    isLocal = rlocalProtocol.test(locationUrl.protocol),
    transports = {},
    defaultConfig = {
        type: 'GET',
        contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
        async: true,
        serializeArray: true,
        processData: true,
        accepts: {
            xml: 'application/xml, text/xml',
            html: 'text/html',
            text: 'text/plain',
            json: 'application/json, text/javascript',
            '*': '*/*'
        },
        converters: {
            text: {
                json: util.parseJson,
                html: mirror,
                text: mirror,
                xml: util.parseXML
            }
        },
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        },
        contents: {
            xml: /xml/,
            html: /html/,
            json: /json/
        }
    };

defaultConfig.converters.html = defaultConfig.converters.text;

function setUpConfig(c) {

    // deep mix,exclude context!
    var context = c.context;
    delete c.context;
    c = util.mix(util.clone(defaultConfig), c, {
        deep: true
    });
    c.context = context || c;

    var data, uri,
        type = c.type,
        dataType = c.dataType;

    uri = c.uri = url.parse(url.resolve(locationHref, c.url), true);

    // see method _getUrlForSend
    uri.query = {};

    if (!('crossDomain' in c)) {
        c.crossDomain = !(uri.protocol === locationUrl.protocol && uri.host === locationUrl.host);
    }

    type = c.type = type.toUpperCase();
    c.hasContent = !rnoContent.test(type);

    if (c.processData && (data = c.data) && typeof data !== 'string') {
        // normalize to string
        c.data = querystring.stringify(data, undefined, undefined, c.serializeArray);
    }

    // 数据类型处理链，一步步将前面的数据类型转化成最后一个
    dataType = c.dataType = util.trim(dataType || '*').split(rspace);

    if (!('cache' in c) && util.inArray(dataType[0], ['script', 'jsonp'])) {
        c.cache = false;
    }

    if (!c.hasContent) {
        if (c.data) {
            util.mix(uri.query, querystring.parse(c.data));
        }
        if (c.cache === false) {
            uri.query._ksTS = util.now() + '_' + util.guid();
        }
    }
    return c;
}

/**
 * Return a io object and send request by config.
 *
 * @class IO
 * @extends Promise
 *
 * @cfg {String} url
 * request destination
 *
 * @cfg {String} type request type.
 * eg: 'get','post'
 * Default to: 'get'
 *
 * @cfg {String} contentType
 * Default to: 'application/x-www-form-urlencoded; charset=UTF-8'
 * Data will always be transmitted to the server using UTF-8 charset
 *
 * @cfg {Object} accepts
 * Default to: depends on DataType.
 * The content type sent in request header that tells the server
 * what kind of response it will accept in return.
 * It is recommended to do so once in the {@link IO#method-setupConfig}
 *
 * @cfg {Boolean} async
 * Default to: true
 * whether request is sent asynchronously
 *
 * @cfg {Boolean} cache
 * Default to: true ,false for dataType 'script' and 'jsonp'
 * if set false,will append _ksTs=Date.now() to url automatically
 *
 * @cfg {Object} contents
 * a name-regexp map to determine request data's dataType
 * It is recommended to do so once in the {@link IO#method-setupConfig}
 *
 * @cfg {Object} context
 * specify the context of this request 's callback (success,error,complete)
 *
 * @cfg {Object} converters
 * Default to: {text:{json:Json.parse,html:mirror,text:mirror,xml:parseXML}}
 * specified how to transform one dataType to another dataType
 * It is recommended to do so once in the {@link IO#method-setupConfig}
 *
 * @cfg {Boolean} crossDomain
 * Default to: false for same-domain request,true for cross-domain request
 * if server-side jsonp redirect to another domain, you should set this to true.
 * if you want use script for jsonp for same domain request, you should set this to true.
 *
 * @cfg {Object} data
 * Data sent to server.if processData is true,data will be serialized to String type.
 * if value is an Array, serialization will be based on serializeArray.
 *
 * @cfg {String} dataType
 * return data as a specified type
 * Default to: Based on server contentType header
 * 'xml' : a XML document
 * 'text'/'html': raw server data
 * 'script': evaluate the return data as script
 * 'json': parse the return data as json and return the result as final data
 * 'jsonp': load json data via jsonp
 *
 * @cfg {Object} headers
 * additional name-value header to send along with this request.
 *
 * @cfg {String} jsonp
 * Default to: 'callback'
 * Override the callback function name in a jsonp request. eg:
 * set 'callback2' , then jsonp url will append  'callback2=?'.
 *
 * @cfg {String} jsonpCallback
 * Specify the callback function name for a jsonp request.
 * set this value will replace the auto generated function name.
 * eg:
 * set 'customCall' , then jsonp url will append 'callback=customCall'
 *
 * @cfg {String} mimeType
 * override xhr 's mime type
 *
 * @cfg {String} ifModified
 * whether enter if modified mode.
 * Defaults to false.
 *
 * @cfg {Boolean} processData
 * Default to: true
 * whether data will be serialized as String
 *
 * @cfg {String} scriptCharset
 * only for dataType 'jsonp' and 'script' and 'get' type.
 * force the script to certain charset.
 *
 * @cfg {Function} beforeSend
 * beforeSend(io,config)
 * callback function called before the request is sent.this function has 2 arguments
 *
 * 1. current KISSY io object
 *
 * 2. current io config
 *
 * note: can be used for add progress event listener for native xhr's upload attribute
 * see <a href='http://www.w3.org/TR/XMLHttpRequest/#event-xhr-progress'>XMLHttpRequest2</a>
 *
 * @cfg {Function} success
 * success(data,textStatus,xhr)
 * callback function called if the request succeeds.this function has 3 arguments
 *
 * 1. data returned from this request with type specified by dataType
 *
 * 2. status of this request with type String
 *
 * 3. io object of this request , for details {@link IO}
 *
 * @cfg {Function} error
 * success(data,textStatus,xhr)
 * callback function called if the request occurs error.this function has 3 arguments
 *
 * 1. null value
 *
 * 2. status of this request with type String,such as 'timeout','Not Found','parsererror:...'
 *
 * 3. io object of this request , for details {@link IO}
 *
 * @cfg {Function} complete
 * success(data,textStatus,xhr)
 * callback function called if the request finished(success or error).this function has 3 arguments
 *
 * 1. null value if error occurs or data returned from server
 *
 * 2. status of this request with type String,such as success:'ok',
 * error:'timeout','Not Found','parsererror:...'
 *
 * 3. io object of this request , for details {@link IO}
 *
 * @cfg {Number} timeout
 * Set a timeout(in seconds) for this request.if will call error when timeout
 *
 * @cfg {Boolean} serializeArray
 * whether add [] to data's name when data's value is array in serialization
 *
 * @cfg {Object} xhrFields
 * name-value to set to native xhr.set as xhrFields:{withCredentials:true}
 * note: withCredentials defaults to true.
 *
 * @cfg {String} username
 * a username tobe used in response to HTTP access authentication request
 *
 * @cfg {String} password
 * a password tobe used in response to HTTP access authentication request
 *
 * @cfg {Object} xdr
 * cross domain request config object, contains sub config:
 *
 * xdr.src
 * Default to: KISSY 's flash url
 * flash sender url
 *
 * xdr.use
 * if set to 'use', it will always use flash for cross domain request even in chrome/firefox
 *
 * xdr.subDomain
 * cross sub domain request config object
 *
 * xdr.subDomain.proxy
 * proxy page, eg:
 * a.t.cn/a.htm send request to b.t.cn/b.htm:
 *
 * 1. a.htm set <code> document.domain='t.cn' </code>
 *
 * 2. b.t.cn/proxy.htm 's content is <code> &lt;script>document.domain='t.cn'&lt;/script> </code>
 *
 * 3. in a.htm , call <code> IO({xdr:{subDomain:{proxy:'/proxy.htm'}}}) </code>
 *
 */
function IO(c) {
    var self = this;

    if (!(self instanceof IO)) {
        return new IO(c);
    }

    // Promise.call(self);
    IO.superclass.constructor.call(self);
    XPromise.Defer(self);

    self.userConfig = c;

    c = setUpConfig(c);

    util.mix(self, {
        // 结构化数据，如 json
        responseData: null,
        /**
         * config of current IO instance.
         * @member IO
         * @property config
         * @type Object
         */
        config: c || {},
        timeoutTimer: null,

        /**
         * String typed data returned from server
         * @type String
         */
        responseText: null,
        /**
         * xml typed data returned from server
         * @type String
         */
        responseXML: null,
        responseHeadersString: '',
        responseHeaders: null,
        requestHeaders: {},
        /**
         * readyState of current request
         * 0: initialized
         * 1: send
         * 4: completed
         * @type Number
         */
        readyState: 0,
        state: 0,
        /**
         * HTTP statusText of current request
         * @type String
         */
        statusText: null,
        /**
         * HTTP Status Code of current request
         * eg:
         * 200: ok
         * 404: Not Found
         * 500: Server Error
         * @type String
         */
        status: 0,
        transport: null
    });

    var TransportConstructor,
        transport;

    /**
     * fired before generating request object
     * @event start
     * @member IO
     * @static
     * @param {IO} e.io current io
     */
    IO.callPreprocessors('start', {
        io: self
    });
    IO.fire('start', {
        io: self
    });

    TransportConstructor = transports[c.dataType[0]] || transports['*'];
    transport = new TransportConstructor(self);

    self.transport = transport;

    if (c.contentType) {
        self.setRequestHeader('Content-Type', c.contentType);
    }

    var dataType = c.dataType[0],
        i,
        timeout = c.timeout,
        context = c.context,
        headers = c.headers,
        accepts = c.accepts;

    // Set the Accepts header for the server, depending on the dataType
    self.setRequestHeader(
        'Accept',
            dataType && accepts[dataType] ?
            accepts[dataType] + (dataType === '*' ? '' : ', */*; q=0.01') :
            accepts['*']
    );

    // Check for headers option
    for (i in headers) {
        self.setRequestHeader(i, headers[i]);
    }

    // allow setup native listener
    // such as xhr.upload.addEventListener('progress', function (ev) {})
    if (c.beforeSend && (c.beforeSend.call(context, self, c) === false)) {
        return self;
    }

    self.readyState = 1;

    /**
     * fired before sending request
     * @event send
     * @member IO
     * @static
     * @param {IO} e.io current io
     */
    IO.callPreprocessors('send', {
        io: self
    });
    IO.fire('send', {
        io: self
    });

    // Timeout
    if (c.async && timeout > 0) {
        self.timeoutTimer = setTimeout(function () {
            self.abort('timeout');
        }, timeout * 1000);
    }

    try {
        // flag as sending
        self.state = 1;
        transport.send();
    } catch (e) {
        if ('@DEBUG@') {
            console.error(e.stack || e);
            setTimeout(function () {
                throw e;
            }, 0);
        }
        // Propagate exception as error if not done
        if (self.state < 2) {
            self._ioReady(0 - 1, e.message || 'send error');
            // Simply rethrow otherwise
        }
    }

    return self;
}

var preprocessors = {};
var events = {};

util.mix(IO, {
    preprocessors: preprocessors,

    events: events,

    addPreprocessor: function (type, callback) {
        var callbacks = preprocessors[type] = preprocessors[type] || [];
        callbacks.push(callback);
        return IO;
    },

    callPreprocessors: function (type, info) {
        var callbacks = (preprocessors[type] || []).concat();
        for (var i = 0, l = callbacks.length; i < l; i++) {
            callbacks[i].call(IO, info);
        }
    },

    on: function (type, callback) {
        var callbacks = events[type] = events[type] || [];
        callbacks.push(callback);
        return IO;
    },

    detach: function (type, callback) {
        if (callback) {
            var list = events[type];
            if (list) {
                var index = util.indexOf(callback, list);
                if (index !== -1) {
                    list.splice(index, 1);
                }
            }
        } else {
            events[type] = [];
        }
    },

    fire: function (type, info) {
        var callbacks = (events[type] || []).concat();
        info = info || {};
        info.type = type;
        info.target = info.currentTarget = IO;
        for (var i = 0, l = callbacks.length; i < l; i++) {
            callbacks[i].call(IO, info);
        }
    },

    /**
     * whether current application is a local application
     * (protocol is file://,widget://,about://)
     * @type {Boolean}
     * @member IO
     * @static
     */
    isLocal: isLocal,
    /**
     * name-value object that set default config value for io class
     * @param {Object} setting
     * @member IO
     * @static
     */
    setupConfig: function (setting) {
        util.mix(defaultConfig, setting, {
            deep: true
        });
    },
    /**
     * @private
     * @member IO
     * @static
     */
    setupTransport: function (name, fn) {
        transports[name] = fn;
    },
    /**
     * @private
     * @member IO
     * @static
     */
    getTransport: function (name) {
        return transports[name];
    },
    /**
     * get default config value for io request
     * @return {Object}
     * @member IO
     * @static
     */
    getConfig: function () {
        return defaultConfig;
    }
});

module.exports = IO;

/*
 // !TODO
 // 去除 event/custom 依赖，用户不载入就不能监听
 // 载入后通过 custom.on(IO,type) 监听

 2014-06-09 yiminghe@gmail.com
 - refactor by url module

 2012-08-16
 - transform IO to class, remove XhrObject class.
 - support ifModified
 - http://bugs.jquery.com/ticket/8394
 - http://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html
 - https://github.com/kissyteam/kissy/issues/203

 2012-07-18 yiminghe@gmail.com
 - refactor by Uri

 2012-2-07 yiminghe@gmail.com
 - 返回 Promise 类型对象，可以链式操作啦！

 2011 yiminghe@gmail.com
 - 借鉴 jquery，优化减少闭包使用
 */
