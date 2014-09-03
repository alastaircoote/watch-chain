var Promise = require('bluebird');
var recursiveReadDir = Promise.promisify(require('recursive-readdir'));
var sane = require('sane');
var path = require('path');
// We use whatever version of minimatch sane is using, since we want
// to match what it is also matching.
var minimatch = require('sane/node_modules/minimatch');
var colors = require('colors');
var tinylr = require('tiny-lr');
var yargs = require('yargs');

WatchChain = function(rootPath, opts) {
    this.rootPath = rootPath;
    this.watches = opts.watch;
    this.tasks = opts.tasks;
    this.steps = opts.steps;

    var task = yargs.argv._[0];

    if (!task) {
        return console.log("You did not define a task to run.".red);
    }
    if (!this.tasks[task]) {
        return console.log(("Task '" + task + "' not found.").red);
    }

    this.tasks[task].apply(this);
}

WatchChain.prototype = {
    processAll: function() {

        var self = this;

        var mappings = [];

        Object.keys(this.watches).map(function(matchString) {
            var funcs = self.watches[matchString];
            if (typeof(funcs) == 'string') funcs = [funcs];

            funcs.forEach(function(func) {
                if (!self.steps[func]) {
                    throw new Error("No such step called " + func);
                }

                // See if the step has already been established- if so we just append to it
                var existing = mappings.filter(function(m){return m.name == func})[0]

                if (existing) {
                    return existing.matchStrings.push(matchString);
                }

                mappings.push({
                    name: func,
                    matchStrings: [matchString],
                    func: self.steps[func],
                    files: []
                })
            })
   
        });

        return recursiveReadDir(this.rootPath,[
            this.rootPath + '/node_modules/**',
            '**/.**',
        ])
        .each(function(file) {
            file = path.relative(self.rootPath,file);

            for (var x = 0; x < mappings.length; x++) {
                var mapping = mappings[x];
                for (var y = 0; y < mapping.matchStrings.length; y++) {
                    if (minimatch(file,mapping.matchStrings[y])) return mapping.files.push(file);
                }
            }
            return false;
            
        })
        .then(function() {
            return Promise.each(mappings, function(mapping) {
                return mapping.func(mapping.files);
            })
        })
        .then(function() {
            console.log('Processing complete.'.green)
        })
        
    },
    watch: function() {
        var self = this;
        return this.processAll()
        .then(function() {
            var paths = Object.keys(self.watches);
            var watcher = sane(self.rootPath, Object.keys(self.watches),{persistent: true});
            
            var processFile = function(filepath, root) {
                Promise.each(paths,function(path){
                    if (!minimatch(filepath, path)) return;
                    console.log('Changed:\t\t'.red + filepath);

                    // If only one
                    if (typeof(self.watches[path]) == 'string') {
                        return self.steps[self.watches[path]]([filepath]);
                    }

                    Promise.each(self.watches[path], function(funcName){
                        self.steps[funcName]([filepath]);
                    });
                    //self.watches[path]([filepath]);
                })
            };

            watcher.on('change', processFile);
            watcher.on('add', processFile);
            watcher.on('delete', processFile);
            console.log('Watching files...'.yellow)
        });
        
    },
    trigger: function(path) {
        console.log('triggered')
        for (key in this.watches) {
            console.log(key,path, minimatch(key,path))
        }
    }
}

WatchChain.liveReload = function(path) {
    tinylr().listen(35729, function() {
        console.log('LiveReload is watching:\t'.green + path)
    });
    var watcher = sane(path,'**/*.*',{persistent:true});
    var notifyChange = function(filepath) {
        console.log('Reloading:\t\t'.yellow + filepath)
        tinylr.changed(filepath);
    };
    watcher.on('change', notifyChange);
    watcher.on('add', notifyChange);
    watcher.on('delete', notifyChange);
}



module.exports = WatchChain;