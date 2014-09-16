var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs.extra'));
var path = require('path');


module.exports = {
    writeFile: function(pathToWrite, content) {
        return fs.mkdirpAsync(path.dirname(pathToWrite))
        .then(function() {
            return fs.writeFileAsync(pathToWrite,content);
        })
    },
    readFile: function(path) {
        return fs.readFileAsync(path,'UTF-8');
    }
}