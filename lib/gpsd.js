/*******************************************************************************
*  Code contributed to the webinos project
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*
*******************************************************************************/

var spawn = require('child_process').spawn;
var util = require('util');
var events = require('events');
var fs = require('fs');
var net = require('net');
var path = require('path');

var DEFAULT_PORT = 2947;

/* Construct the listener */
function Listener(options) {
    this.port = DEFAULT_PORT;
    this.hostname = 'localhost';
    this.logger = {
        info: function() {},
        warn: console.warn,
        error: console.error
    };
    this.parse = true;

    if (options !== undefined) {
        if (options.port !== undefined) this.port = options.port;
        if (options.hostname !== undefined) this.hostname = options.hostname;
        if (options.logger !== undefined) this.logger = options.logger;
        if (options.parse !== undefined) this.parse = options.parse;
    }

    events.EventEmitter.call(this);

    var self = this;
    this.connected = false;
    this.serviceSocket = new net.Socket();
    this.serviceSocket.setEncoding('ascii');

    this.serviceSocket.on("data", function (payload) {
        payload = payload.replace(/\}\{/g, '}\n{');
        var info = payload.split('\n'), data;

        for (var index = 0; index < info.length; index++) {
            if (info[index]) {
                if (!self.parse) {
                    self.emit('raw', info[index]);
                } else {
                    try {
                        data = JSON.parse(info[index]);
                        self.emit(data.class, data);
                    } catch (error) {
                        self.logger.error("Bad message format", info[index], error);
                        self.emit('error', {
                            message : "Bad message format",
                            cause : info[index],
                            error : error
                        });

                        continue;
                    }
                }
            }
        }
    });

    this.serviceSocket.on("close", function (err) {
        self.logger.info('Socket disconnected.');
        self.emit('disconnected', err);
        self.connected = false;
    });

    this.serviceSocket.on('connect', function (socket) {
        self.logger.info('Socket connected.');
        self.connected = true;
        self.emit('connected');
    });

    this.serviceSocket.on('error', function (error) {
        if (error.code === 'ECONNREFUSED') {
            self.logger.error('socket connection refused');
            self.emit('error.connection');
        } else {
            self.logger.error('socket error', error);
            self.emit('error.socket', error);
        }
    });

    return (this);
}

util.inherits(Listener, events.EventEmitter);
exports.Listener = Listener;

/* connects to GPSd */
Listener.prototype.connect = function(callback) {
    this.serviceSocket.connect(this.port, this.hostname);

    if(callback !== undefined) {
      this.serviceSocket.once('connect', function(socket) {
          callback(socket);
      });
    }
};

/* disconnects from GPSd */
Listener.prototype.disconnect = function(callback) {
    this.unwatch();

    this.serviceSocket.end();

    if(callback !== undefined) {
      this.serviceSocket.once('close', function(err) {
          callback(err);
      });
    }};

/* Checks the state of the connection */
Listener.prototype.isConnected = function() {
    return this.connected;
};

/* Start the watching mode: see ?WATCH command */
Listener.prototype.watch = function(options) {
  var watch = { class: 'WATCH', json: true, nmea: false };
  if (options) watch = options;
  this.serviceSocket.write('?WATCH=' + JSON.stringify(watch));
};

/* Stop watching */
Listener.prototype.unwatch = function() {
    this.serviceSocket.write('?WATCH={"class": "WATCH", "json":true, "enable":false}\n');
};

/* Send the ?VERSION command */
Listener.prototype.version = function() {
    this.serviceSocket.write('?VERSION;\n');
};

/* Send the ?DEVICES command */
Listener.prototype.devices = function() {
    this.serviceSocket.write('?DEVICES;\n');
};

/* Send the ?DEVICE command */
Listener.prototype.device = function() {
    this.serviceSocket.write('?DEVICE;\n');
};

function Daemon(options) {
    this.program = 'gpsd';
    this.device = '/dev/ttyUSB0';
    this.port = DEFAULT_PORT;
    this.pid = '/tmp/gpsd.pid';
    this.readOnly = false;
    this.logger = {
        info: function() {},
        warn: console.warn,
        error: console.error
    };

    events.EventEmitter.call(this);

    if (options !== undefined) {
        if (options.program !== undefined) this.program = options.program;
        if (options.device !== undefined) this.device = options.device;
        if (options.port !== undefined) this.port = options.port;
        if (options.pid !== undefined) this.pid = options.pid;
        if (options.readOnly !== undefined) this.readOnly = options.readOnly;
        if (options.logger !== undefined) this.logger = options.logger;
    }

    this.arguments = [];
    /* fg process */
    this.arguments.push('-N');
    this.arguments.push('-P');
    this.arguments.push(this.pid);
    this.arguments.push('-S');
    this.arguments.push(this.port);
    this.arguments.push(this.device);
    if (this.readOnly) this.arguments.push('-b');
}

util.inherits(Daemon, events.EventEmitter);
exports.Daemon = Daemon;

/* starts the daemon */
Daemon.prototype.start = function(callback) {
    var self = this;

    fs.exists(this.device, function (exists) {
        var p = function (callback) {
            if (self.gpsd === undefined) {
                self.logger.info('Spawning gpsd.');
                self.gpsd = spawn(self.program, self.arguments);

                self.gpsd.on('exit', function (code) {
                    self.logger.warn('gpsd died.');
                    self.gpsd = undefined;
                    self.emit('died');
                });

                self.gpsd.on('error', function (err) {
                    self.emit('error', err);
                });

                // give the daemon a change to startup before making the callback.
                setTimeout(function() {
                    if (callback !== undefined) callback.call();
                }, 100);
            }
        };

        if (exists) {
            p.apply(this, [ callback ]);
        } else {
            self.logger.info("Device not found. watching device.");
            fs.watchFile(self.device, function (curr, prev) {
                self.logger.info("device status changed.");
                p.apply(this, [ callback ]);
            });
        }
    });
};

/* stops the daemon */
Daemon.prototype.stop = function(callback) {
    this.gpsd.on('exit', function (code) {
        if (callback !== undefined) {
            callback.call(); 
        }
    });

    if (this.gpsd !== undefined) {
        this.gpsd.kill();
    }
};
