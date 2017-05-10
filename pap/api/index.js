var clone = require('clone');
var Promise = require('bluebird');
var Locks = require("locks");
var PolicyObject = require("../pObject.js");
var Policy = require('ULocks').Policy;

var w = require("winston");
w.level = process.env.LOG_LEVEL;

var storage = null;
var locks = {}

var emptyEntry = {
    self : null,
    properties : {}
}

function init(settings, _storage) {
    storage = _storage;
    w.info("After PAP.api init: storage: " + storage + " (pid: " + process.pid + ")");
}

module.exports = {
    init: init,
    get: get,
    set: set,
    del: del,

    getFullRecord: getRecord,
    getRecord: getRecord,
    delRecord: delRecord
}

function get(id, property) {
    if(!storage)
        return Promise.reject("ERROR: PAP API has not been initialized before use.");
    if(id === undefined)
        return Promise.reject("ERROR: PAP api.get(...): Missing valid identifier to call get.");

    if(property === undefined)
        return getEntity(id);
    else
        return getProperty(id, property);
};

function set(id, property, policy) {    
    if(storage === null)
        return Promise.reject("ERROR: PAP API has not been initialized before use.");
    else if(id === undefined)
        return Promise.reject("ERROR: PAP api.set(...): Missing valid identifier to call set.");
    else if(property === undefined && policy === undefined || (typeof(property) === "string" && policy === undefined))
        return Promise.reject("ERROR: PAP api.set(...): Missing valid policy to call set.");
    else if(typeof(property) !== "string" && policy !== undefined)
        return Promise.reject("ERROR: PAP api.set(...): Property in set must be a string.");

    if(property !== undefined && policy === undefined)
        return setEntity(id, property);
    else
        return setProperty(id, property, policy);
};

function del(id, property) {
    if(storage === null)
        return Promise.reject("ERROR: PAP API has not been initialized before use.");
    else if(id === undefined)
        return Promise.reject("ERROR: Storage.del(...): Missing valid identifier to call del.");
    else {
        if(property === undefined)
            return delEntity(id)
        else
            return delProperty(id, property);
    }
};

function getLock(id) {
    if(!locks.hasOwnProperty(id))
        locks[id] = Locks.createMutex();
    return locks[id];
};

function getProperty(id, property) {
    w.info("pap.api.getProperty("+id+", '" + property+"')");
    
    return new Promise(function(resolve, reject) {
        storage.get(id).then(function(entry) {
            if(entry) {
                var pO = new PolicyObject(entry.pO);
                var propPolicy = pO.getProperty(property);
                if(propPolicy !== null) {
                    resolve(new Policy(propPolicy));
                }
                else
                    resolve(null);
            } else
                resolve(null);
        }, function(e) {
            reject(e);
        });
    });
};

function setProperty(id, property, policy, release) {
    return new Promise(function(resolve, reject) {
        var mutex = locks[id];
        mutex.lock(function() {
            storage.get(id).then(function(entry) {
                if(entry) {
                    var pO = new PolicyObject(entry.pO);
                    pO.setProperty(property, policy);
                    storage.set(id, pO).then(function() {
                        resolve(pO);
                        mutex.unlock();
                    }, function(e) {
                        // Unable to update policy backend
                        reject(e);
                        mutex.unlock();
                    });
                } else {
                    resolve(null);
                    mutex.unlock();
                }
            }, function(e) {
                // Unable to find policy Object for entity
                reject(e);
                mutex.unlock();
            });
        });
    });
};

function delProperty(id, property) {
    return new Promise(function(resolve, reject) {
        var mutex = getLock(id);
        
        mutex.lock(function() {
            storage.get(id).then(function(entry) {
                if(entry) {
                    var pO = new PolicyObject(entry.pO);
                    pO.delProperty(property);
                    storage.set(id, pO).then(function(r) {
                        resolve(r);
                        mutex.unlock();
                    }, function(e) {
                        w.error("PAP.api.delProperty is unable to delete property in entity with id '"+id+"'");
                        // Unable to update policy backend
                        reject(e);
                        mutex.unlock();
                    });
                } else {
                    resolve(null);
                    mutex.unlock();
                }
            });
        });
    });
};

function getEntity(id) {
    w.debug("pap.api.getEntity("+id+")");
    return new Promise(function(resolve, reject) {
        storage.get(id).then(function(entry) {
            if(entry) {
                var pO = new PolicyObject(entry.pO);
                // TODO: handle return value null
                var p = pO.getEntity();
                if(p !== null)
                    resolve(new Policy(p));
                else
                    resolve(null);
            } else
                resolve(null);
        }, function(e) {
            reject(e);
        });
    });
};

function setEntity(id, policy) {
    return new Promise(function (resolve, reject) {
        var mutex = getLock(id);
        mutex.lock(function() {
            storage.get(id).then(function(entry) {
                var pO = null;
                if(entry === null) {
                    pO = new PolicyObject();
                } else {
                    if(entry.pO)
                        pO = new PolicyObject(entry.pO);
                    else {
                        pO = new PolicyObject();
                    }
                }
                
                pO.setEntity(policy);
                storage.set(id, pO).then(function() {
                    resolve(pO);
                    mutex.unlock();
                }, function(e) {
                    reject(e);
                    mutex.unlock();
                });
            });
        });
    });
};

function delEntity(id) {
    return new Promise(function(resolve, reject) {
        var mutex = getLock(id);
        
        mutex.lock(function() {
            storage.get(id).then(function(entry) {
                if(entry) {
                    var pO = new PolicyObject(entry.pO);
                    pO.delEntity();
                    storage.set(id, pO).then(function(r) {
                        resolve(r);
                        mutex.unlock();
                    }, function(e) {
                        w.error("PAP.api.delProperty is unable to delete property in entity with id '"+id+"'");
                        // Unable to update policy backend
                        reject(e);
                        mutex.unlock();
                    });
                } else {
                    resolve(null);
                    mutex.unlock();
                }
            });
        });
    });
};

function delRecord(id) {
    return new Promise(function(resolve, reject) {
        var mutex = getLock(id);
        
        mutex.lock(function() {
            storage.del(id).then(function(entry) {
                if(entry) {
                    resolve(entry.pO);
                    mutex.unlock();
                } else {
                    resolve(null);
                    mutex.unlock();
                }
            }, function(e) {
                reject(e);
                mutex.unlock();
            });
        });
    });
};

function getRecord(id) {
    if(!storage)
        return Promise.reject("ERROR: PAP API has not been initialized before use.");
    if(id === undefined)
        return Promise.reject("ERROR: PAP api.getFullRecord(...): Missing valid identifier to call getFullRecord.");

    return new Promise(function(resolve, reject) {
        storage.get(id).then(function(entry) {
            if(entry) {
                var pO = new PolicyObject(entry.pO);
                resolve(pO);
            } else
                resolve(null);
        }, function(e) {
            reject(e);
        });
    });
};
