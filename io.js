var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs.extra'));
var path = require('path');
var recursiveReadDir = Promise.promisify(require('recursive-readdir'));
var minimatch = require('sane/node_modules/minimatch');
var crypto = require('crypto');

module.exports = {
    appendToFilename: function(pathToWrite, toAppend) {
        var dirToWrite = path.dirname(pathToWrite);
        var extToWrite = path.extname(pathToWrite);
        var baseName = path.basename(pathToWrite,extToWrite)
        return path.join(dirToWrite,baseName + '-' + toAppend + extToWrite)
    },
    sha: function(content, versionVal) {
        var shasum = crypto.createHash('sha1')
        shasum.update(content);
        if (versionVal) {
            shasum.update(versionVal);
        }
        return shasum.digest('hex');
    },
    writeFile: function(pathToWrite, content, options) {
        options = options || {}
        if (options.sha) {
            var sha = module.exports.sha(content,options.shaVersion);
            pathToWrite = module.exports.appendToFilename(pathToWrite,sha);
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
    copy: function(srcPath, destPath, options) {
        options = options || {};
        if (!options.sha) {
            // Don't need to do anything fancy
            return fs.copyRecursiveAsync(srcPath, destPath)
            .then(function() {
                return recursiveReadDir(srcPath,['.*'])
            })
        }

        var shaAndCopy = function(p) {
            var relative = path.relative(srcPath, p);
            return fs.readFileAsync(p)
            .then(function(contents){
                var sha = module.exports.sha(contents,options.shaVersion);
                var destFile = module.exports.appendToFilename(relative,sha);
                var fullPath = path.join(destPath,destFile);
                var destDir = path.dirname(fullPath);
                return fs.mkdirpAsync(destDir)
                .then(function() {
                    return fs.writeFileAsync(fullPath,contents);
                })
                .then(function() {
                    return fullPath;
                })
            })
        }

        return recursiveReadDir(srcPath,['.*'])
        .map(function(file){
            return shaAndCopy(file);
        })
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