var path        = require('path'),
    KevScript   = require('kevoree-kevscript'),
    fs          = require('fs');

module.exports = function (options, callback) {
    if (options.model) {
        if (options.model.findNodesByID(options.nodeName)) {
            callback(null, options.model);
        } else {
            callback(new Error('Unable to find node instance "'+options.nodeName+'" in given model.'));
        }
    } else {
        // generates a default model using lib/defaultModel.kevs.mustache
        var defaultModel = fs.readFile(path.resolve(__dirname, 'defaultModel.kevs.mustache'), 'utf8', function (err, data) {
            if (err) {
                callback(err);
            } else {
                data = data
                    .replace(/{{nodeName}}/g,  options.nodeName)
                    .replace(/{{groupName}}/g, options.groupName)
                    .replace(/{{groupPort}}/g, options.groupPort)
                    .replace(/{{logLevel}}/g,  options.logLevel);
                options.logger.warn('No bootstrap model given, using:\n'+data);

                var kevs = new KevScript();
                kevs.parse(data, callback);
            }
        });
    }
};