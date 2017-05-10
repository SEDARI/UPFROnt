var api = require('./api');
var pap = require('../pap');

// TODO: Check how to share app with PAP
function init(settings) {
    return new Promise(function(resolve, reject) {
        pap.init(settings).then(function() {
            api.init(settings, pap).then(function() {
                resolve();
            }, function(e) {
                reject(e);
            });
        }, function(e) {
            reject(e);
        });
    });
}

module.exports = {
    init: init,
    checkRead : api.checkRead,
    checkWrite : api.checkWrite,
    pap: pap
}
