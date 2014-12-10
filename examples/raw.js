var gpsd = require('../lib/gpsd');

var listener = new gpsd.Listener({
    port: 2947,
    hostname: 'localhost',
    logger:  {
        info: function() {},
        warn: console.warn,
        error: console.error
    },
    parse: false
});

listener.connect(function() {
    console.log('Connected');
});

//not going to happen, parsejson is false
listener.on('TPV', function(data) {
  console.log(data);
});

// emitraw is true
listener.on('raw', function(data) {
  console.log(data);
});

listener.watch({class: 'WATCH', nmea: true});
