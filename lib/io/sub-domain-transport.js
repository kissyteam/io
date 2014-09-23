/**
 * @ignore
 * solve io between sub domains using proxy page
 * @author yiminghe@gmail.com
 */
var util = require('util');
var DomEvent = require('event-dom'),
    url = require('url'),
    Dom = require('dom'),
    XhrTransportBase = require('./xhr-transport-base');
var PROXY_PAGE = '/sub_domain_proxy.html',
    doc = document,
// hostname:{iframe: , ready:}
    iframeMap = {};

function SubDomainTransport(io) {
    var self = this,
        c = io.config;
    self.io = io;
    c.crossDomain = false;
}

util.augment(SubDomainTransport, XhrTransportBase.proto, {
    // get nativeXhr from iframe document
    // not from current document directly like XhrTransport
    send: function () {
        var self = this,
            c = self.io.config,
            uri = c.uri,
            hostname = uri.hostname,
            iframe,
            iframeUri,
            iframeDesc = iframeMap[hostname];

        var proxy = PROXY_PAGE;

        if (c.xdr && c.xdr.subDomain && c.xdr.subDomain.proxy) {
            proxy = c.xdr.subDomain.proxy;
        }

        if (iframeDesc && iframeDesc.ready) {
            self.nativeXhr = XhrTransportBase.nativeXhr(0, iframeDesc.iframe.contentWindow);
            if (self.nativeXhr) {
                self.sendInternal();
            } else {
                console.error('io: document.domain not set correctly!');
            }
            return;
        }

        if (!iframeDesc) {
            iframeDesc = iframeMap[hostname] = {};
            iframe = iframeDesc.iframe = doc.createElement('iframe');
            Dom.css(iframe, {
                position: 'absolute',
                left: '-9999px',
                top: '-9999px'
            });
            Dom.prepend(iframe, doc.body || doc.documentElement);
            iframeUri = {};
            iframeUri.protocol = uri.protocol;
            iframeUri.host = uri.host;
            iframeUri.pathname = proxy;
            iframe.src = url.stringify(iframeUri);
        } else {
            iframe = iframeDesc.iframe;
        }

        DomEvent.on(iframe, 'load', _onLoad, self);

    }
});

function _onLoad() {
    var self = this,
        c = self.io.config,
        uri = c.uri,
        hostname = uri.hostname,
        iframeDesc = iframeMap[hostname];
    iframeDesc.ready = 1;
    DomEvent.detach(iframeDesc.iframe, 'load', _onLoad, self);
    self.send();
}

module.exports = SubDomainTransport;
