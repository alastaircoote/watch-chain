var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs.extra'));
var path = require('path');
var recursiveReadDir = Promise.promisify(require('recursive-readdir'));
var minimatch = require('sane/node_modules/minimatch');

module.exports = {
    writeFile: function(pathToWrite, content) {
        return fs.mkdirpAsync(path.dirname(pathToWrite))
        .then(function() {
            return fs.writeFileAsync(pathToWrite,content);
        })
    },
    readFile: function(path, encoding) {
        if (!encoding) encoding = 'UTF-8'
        return fs.readFileAsync(path,encoding);
    },
    listRecursive: function(pathToList,selector) {
        return recursiveReadDir(pathToList,[
            'node_modules/**',
            '**/.**',
        ]).filter(function(file){
            return minimatch(file,selector);
        }).map(function(file) {
            return path.relative(pathToList,file);
        })
    },
    'copy': function(srcPath, destPath) {
        return fs.mkdirpAsync(path.dirname(destPath))
        .then(function() {
            return fs.copyAsync(srcPath, destPath)
        });
    }
}