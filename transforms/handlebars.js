var Handlebars = require('handlebars');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs.extra'));
var io = require('../io');
var path = require('path');

var processHandlebars = function(file, data, opts) {
    var self = this;
    if (this.rootPath) {
        file = path.join(this.rootPath,file);
    }
    opts = opts || {};
    return io.readFile(file)
    .then(function(templateContents){

        return new Promise(function(fulfill){
            if (!opts.partials) {
                return fulfill(true);
            }
            partialKeys = Object.keys(opts.partials);
            fulfill(Promise.each(partialKeys, function(key) {
                return io.readFile(opts.partials[key])
                .then(function(content){
                    Handlebars.registerPartial(key,content);
                })
            }));
        })
        .then(function() {
            var compiled = Handlebars.compile(templateContents);

            var rendered = compiled(data);

            if (!opts.layout) {
                return rendered;
            } else {
                var layoutPath = path.join(opts.viewsDir,'layouts',opts.layout);
                if (self.rootPath) {
                    layoutPath = path.join(self.rootPath, layoutPath);
                }
                data.template_page_body__ = rendered;
                return processHandlebars(layoutPath,data)
            }
        })



        
    })
};


module.exports = processHandlebars;