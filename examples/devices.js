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

var gpsd = require('../lib/gpsd.js');

var daemon = new gpsd.Daemon({
    program: '/usr/local/bin/gpsd',
    device: '/dev/tty.usbserial'
});

daemon.logger = console;

daemon.start(function() {
    console.log('started');
    
    var listener = new gpsd.Listener();
    
    listener.logger = console;

    listener.on('DEVICE', function (device) {
        console.log(device);
        
        listener.disconnect();
        daemon.stop();
    });

    listener.on('DEVICES', function (devices) {
        console.log(devices);
        listener.device();
    });
    
    listener.connect(function () {
        console.log('connected');
        listener.devices();
    });
});
