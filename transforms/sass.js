var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs.extra'));
var path = require('path');

module.exports = function(file, opts) {
    var self = this;
    if (this.rootPath) {
        file = path.join(this.rootPath,file);
    }
    
    if (!opts) opts = {};

    return fs.readFileAsync(file,'UTF-8')
    .then(function(lessContent) {
        opts.path = file
        return module.exports.raw(lessContent, opts);
    })
}

module.exports.raw = function(sassContent, opts) {
    var sass = require('node-sass');
    var Autoprefixer = require('autoprefixer');
    return new Promise(function(fullfill,reject) {

        return sass.renderSync({
            data: sassContent,
            includePaths: [path.dirname(opts.path)]
        })

    })
    .then(function(unprefixedCSS){
        return Autoprefixer({browsers:["last 2 versions","IE 9"]}).process(unprefixedCSS).css
    })
}
