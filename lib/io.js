/**
 * @ignore
 * io shortcut
 * @author yiminghe@gmail.com
 */

var serializer = require('./io/form-serializer');
var IO = require('./io/base');
var util = require('util');
require('./io/xhr-transport');
require('./io/script-transport');
require('./io/jsonp');
require('./io/form');
require('./io/iframe-transport');
require('./io/methods');

function get(url, data, callback, dataType, type) {
    // data 参数可省略
    if (typeof data === 'function') {
        dataType = callback;
        callback = data;
        data = undefined;
    }

    return IO({
        type: type || 'get',
        url: url,
        data: data,
        complete: callback,
        dataType: dataType
    });
}

// some shortcut
util.mix(IO, {
    version: '@VERSION@',
    
    _swf: require.toUrl('./io.swf'),

    serialize: serializer.serialize,

    getFormData: serializer.getFormData,

    /**
     * perform a get request
     * @method
     * @param {String} url request destination
     * @param {Object} [data] name-value object associated with this request
     * @param {Function} [callback] success callback when this request is done
     * @param callback.data returned from this request with type specified by dataType
     * @param {String} callback.status status of this request with type String
     * @param {IO} callback.io io object of this request
     * @param {String} [dataType] the type of data returns from this request
     * ('xml' or 'json' or 'text')
     * @return {IO}
     * @member IO
     * @static
     */
    get: get,

    /**
     * preform a post request
     * @param {String} url request destination
     * @param {Object} [data] name-value object associated with this request
     * @param {Function} [callback] success callback when this request is done.
     * @param callback.data returned from this request with type specified by dataType
     * @param {String} callback.status status of this request with type String
     * @param {IO} callback.io io object of this request
     * @param {String} [dataType] the type of data returns from this request
     * ('xml' or 'json' or 'text')
     * @return {IO}
     * @member IO
     * @static
     */
    post: function (url, data, callback, dataType) {
        if (typeof data === 'function') {
            dataType = /**
             @type String
             @ignore*/callback;
            callback = data;
            data = undefined;
        }
        return get(url, data, callback, dataType, 'post');
    },

    /**
     * preform a jsonp request
     * @param {String} url request destination
     * @param {Object} [data] name-value object associated with this request
     * @param {Function} [callback] success callback when this request is done.
     * @param callback.data returned from this request with type specified by dataType
     * @param {String} callback.status status of this request with type String
     * @param {IO} callback.io io object of this request
     * @return {IO}
     * @member IO
     * @static
     */
    jsonp: function (url, data, callback) {
        if (typeof data === 'function') {
            callback = data;
            data = undefined;
        }
        return get(url, data, callback, 'jsonp');
    },

    // 和 S.getScript 保持一致
    // 更好的 getScript 可以用
    /*
     IO({
     dataType:'script'
     });
     */
    getScript: require.load,

    /**
     * perform a get request to fetch json data from server
     * @param {String} url request destination
     * @param {Object} [data] name-value object associated with this request
     * @param {Function} [callback] success callback when this request is done.@param callback.data returned from this request with type specified by dataType
     * @param {String} callback.status status of this request with type String
     * @param {IO} callback.io io object of this request
     * @return {IO}
     * @member IO
     * @static
     */
    getJSON: function (url, data, callback) {
        if (typeof data === 'function') {
            callback = data;
            data = undefined;
        }
        return get(url, data, callback, 'json');
    },

    /**
     * submit form without page refresh
     * @param {String} url request destination
     * @param {HTMLElement|Node} form element tobe submited
     * @param {Object} [data] name-value object associated with this request
     * @param {Function} [callback]  success callback when this request is done.@param callback.data returned from this request with type specified by dataType
     * @param {String} callback.status status of this request with type String
     * @param {IO} callback.io io object of this request
     * @param {String} [dataType] the type of data returns from this request
     * ('xml' or 'json' or 'text')
     * @return {IO}
     * @member IO
     * @static
     */
    upload: function (url, form, data, callback, dataType) {
        if (typeof data === 'function') {
            dataType = /**
             @type String
             @ignore
             */callback;
            callback = data;
            data = undefined;
        }
        return IO({
            url: url,
            type: 'post',
            dataType: dataType,
            form: form,
            data: data,
            complete: callback
        });
    }
});

module.exports = IO;
