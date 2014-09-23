/**
 * @ignore
 * io xhr transport class, route subdomain, xdr
 * @author yiminghe@gmail.com
 */

var util = require('util');
var IO = require('./base'),
    XhrTransportBase = require('./xhr-transport-base'),
    XdrFlashTransport = require('./xdr-flash-transport'),
    SubDomainTransport = require('./sub-domain-transport');
var doc = document,
    XDomainRequest_ = XhrTransportBase.XDomainRequest_;

// express: subdomain offset
function isSubDomain(hostname) {
    // phonegap does not have doc.domain
    return doc.domain && util.endsWith(hostname, doc.domain);
}

/**
 * @class
 * @ignore
 */
function XhrTransport(io) {
    var c = io.config,
        crossDomain = c.crossDomain,
        self = this,
        xhr,
        xdrCfg = c.xdr || {},
        subDomain = xdrCfg.subDomain = xdrCfg.subDomain || {};

    self.io = io;

    if (crossDomain && !XhrTransportBase.supportCORS) {
        // 跨子域
        if (isSubDomain(c.uri.hostname)) {
            // force to not use sub domain transport
            if (subDomain.proxy !== false) {
                return new SubDomainTransport(io);
            }
        }

        /*
         ie>7 通过配置 use='flash' 强制使用 flash xdr
         使用 withCredentials 检测是否支持 CORS
         http://hacks.mozilla.org/2009/07/cross-site-xmlhttprequest-with-cors/
         */
        if ((String(xdrCfg.use) === 'flash' || !XDomainRequest_)) {
            return new XdrFlashTransport(io);
        }
    }

    xhr = self.nativeXhr = XhrTransportBase.nativeXhr(crossDomain);
    return self;
}

util.augment(XhrTransport, XhrTransportBase.proto, {
    send: function () {
        this.sendInternal();
    }
});

IO.setupTransport('*', XhrTransport);
/*
 2012-11-28 note ie port problem:
 - ie 的 xhr 可以跨端口发请求，例如 localhost:8888 发请求到 localhost:9999
 - ie iframe 间访问不设置 document.domain 完全不考虑 port！
 - localhost:8888 访问 iframe 内的 localhost:9999

 CORS : http://www.nczonline.net/blog/2010/05/25/cross-domain-io-with-cross-origin-resource-sharing/
 */