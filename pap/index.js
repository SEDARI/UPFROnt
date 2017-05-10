var clone = require('clone');
var w = require('winston');
w.level = process.env.LOG_LEVEL;

var Promise = require('bluebird');

var ULocks = require('ULocks');

var Storage = require('./storage');
var api = require('./api');

var server = null;

function disabledAPI() {
    var msg = "Usage error. API request ignored. PAP cannot answer direct API request while running in server mode!";
    w.warn(msg);
    
    return Promise.reject(new Error(msg));
};

function getServerInit(settings, server, Rest) {
    return function() {
        return new Promise(function(resolve, reject) {
            Storage.init(settings.pap.storage, settings.pap.server.cluster).then(function() {
                ULocks.init(settings.ulocks).then(function() {
                    api.init(settings, Storage);
                    Rest.init(settings.pap.server, server.app).then(function() {
                        resolve();
                    }, function() {
                        reject("Unable to initialize REST interface");
                    })
                }, function(e) {
                    w.error("Unable to initialize storage module");
                    reject(e);
                });
            });
        });
    };
}

function init(settings) {
    if(!settings)
        return Promise.reject(new Error("pap.init: Invalid settings"));

    var papSettings = settings.pap;

    return new Promise(function(resolve, reject) {
        if(!papSettings.server) {
            Storage.init(papSettings.storage, false).then(function() {
                api.init(settings, Storage);
                
                // we are done - PAP is running locally without
                // any REST interface
                resolve();
            }, function(e) {
                reject("PAP is unable to communicate to policy store. "+e);
            });
        } else {
            var Server = require('./server');
            var Rest = require('./rest');
            
            server = new Server(papSettings.server);
            server.init(getServerInit(settings, server, Rest)).then(function(workers) {
                if(workers) {
                    module.exports.get = disabledAPI;
                    module.exports.set = disabledAPI;
                    module.exports.set = disabledAPI;
                    
                    w.info("PAP cluster is ready to receive requests.");
                    resolve();
                }
            }, function(e) {
                reject(e);
            });
        }
    });
};

// TODO: disable get, set, del if PAP runs as server

module.exports = {
    init: init,
    get: api.get,
    set: api.set,
    del: api.del,

    getFullRecord: api.getRecord,
    getRecord: api.getRecord,
    delRecord: api.delRecord,

    get app() { if(server) return server.app; else return null; }
};
