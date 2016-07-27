#!/usr/bin/env node

'use strict';

var NodeJSRuntime = require('./lib/NodeJSRuntime'),
  KevoreeLogger = require('kevoree-commons').KevoreeLogger,
  path = require('path'),
  os = require('os'),
  fs = require('fs'),
  nconf = require('kevoree-nconf'),
  kevoree = require('kevoree-library'),
  NPMResolver = require('kevoree-resolvers').NPMResolver,
  KevScript = require('kevoree-kevscript'),
  mkdirp = require('mkdirp'),
  optimist = require('optimist');

var argv = optimist
  .usage('Usage: $0 [--nodeName node0 --groupName sync (--groupPort 9000) (--model path/to/your/model.json | --kevscript path/to/your/model.kevs) --modulesPath where/to/install/modules --logLevel info]')
  .alias('n', 'nodeName')
  .alias('g', 'groupName')
  .alias('gp', 'groupPort')
  .alias('m', 'model')
  .alias('k', 'kevscript')
  .alias('p', 'modulesPath')
  .alias('l', 'logLevel')
  .alias('h', 'help')
  .alias('v', 'version')
  .default('n', 'node0')
  .default('g', 'sync')
  .default('gp', 9000)
  .default('p', path.join(os.homedir(), '.kevoree'))
  .default('l', 'info')
  .describe('nodeName', 'Name of this runtime node platform')
  .describe('groupName', 'Name of the group your node platform is related to')
  .describe('groupPort', 'Port number to bind node to group')
  .describe('model', 'A JSON model to bootstrap on')
  .describe('kevscript', 'A KevScript model to bootstrap on')
  .describe('ctxVar', 'A context variable to replace a %NAME% in the script (usage: --ctxVar NAME=foo)')
  .describe('modulesPath', 'Where to install resolved deploy units')
  .describe('log.level', 'Level of the logger before node platform starts (all|debug|info|warn|error|quiet)')
  .describe('registry.host', 'Kevoree registry hostname to use (default: registry.kevoree.org)')
  .describe('registry.port', 'Kevoree registry port to use (default: 80)')
  .describe('registry.ssl', 'Is the registry available over HTTPS or HTTP? (default: HTTPS)')
  .describe('help', 'Displays this help')
  .describe('version', 'Displays Kevoree Node.js Runtime version');

var HOME_DIR = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
var KREGRC_PATH = path.resolve(HOME_DIR, '.kregrc.json');
nconf.argv({ 'registry.ssl': { type: 'boolean' } }).file(KREGRC_PATH).use('memory');

var logLevel;
if (argv.argv.help) {
  process.stdout.write(argv.help());
} else if (argv.argv.version) {
  process.stdout.write(require('./package.json').version);
} else {
  argv = argv.argv;
  var log = new KevoreeLogger('Runtime');
  var logLevel = nconf.get('log:level');
  if (logLevel) {
    log.setLevel(logLevel);
  }

  mkdirp(argv.modulesPath, function (err) {
    if (err) {
      throw err;
    } else {
      var kevs = new KevScript(log, new KevScript.cache.MemoryCache());
      var resolver = new NPMResolver(argv.modulesPath, log);
      var runtime = new NodeJSRuntime(argv.modulesPath, log, resolver, kevs);
      var factory = new kevoree.factory.DefaultKevoreeFactory();
      var loader = factory.createJSONLoader();

      var ctxModel = factory.createContainerRoot();
      try {
        var rootModulesPath = path.resolve(argv.modulesPath, 'node_modules');
        var dirs = fs.readdirSync(rootModulesPath);
        var compare = factory.createModelCompare();
        dirs.forEach(function(dir) {
          try {
            var dirModelStr = fs.readFileSync(path.resolve(rootModulesPath, dir, 'kevlib.json'), {
              encoding: 'utf8'
            });
            var dirModel = loader.loadModelFromString(dirModelStr).get(0);
            compare.merge(ctxModel, dirModel).applyOn(ctxModel);
          } catch (err) { /* ignore */ }
        });
      } catch (err) { /* ignore */ }

      // runtime error handler
      var errorHandler = function() {
        log.error('Platform shut down.');
        runtime.stop();
        process.exit(1);
      };

      runtime.on('stopped', function() {
        process.exit(0);
      });

      runtime.on('error', function (err) {
        log.error(err.stack);
      });

      // read the model to deploy
      if (argv.kevscript && argv.kevscript.length > 0) {
        // try with --kevscript param
        fs.readFile(argv.kevscript, 'utf8', function(err, text) {
          if (err) {
            log.error(err.message);
            errorHandler();
          } else {
            var ctxVars = {};
            if (argv.ctxVar) {
              if (argv.ctxVar.constructor === Array) {
                argv.ctxVar.forEach(function(ctxvar) {
                  var data = ctxvar.split('=');
                  ctxVars[data[0]] = data[1];
                });
              } else {
                var data = argv.ctxVar.split('=');
                ctxVars[data[0]] = data[1];
              }
            }
            kevs.parse(text, ctxModel, ctxVars, function(err, model) {
              if (err) {
                log.error('Unable to load Kevoree KevScript: ' + err.message);
                log.error('Platform shut down.');
                process.exit(1);
              } else {
                var keys = Object.keys(ctxVars);
                if (keys.length > 0) {
                  var strCtxVars = '';
                  keys.forEach(function(key, i) {
                    strCtxVars += key + '=' + ctxVars[key];
                    if (i < keys.length - 1) {
                      strCtxVars += ', ';
                    }
                  });
                  log.debug('KevScript context variables: ' + strCtxVars);
                }
                // start kevoree core
                var nodeName = argv.nodeName;
                if (argv.nodeName.startsWith('%%') && argv.nodeName.endsWith('%%')) {
                  nodeName = ctxVars[argv.nodeName.substring(2, argv.nodeName.length - 2)];
                }
                runtime.start(nodeName, argv.groupName, argv.groupPort, logLevel);
                // deploy the model
                runtime.deploy(model);
              }
            });
          }
        });

      } else {
        // try with --model param
        if (argv.model && argv.model.length > 0) {
          var modelPath = path.resolve(argv.model);
          try {
            var model = loader.loadModelFromString(fs.readFileSync(modelPath, 'utf8')).get(0);
            // start kevoree core
            runtime.start(argv.nodeName, argv.groupName, argv.groupPort, logLevel);
            // deploy the model
            runtime.deploy(model);
          } catch (err) {
            log.error('Unable to load Kevoree JSON model: ' + err.message);
            errorHandler();
          }
        } else {
          // start kevoree core
          runtime.start(argv.nodeName, argv.groupName, argv.groupPort, logLevel);
          // deploy null model => it will create a default one
          runtime.deploy();
        }
      }
    }
  });
}
