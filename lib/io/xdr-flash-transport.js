/**
 * @ignore
 * use flash to accomplish cross domain request, usage scenario ? why not jsonp ?
 * @author yiminghe@gmail.com
 */
var util = require('util');
var IO = require('./base'),
    Dom = require('dom');
var // current running request instances
    maps = {},
    ID = 'io_swf',
// flash transporter
    flash,
    doc = document,
// whether create the flash transporter
    init = false;
// needed by flash!
var ioName = util.guid('IO' + (+new Date()));
window[ioName] = IO;
// create the flash transporter
function _swf(uri, _, uid) {
    if (init) {
        return;
    }
    init = true;
    var o = '<object id="' + ID +
            '" type="application/x-shockwave-flash" data="' +
            uri + '" width="0" height="0">' +
            '<param name="movie" value="' +
            uri + '" />' +
            '<param name="FlashVars" value="yid=' +
            _ + '&uid=' +
            uid +
            '&host=' + ioName + '" />' +
            '<param name="allowScriptAccess" value="always" />' +
            '</object>',
        c = doc.createElement('div');
    Dom.prepend(c, doc.body || doc.documentElement);
    c.innerHTML = o;
}

function XdrFlashTransport(io) {
    this.io = io;
}

util.augment(XdrFlashTransport, {
    // rewrite send to support flash xdr
    send: function () {
        var self = this,
            io = self.io,
            c = io.config,
            xdr = c.xdr || {};
        if (!xdr.src) {
            xdr.src = IO._swf;
        }
        // 不提供则使用 cdn 默认的 flash
        _swf(xdr.src, 1, 1);
        // 简便起见，用轮训
        if (!flash) {
            setTimeout(function () {
                self.send();
            }, 200);
            return;
        }
        self._uid = util.guid();
        maps[self._uid] = self;

        // ie67 send 出错？
        flash.send(io._getUrlForSend(), {
            id: self._uid,
            uid: self._uid,
            method: c.type,
            data: c.hasContent && c.data || {}
        });
    },

    abort: function () {
        flash.abort(this._uid);
    },

    _xdrResponse: function (e, o) {
        var self = this,
            ret,
            id = o.id,
            responseText,
            c = o.c,
            io = self.io;

        // need decodeURI to get real value from flash returned value
        if (c && (responseText = c.responseText)) {
            io.responseText = decodeURI(responseText);
        }

        switch (e) {
            case 'success':
                ret = {
                    status: 200,
                    statusText: 'success'
                };
                delete maps[id];
                break;
            case 'abort':
                delete maps[id];
                break;
            case 'timeout':
            case 'transport error':
            case 'failure':
                delete maps[id];
                ret = {
                    status: 'status' in c ? c.status : 500,
                    statusText: c.statusText || e
                };
                break;
        }
        if (ret) {
            io._ioReady(ret.status, ret.statusText);
        }
    }
});

/*called by flash*/
IO.applyTo = function (_, cmd, args) {
    var cmds = cmd.split('.').slice(1),
        func = IO;
    util.each(cmds, function (c) {
        func = func[c];
    });
    func.apply(null, args);
};

// when flash is loaded
IO.xdrReady = function () {
    flash = doc.getElementById(ID);
};

/*
 when response is returned from server
 @param e response status
 @param o internal data
 */
IO.xdrResponse = function (e, o) {
    var xhr = maps[o.uid];
    if (xhr) {
        xhr._xdrResponse(e, o);
    }
};

module.exports = XdrFlashTransport;
