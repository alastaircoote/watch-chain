var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs.extra'));
var path = require('path');
var recursiveReadDir = Promise.promisify(require('recursive-readdir'));
var minimatch = require('sane/node_modules/minimatch');
var crypto = require('crypto');

var createSHA = function(content) {
    var shasum = crypto.createHash('sha1')
    shasum.update(content);
    return shasum.digest('hex');
}

module.exports = {
    writeFile: function(pathToWrite, content, options) {
        options = options || {}
        if (options.sha) {
            var sha = createSHA(content);
            dirToWrite = path.dirname(pathToWrite);
            extToWrite = path.extname(pathToWrite);
            baseName = path.basename(pathToWrite,extToWrite)
            pathToWrite = path.join(dirToWrite,baseName + '-' + sha + extToWrite)
        }
        return fs.mkdirpAsync(path.dirname(pathToWrite))
        .then(function() {
            return fs.writeFileAsync(pathToWrite,content);
        }).then(function() {
            return pathToWrite;
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
        return fs.copyRecursiveAsync(srcPath, destPath)
        /*
        return fs.statAsync(srcPath)
        .then(function(stat) {
            console.log(stat.isFile());
            if (stat.isFile()) {
                destPath = path.dirname(destPath);
            }

            //return fs.mkdirpAsync(destPath)
            //.then(function() {
                console.log(srcPath,destPath)
                
            //});
        })
        */
       
    },
    rmrf: function(path) {
        return fs.removeAsync(path);
    }
}