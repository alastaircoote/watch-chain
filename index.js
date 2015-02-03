var Promise = require('bluebird');
Promise.longStackTraces()
var recursiveReadDir = Promise.promisify(require('recursive-readdir'));
var sane = require('sane');
var path = require('path');
// We use whatever version of minimatch sane is using, since we want
// to match what it is also matching.
var minimatch = require('sane/node_modules/minimatch');
var colors = require('colors');
var tinylr = require('tiny-lr');
var yargs = require('yargs');
var events = require('events');


WatchChain = function(rootPath, opts) {
    var self = this;
    this.eventEmitter = new events.EventEmitter();
    this.sigint = this.sigint.bind(this);

    this.rootPath = rootPath;
    this.watches = opts.watch;
    this.tasks = opts.tasks;
    this.transforms = opts.transforms;

    var task = yargs.argv._[0];

    if (!task) {
        return console.log("You did not define a task to run.".red);
    }
    if (!this.tasks[task]) {
        return console.log(("Task '" + task + "' not found.").red);
    }
    this.task = task;
    var result = this.tasks[task].apply(this)
    if (result instanceof Promise) {
        result.catch(function(err) {
            console.log(('Transform "' + err.transformName + '" failed with error:').red)
            console.log(err);
        });
    }

    this.compilers = {}
    for (key in WatchChain.compilers) {
        this.compilers[key] = WatchChain.compilers[key].bind(this);
    }

    
    /*
    process.stdin.on('keypress', function (chunk, key) {
        console.log(arguments);
    });*/
}

WatchChain.prototype = {
    on: function(name) {
        this.eventEmitter.on.apply(this.eventEmitter,arguments);
        if (name == 'before-exit') {
            process.addListener('SIGINT', this.sigint);
        }
    },
    emit: function() {
        this.eventEmitter.emit.apply(this.eventEmitter,arguments);
    },
    sigint: function() {
        process.removeListener('SIGINT', this.sigint);
        this.emit('before-exit');
    },
    exit: function() {
        process.exit();
    },
    process: function(tasks) {
        if (typeof tasks == 'string') {
            tasks = [tasks];
        }
        return this.processAll(tasks);
    },
    processAll: function(tasks) {

        var self = this;

        var mappings = [];

        console.log('Processing all transforms...'.yellow)


        Object.keys(this.watches).map(function(matchString) {
            var funcs = self.watches[matchString];
            if (typeof(funcs) == 'string') funcs = [funcs];

            funcs.forEach(function(func) {
                if (!self.transforms[func]) {
                    throw new Error("No such step called " + func);
                }
                if (tasks && tasks.indexOf(func) == -1) {
                    // We have the option of specifying which tasks we want to run
                    return
                }

                // See if the step has already been established- if so we just append to it
                var existing = mappings.filter(function(m){return m.name == func})[0]

                if (existing) {
                    return existing.matchStrings.push(matchString);
                }

                mappings.push({
                    name: func,
                    matchStrings: [matchString],
                    func: self.transforms[func],
                    files: []
                })
            })
   
        });

        var p = recursiveReadDir(this.rootPath,[
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
            return Promise.map(mappings, function(mapping) {
                //if (mapping.func.resolve) return mapping.func.resolve()
               
                //return Promise.resolve(mapping.func)
                var result = mapping.func.apply(self,[mapping.files, Promise])
                if (result instanceof Promise) {
                    /*result = result.catch(function(err) {
                        err.transformName = mapping.name;
                        throw err;
                    })*/
                    return result.then(function(r) {
                         return {
                            name: mapping.name,
                            result: r
                        }
                    })
                } else {
                    return {
                        name: mapping.name,
                        result: result
                    }
                }
            })
        })
        .then(function(mapResults) {
            console.log('Processing complete.'.green);
            resultsHash = {}
            mapResults.forEach(function(r){
                resultsHash[r.name] = r.result
            });
            return resultsHash;
        })

        return p;
        
    },
    watch: function() {
        var self = this;
        return this.processAll()
        .then(function(mapResults) {
            var paths = Object.keys(self.watches);
            var watcher = sane(self.rootPath, Object.keys(self.watches),{persistent: true});
            
            var processFile = function(filepath, root) {
                Promise.each(paths,function(path){
                    if (!minimatch(filepath, path)) return;
                    console.log('Changed:\t\t'.red + filepath);

                    // If only one
                    if (typeof(self.watches[path]) == 'string') {
                        return self.transforms[self.watches[path]]([filepath],Promise);
                    }

                    Promise.each(self.watches[path], function(funcName){
                        self.transforms[funcName]([filepath],Promise);
                    });
                    //self.watches[path]([filepath]);
                })
            };

            watcher.on('change', processFile);
            watcher.on('add', processFile);
            watcher.on('delete', processFile);
            console.log('Watching files...'.yellow);
            return mapResults;
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
    this.notifyChange = function(filepath) {
        console.log('Reloading:\t\t'.yellow + filepath)
        tinylr.changed(filepath);
    };
    watcher.on('change', this.notifyChange);
    watcher.on('add', this.notifyChange);
    watcher.on('delete', this.notifyChange);
}

WatchChain.liveReload.jsSnippet = '<script>document.write(\'<script src="http://\' + (location.host || \'localhost\').split(\':\')[0] + \':35729/livereload.js?snipver=1"></\' + \'script>\')</script>'

WatchChain.compilers = {
    less: require('./transforms/less'),
    coffeescript: require('./transforms/coffee-script'),
    handlebars: require('./transforms/handlebars')
};

WatchChain.io = require('./io');
WatchChain.s3 = require('./aws');

WatchChain.exec = function(path) {
    var child = require('child_process').exec(path);
    child.stdout.pipe(process.stdout);
}

WatchChain.execModule = function(path,args) {
    return require('child_process').fork(path,args);
    //child.stdout.pipe(process.stdout);
}


module.exports = WatchChain;