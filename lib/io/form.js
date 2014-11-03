/**
 * @ignore
 * process form config
 * @author yiminghe@gmail.com
 */

var util = require('util');
var IO = require('./base');
var Dom = require('dom');
var querystring = require('querystring');
var FormSerializer = require('./form-serializer');
var win = window,
    slice = Array.prototype.slice,
/*global FormData:true*/
    FormData = win.FormData;

IO.addPreprocessor('start', function (e) {
    var io = e.io,
        form,
        d,
        dataType,
        formParam,
        data,
        c = io.config,
        tmpForm = c.form;

    // serialize form if needed
    if (tmpForm) {
        form = Dom.get(tmpForm);
        data = c.data;
        var isUpload = false;
        var files = {};

        var inputs = Dom.query('input', form);
        for (var i = 0, l = inputs.length; i < l; i++) {
            var input = inputs[i];
            if (input.type.toLowerCase() === 'file') {
                isUpload = true;
                if (!FormData) {
                    break;
                }
                var selected = slice.call(input.files, 0);
                files[Dom.attr(input, 'name')] = selected.length > 1 ? selected : (selected[0] || null);
            }
        }

        if (isUpload && FormData) {
            c.files = c.files || {};
            util.mix(c.files, files);
            // browser set contentType automatically for FileData
            delete c.contentType;
        }

        // 上传有其他方法
        if (!isUpload || FormData) {
            // when get need encode
            // when FormData exists, only collect non-file type input
            formParam = FormSerializer.getFormData(form);
            if (c.hasContent) {
                formParam = querystring.stringify(formParam, undefined, undefined, c.serializeArray);
                if (data) {
                    c.data += '&' + formParam;
                } else {
                    c.data = formParam;
                }
            } else {
                // get 直接加到 url
                util.mix(c.uri.query, formParam);
            }
        } else {
            // for old-ie
            dataType = c.dataType;
            d = dataType[0];
            if (d === '*') {
                d = 'text';
            }
            dataType.length = 2;
            dataType[0] = 'iframe';
            dataType[1] = d;
        }
    }
});
