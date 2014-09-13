var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs.extra'));
var path = require('path');

module.exports = function(file, opts) {
    var less = require('less');
    var Autoprefixer = require('autoprefixer');

    if (!opts) opts = {}

    return fs.readFileAsync(file,'UTF-8')
    .then(function(lessContent) {
        var parser = new(less.Parser)({
          paths: [path.dirname(file)],
          filename: path.basename(file)
        });

        var defer = Promise.defer();

        parser.parse(lessContent, function(e,tree) {
            if (e) return defer.reject(e);
            defer.resolve(tree.toCSS({
                sourceMap: !opts.compress,
                compress: opts.compress
            }));
            
        });

        return defer.promise;
    })
    .then(function(unprefixedCSS){
        return Autoprefixer({browsers:["last 2 versions","IE 9"]}).process(unprefixedCSS).css
    })

}
