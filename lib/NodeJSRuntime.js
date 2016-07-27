'use strict';

var util = require('util'),
  KevoreeCore = require('kevoree-core'),
  Bootstrapper = require('kevoree-commons').Bootstrapper,
  bootstrapHelper = require('./bootstrapHelper'),
  path = require('path'),
  EventEmitter = require('events').EventEmitter;

var firstSIGINT = true,
  coreStarted = false,
  deploying = false,
  wannaStop = false;

function NodeJSRuntime(modulesPath, logger, resolver, kevs) {
  if (!kevs) {
    throw new Error('You must give a KevScript engine to the runtime');
  }
  if (!modulesPath) {
    throw new Error('You must give a modulesPath to the runtime');
  }
  if (!logger) {
    throw new Error('You must give a logger to the runtime');
  }
  this.modulesPath = modulesPath;
  this.log = logger;
  this.kevs = kevs;
  this.kCore = new KevoreeCore(kevs, this.modulesPath, this.log);
  this.bootstrapper = new Bootstrapper(this.log, resolver);
  this.nodename = 'node0'; // default nodename
  this.groupname = 'sync'; // default groupname
  this.groupport = 9000; // default grouport
  this.loglevel = 'info'; // default loglevel
  this.model = null;

  this.kCore.setBootstrapper(this.bootstrapper);
  var self = this;

  this.kCore.on('deploying', function() {
    deploying = true;
  });

  // kevoree core deployed event listener
  this.kCore.on('deployed', function(model) {
    deploying = false;
    firstSIGINT = true;
    if (wannaStop) {
      wannaStop = false;
      self.kCore.stop();
    }
    self.emit('deployed', model);
  });

  // kevoree core error event listener
  this.kCore.on('error', function (err) {
    self.emit('error', err);
  });

  this.kCore.on('rollbackSucceed', function() {
    deploying = false;
    firstSIGINT = true;
    if (wannaStop) {
      wannaStop = false;
      self.kCore.stop();
    }
    self.emit('rollbackSucceed');
  });

  this.kCore.on('stopped', function() {
    coreStarted = false;
    self.emit('stopped');
  });
}

util.inherits(NodeJSRuntime, EventEmitter);

NodeJSRuntime.prototype.start = function(nodename, groupname, groupport, loglevel) {
  // TODO add some verification over given names (no spaces & stuff like that)
  this.nodename = nodename || this.nodename;
  this.groupname = groupname || this.groupname;
  this.groupport = groupport || this.groupport;
  this.loglevel = loglevel || this.loglevel;

  process.on('SIGINT', function() {
    process.stdout.write('\x1b[0G'); // http://stackoverflow.com/a/9628935/906441
    if (!coreStarted) {
      this.log.warn('Got SIGINT.  Shutting down Kevoree');
      process.exit(0);
    } else {
      if (!firstSIGINT) {
        if (!deploying) {
          this.log.warn('Force quit.');
        } else {
          this.log.warn('Force quit while deploying. ' + path.resolve(this.modulesPath, 'node_modules') + ' might be corrupted.');
        }
        process.exit(0);
      } else {
        firstSIGINT = false;
        if (!deploying) {
          this.log.warn('Got SIGINT.  Shutting down Kevoree gracefully... (^C again to force quit)');
          try {
            this.kCore.stop();
          } catch (err) {
            this.log.error(err.stack);
            process.exit(0);
          }
        } else {
          this.log.warn('Got SIGINT.  Will shutdown Kevoree gracefully once deploy process finished. (^C again to force quit)');
          wannaStop = true;
        }
      }
    }
  }.bind(this));

  this.kCore.start(this.nodename);
  coreStarted = true;
  this.emit('started');
};

NodeJSRuntime.prototype.stop = function() {
  try {
    this.kCore.stop();
  } catch (err) {
    this.log.error(err.stack);
  }
};

NodeJSRuntime.prototype.deploy = function(model) {
  deploying = true;
  // deploy default bootstrap model
  var options = {
    model: model,
    bootstrapper: this.bootstrapper,
    nodeName: this.nodename,
    groupName: this.groupname,
    groupPort: this.groupport,
    logLevel: this.loglevel,
    modulesPath: this.modulesPath,
    logger: this.log
  };

  bootstrapHelper(this.kevs, options, function(err, bootstrapModel) {
    if (err) {
      this.log.error(err.message);
      process.exit(1);
    } else {
      this.kCore.deploy(bootstrapModel, function (err) {
        if (err) {
          process.exit(0);
        }
      });
    }
  }.bind(this));
};

NodeJSRuntime.prototype.off = function(event, listener) {
  this.removeListener(event, listener);
};

NodeJSRuntime.prototype.toString = function() {
  return 'NodeJSRuntime';
};

module.exports = NodeJSRuntime;
