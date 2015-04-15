var AWS = require('aws-sdk');
var Promise = require('bluebird');
var minimatch = require('sane/node_modules/minimatch');
var recursiveReadDir = Promise.promisify(require('recursive-readdir'));
var zlib = Promise.promisifyAll(require('zlib'));
var path = require('path');
var fs = Promise.promisifyAll(require('fs.extra'));
var mime = require('mime');

module.exports = {
    upload: function(opts) {
        var s3 = Promise.promisifyAll(new AWS.S3({
            accessKeyId: opts.creds.key,
            secretAccessKey: opts.creds.secret
        }));

        return recursiveReadDir(opts.dir)
        .map(function(file) {
            var matchedFileType = null;
            for (key in opts.fileTypes) {
                var match = minimatch(file,key);
                if (!match) continue;

                if (matchedFileType) {
                    throw new Error("File matches more than one file type.");
                }
                matchedFileType = opts.fileTypes[key];
            }
            return {
                path: file,
                fileType: matchedFileType
            }
        })
        .filter(function(file){
            return file.fileType != null;
        })
        .each(function(file) {
            return fs.readFileAsync(file.path)
            .then(function(contents) {
                if (!file.fileType.gzip) {
                    return contents;
                }
                return zlib.gzipAsync(contents);
            })
            .then(function(contents) {
                var relativePath = path.relative(opts.dir,file.path);
                var destinationPath = path.join(opts.keyPrefix, relativePath);
                var params = {
                    Bucket: opts.bucket,
                    Key: destinationPath,
                    Body: contents,
                    ACL: 'public-read',
                    ContentType: mime.lookup(file.path)
                    
                };
                if (file.fileType.maxAge == -1) {
                    params.CacheControl = 'no-cache, no-store, must-revalidate'
                } else {
                    params.CacheControl = 'public, max-age=' + file.fileType.maxAge
                }
                if (file.fileType.gzip) {
                    params.ContentEncoding = 'gzip';
                }
                console.log(("Putting " + relativePath + "...").yellow)
                return s3.putObjectAsync(params);
            })
            
        }).then(function() {
            console.log(("Upload to S3 complete.").green)
        })
    }
}