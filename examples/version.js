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
    program: '/usr/local/sbin/gpsd',
    device: '/dev/tty.usbserial'
});

daemon.start(function() {
    console.log('started');

    var listener = new gpsd.Listener();
    var count = 0;

    listener.logger = console;

    listener.on('VERSION', function (version) {
        console.log(version);
        count++;

        if (count >= 2) {
            listener.disconnect();
            daemon.stop();
        }
    });

    listener.connect(function () {
        console.log('connected');
        listener.version();
    });
});
