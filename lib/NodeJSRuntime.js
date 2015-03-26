var Class         = require('pseudoclass'),
    KevoreeCore     = require('kevoree-core'),
    Bootstrapper    = require('kevoree-commons').Bootstrapper,
    bootstrapHelper = require('./bootstrapHelper'),
    path            = require('path'),
    EventEmitter    = require('events').EventEmitter;

var firstSIGINT = true,
    coreStarted = false,
    deploying = false,
    wannaStop = false;

var NodeJSRuntime = Class({
    toString: 'NodeJSRuntime',

    construct: function (modulesPath, logger, resolver) {
        this.modulesPath = modulesPath || path.resolve(__dirname, '..');
        this.log = logger;
        this.kCore = new KevoreeCore(this.modulesPath, this.log);
        this.bootstrapper = new Bootstrapper(this.log, resolver);
        this.nodename = 'node0'; // default nodename
        this.groupname = 'sync'; // default groupname
        this.groupport = 9000; // default grouport
        this.emitter = new EventEmitter();
        this.model = null;
    },

    init: function () {
        this.kCore.setBootstrapper(this.bootstrapper);
        var self = this;

        // kevoree core started event listener
        this.kCore.on('started', function () {
            coreStarted = true;
            self.emitter.emit('started');
        });

        this.kCore.on('deploying', function () {
            deploying = true;
        });

        this.kCore.on('deployError', function () {
            deploying = false;
            self.emitter.emit('deployError');
        });

        // kevoree core deployed event listener
        this.kCore.on('deployed', function (model) {
            deploying = false;
            firstSIGINT = true;
            if (wannaStop) {
                wannaStop = false;
                self.kCore.stop();
            }
            self.emitter.emit('deployed', model);
        });

        // kevoree core error event listener
        this.kCore.on('error', function (err) {
            self.emitter.emit('error', err);
        });

        this.kCore.on('rollbackError', function (err) {
            self.emitter.emit('rollbackError', err);
        });

        this.kCore.on('rollbackSucceed', function () {
            self.log.info(self.toString(), 'Rollback succeed');
            self.emitter.emit('rollbackSucceed');
        });

        this.kCore.on('adaptationError', function (err) {
            deploying = false;
            if (wannaStop) {
                wannaStop = false;
                self.kCore.stop();
            }
            self.emitter.emit('adaptationError', err);
        });

        this.kCore.on('stopped', function () {
            coreStarted = false;
            self.emitter.emit('stopped');
        });
    },

    start: function (nodename, groupname, groupport) {
        // TODO add some verification over given names (no spaces & stuff like that)
        this.nodename = nodename || this.nodename;
        this.groupname = groupname || this.groupname;
        this.groupport = groupport || this.groupport;

        process.on('SIGINT', function() {
            process.stdout.write('\033[0G'); // http://stackoverflow.com/a/9628935/906441
            if (!coreStarted) {
                this.log.warn(this.toString(), 'Got SIGINT.  Shutting down Kevoree');
                process.exit(0);
            } else {
                if (!firstSIGINT) {
                    if (!deploying) {
                        this.log.warn(this.toString(), 'Force quit.');
                    } else {
                        this.log.warn(this.toString(), 'Force quit while deploying. '+path.resolve(this.modulesPath, 'node_modules')+' might be corrupted.');
                    }
                    process.exit(0);
                } else {
                    firstSIGINT = false;
                    if (!deploying) {
                        this.log.warn(this.toString(), 'Got SIGINT.  Shutting down Kevoree gracefully... (^C again to force quit)');
                        try {
                            this.kCore.stop();
                        } catch (err) {
                            this.log.error(this.toString(), err.stack);
                            process.exit(0);
                        }
                    } else {
                        this.log.warn(this.toString(), 'Got SIGINT.  Will shutdown Kevoree gracefully once deploy process finished. (^C again to force quit)');
                        wannaStop = true;
                    }
                }
            }
        }.bind(this));

        this.kCore.start(this.nodename);
    },

    stop: function () {
        this.kCore.stop();
    },

    deploy: function (model) {
        deploying = true;
        // deploy default bootstrap model
        var options = {
            model: model,
            bootstrapper: this.bootstrapper,
            nodeName: this.nodename,
            groupName: this.groupname,
            groupPort: this.groupport,
            modulesPath: this.modulesPath,
            logger: this.log
        };

        bootstrapHelper(options, function (err, bootstrapModel) {
            if (err) {
                this.log.error(this.toString(), err.message);
                process.exit(1);
            } else {
                this.kCore.deploy(bootstrapModel);
            }
        }.bind(this));
    },

    once: function (event, callback) {
        this.emitter.once(event, callback);
    },

    on: function (event, callback) {
        this.emitter.addListener(event, callback);
    },

    off: function (event, callback) {
        this.emitter.removeListener(event, callback);
    }
});

module.exports = NodeJSRuntime;