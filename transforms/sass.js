var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs.extra'));
var path = require('path');

module.exports = function(file, opts) {
    var self = this;
    if (this.rootPath) {
        file = path.join(this.rootPath,file);
    }
    
    if (!opts) opts = {};

    var sass = require('node-sass');
    var Autoprefixer = require('autoprefixer');

    return new Promise(function(fullfill,reject) {
        return sass.render({
            file: file,
            success: fullfill,
            error: reject
        });
    })
    /*.catch(function(error){
        console.log(error)
    })*/
    .then(function(unprefixedCSS){
        return Autoprefixer({browsers:["last 2 versions","IE 9"]}).process(unprefixedCSS.css).css
    });

}
