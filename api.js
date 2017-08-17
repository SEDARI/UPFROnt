var ulocks = require('ulocks');
var w = require('winston');
w.level = process.env.LOG_LEVEL;

var pap = require('./pap');
var pdp = require('./pdp');
var pep = require('./pep');

function init(settings) {
    return ulocks.init(settings.ulocks)
        .then(pap.init.bind(null, settings))
        .then(pdp.init.bind(null, settings))
        .then(pep.init.bind(null, settings)).then(function() {
            w.info("UPFROnt API initialized successfully.");
            return Promise.resolve();
        });
}

function stop() {
    return pap.stop();
}

module.exports = {
    init: init,
    stop: stop,

    pap: pap,
    pep: pep,
    pdp: pdp
}
