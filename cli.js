#!/usr/bin/env node
var NodeJSRuntime = require('./lib/NodeJSRuntime'),
    KevoreeLogger = require('kevoree-commons').KevoreeLogger,
    path          = require('path'),
    os            = require('os'),
    fs            = require('fs'),
    kevoree       = require('kevoree-library').org.kevoree,
    NPMResolver   = require('kevoree-resolvers').NPMResolver,
    KevScript     = require('kevoree-kevscript'),
    optimist      = require('optimist');

var argv = optimist
    .usage('Usage: $0 [--nodeName node0 --groupName sync (--groupPort 9000) (--model path/to/your/model.json | --kevscript path/to/your/model.kevs) --modulesPath . --logLevel info]')
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
    .default('p', os.tmpdir())
    .default('l', 'info')
    .describe('nodeName', 'Name of this runtime node platform')
    .describe('groupName', 'Name of the group your node platform is related to')
    .describe('groupPort', 'Port number to bind node to group')
    .describe('model', 'A JSON model to bootstrap on')
    .describe('kevscript', 'A KevScript model to bootstrap on')
    .describe('ctxVar', 'A context variable to replace a %NAME% in the script (usage: --ctxVar NAME=foo)')
    .describe('modulesPath', 'Where to install resolved deploy units')
    .describe('logLevel', 'Level of the logger before node platform starts (all|debug|info|warn|error|quiet)')
    .describe('help', 'Displays this help')
    .describe('version', 'Displays Kevoree Node.js Runtime version');

var logLevel;
if (argv.argv.help) {
    console.log(argv.help());
} else if (argv.argv.version) {
    console.log(require('./package.json').version);
} else {
    argv = argv.argv;
    var log = new KevoreeLogger('NodeJSRuntime');
    switch (argv.logLevel.toLowerCase()) {
        case 'all':
            log.setLevel(KevoreeLogger.ALL);
            logLevel = 'all';
            break;

        case 'debug':
            log.setLevel(KevoreeLogger.DEBUG);
            logLevel = 'debug';
            break;

        default:
        case 'info':
            log.setLevel(KevoreeLogger.INFO);
            logLevel = 'info';
            break;

        case 'warn':
            log.setLevel(KevoreeLogger.WARN);
            logLevel = 'warn';
            break;

        case 'error':
            log.setLevel(KevoreeLogger.ERROR);
            logLevel = 'error';
            break;

        case 'quiet':
            log.setLevel(KevoreeLogger.QUIET);
            logLevel = 'quiet';
            break;
    }

    var resolver = new NPMResolver(argv.modulesPath, log);
    var runtime = new NodeJSRuntime(argv.modulesPath, log, resolver);
    var factory  = new kevoree.factory.DefaultKevoreeFactory();
    var loader   = factory.createJSONLoader();

    // runtime error handler
    var errorHandler = function () {
        log.error('Platform shut down.');
        runtime.stop();
        process.exit(1);
    };

    runtime.once('deployError', errorHandler);
    runtime.once('adaptationError', errorHandler);

    runtime.on('stopped', function () {
        process.exit(0);
    });

    runtime.once('deployed', function deployHandler() {
        runtime.off('deployed', deployHandler);
        runtime.off('deployError', errorHandler);
        runtime.off('adaptationError', errorHandler);
    });

    // read the model to deploy
    if (argv.kevscript && argv.kevscript.length > 0) {
        // try with --kevscript param
        fs.readFile(argv.kevscript, 'utf8', function (err, text) {
            if (err) {
                log.error(err.message);
                errorHandler();
            } else {
                var ctxVars = {};
                if (argv.ctxVar) {
                    if (argv.ctxVar.constructor === Array) {
                        argv.ctxVar.forEach(function (ctxvar) {
                            var data = ctxvar.split('=');
                            ctxVars[data[0]] = data[1];
                        });
                    } else {
                        var data = argv.ctxVar.split('=');
                        ctxVars[data[0]] = data[1];
                    }
                }
                var kevs = new KevScript();
                kevs.parse(text, null, ctxVars, function (err, model) {
                    if (err) {
                        log.error('Unable to load Kevoree KevScript: '+err.message);
                        log.error('Platform shut down.');
                        process.exit(1);
                    } else {
                        var keys = Object.keys(ctxVars);
                        if (keys.length > 0) {
                            var strCtxVars = '';
                            keys.forEach(function (key, i) {
                                strCtxVars += key+'='+ctxVars[key];
                                if (i < keys.length -1) {
                                    strCtxVars += ', ';
                                }
                            });
                            log.debug('KevScript context variables: '+strCtxVars);
                        }
                        // start kevoree core
                        var nodeName = argv.nodeName;
                        if (argv.nodeName.startsWith('%%') && argv.nodeName.endsWith('%%')) {
                            nodeName = ctxVars[argv.nodeName.substring(2, argv.nodeName.length-2)];
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
                log.error('Unable to load Kevoree JSON model: '+err.message);
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
