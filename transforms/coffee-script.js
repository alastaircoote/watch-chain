var Promise = require('bluebird');
var io = require('../io');
var path = require('path');

module.exports = function(file,outDirectory) {
    var coffeescript = require('coffee-script');

    var basename = path.basename(file,'.coffee')

    return io.readFile(file)
    .then(function (coffee) {
        var compiled = coffeescript.compile(coffee, {
            filename: file,
            sourceMap: true
        });

        var sourceMap = JSON.parse(compiled.v3SourceMap)

        sourceMap.file = basename + '.js'
        sourceMap.sources = [basename + '.coffee']

        compiled.js += "\n\n//# sourceMappingURL=" + basename + ".js.map"

        return Promise.all([
            WatchChain.io.writeFile(path.join(outDirectory, basename + '.coffee'), coffee),
            WatchChain.io.writeFile(path.join(outDirectory, basename + '.js'), compiled.js),
            WatchChain.io.writeFile(path.join(outDirectory, basename + '.js.map'), JSON.stringify(sourceMap))
        ])
    })

    

}