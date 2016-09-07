'use strict';

var path = require('path'),
  fs = require('fs');

module.exports = function (kevs, options, callback) {
  if (options.model) {
    if (options.model.findNodesByID(options.nodeName)) {
      callback(null, options.model);
    } else {
      callback(new Error('Unable to find node instance "' + options.nodeName + '" in given model.'));
    }
  } else {
    // generates a default model using lib/defaultModel.kevs.mustache
    fs.readFile(path.resolve(__dirname, 'defaultModel.kevs.mustache'), 'utf8', function (err, data) {
      if (err) {
        callback(err);
      } else {
        data = data
          .replace(/{{nodeName}}/g, options.nodeName)
          .replace(/{{groupName}}/g, options.groupName)
          .replace(/{{groupPort}}/g, options.groupPort);
        if (options.logLevel) {
          data += 'set {{nodeName}}.logLevel = \'{{logLevel}}\''
            .replace(/{{nodeName}}/g, options.nodeName)
            .replace(/{{logLevel}}/g, options.logLevel);
        }
        options.logger.warn('No bootstrap model given, using:\n' + data);
        kevs.parse(data, callback);
      }
    });
  }
};
