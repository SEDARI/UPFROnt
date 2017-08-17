var clone = require('clone');
var Promise = require('bluebird');
var w = require("winston");
w.level = process.env.LOG_LEVEL;

var ulocks = require('ulocks');
var Policy = ulocks.Policy;

var mutex = require("./mutex");

var storage = null;
var locks = {}

var emptyEntry = {
    self : null,
    properties : {}
}

function init(settings, _storage) {
    storage = _storage;

    return mutex.init(settings);
}

function stop() {
    return Promise.resolve();
}

function get(id, property) {
    if(storage === null)
        return Promise.reject(new Error("PAP API has not been initialized before use."));
    if(id === undefined)
        return Promise.reject(new Error("PAP api.get(...): Missing valid identifier to call get."));

    if(property === undefined)
        return getEntity(id);
    else
        return getProperty(id, property);
};

function set(id, property, policy) {    
    if(storage === null)
        return Promise.reject(new Error("PAP API has not been initialized before use."));
    else if(id === undefined)
        return Promise.reject(new Error("PAP api.set(...): Missing valid identifier to call set."));
    else if(property === undefined && policy === undefined || (typeof(property) === "string" && policy === undefined))
        return Promise.reject(new Error("PAP api.set(...): Missing valid policy to call set."));
    else if(typeof(property) !== "string" && policy !== undefined)
        return Promise.reject(new Error("PAP api.set(...): Property in set must be a string."));

    if(property !== undefined && policy === undefined)
        return setEntity(id, property);
    else
        return setProperty(id, property, policy);
};

function del(id, property) {
    if(storage === null)
        return Promise.reject(new Error("PAP API has not been initialized before use."));
    else if(id === undefined)
        return Promise.reject(new Error("Storage.del(...): Missing valid identifier to call del."));
    else {
        if(property === undefined)
            return delEntity(id)
        else
            return delProperty(id, property);
    }
};

// TODO: Check for errors during policy creation
function getProperty(id, property) {
    w.debug("PAP.api.getProperty("+id+", '" + property+"')");
    
    return new Promise(function(resolve, reject) {
        storage.get(id).then(function(entry) {
            if(entry) {
                w.info("PAP: Retrieved policy object for id '"+id+"': ", entry);
                var pO = entry.pO;
                var propPolicy = _getProperty(pO, property)
                w.info("PAP: Retrieved policy for property '"+property+"': ", propPolicy);
                if(propPolicy !== null) {
                    resolve(new Policy(propPolicy));
                } else
                    resolve(null);
            } else
                resolve(null);
        }, function(e) {
            w.debug("PAP.api.getProperty: Entity with id '"+id+"' does not exist.");
            reject(e);
        });
    });
};

function _getProperty(policyObject, _property) {
    w.debug("PAP.api._getProperty("+JSON.stringify(policyObject)+", '" + _property+"')");
    
    if(policyObject) {
        if(_property === "") {
            return policyObject.self;
        } else {
            var curObj = policyObject;
            var property = _property
                .replace(/\[/, ".")
                .replace(/\]./g, ".")
                .replace(/\]$/g, "");
            var attrNames = property.split(".");
            var effPolicy = curObj.self;
            while(attrNames.length) {
                var n = attrNames.shift();
                if(curObj.properties.hasOwnProperty(n)) {
                    curObj = curObj.properties[n];
                    effPolicy = curObj.self;
                } else
                    return effPolicy;
            }
            
            if(curObj.self === null)
                return effPolicy;
            else
                return curObj.self;
        }
    } else
        return null;
};

function setProperty(id, property, policy, release) {
    return new Promise(function(resolve, reject) {
        mutex.lock(id).then(function() {
            storage.get(id).then(function(entry) {
                if(entry) {
                    var pO = entry.pO;
                    var p = _setProperty(pO, property, policy);
                    storage.set(id, p).then(function() {
                        resolve(p);
                        mutex.unlock(id);
                    }, function(e) {
                        // Unable to update policy backend
                        reject(e);
                        mutex.unlock(id);
                    });
                } else {
                    resolve(null);
                    mutex.unlock(id);
                }
            }, function(e) {
                // Unable to find policy Object for entity
                reject(e);
                mutex.unlock(id);
            });
        });
    });
};

// TODO be more error friendly: address missing, e.g. property=system[0].key but entity with id does not have this property
// TODO: check for errors while creating policies
function _setProperty(pol, property, policy) {
    if(property === "") {
        pol.self = new Policy(policy);
    } else {
        var curObj = pol;
        property = property
            .replace(/\[/, ".")
            .replace(/\]./g, ".")
            .replace(/\]$/g, "");
        var attrNames = property.split(".");
        while(attrNames.length) {
            var n = attrNames.shift();
            if(curObj.properties.hasOwnProperty(n)) {
                curObj = curObj.properties[n];
            } else {
                curObj.properties[n] = clone(emptyEntry);
                curObj = curObj.properties[n];
            }
        }
        curObj.self = new Policy(policy);
    }

    return pol;
};

function delProperty(id, property) {
    return new Promise(function(resolve, reject) {
        mutex.lock(id).then(function() {
            storage.get(id).then(function(entry) {
                if(entry) {
                    var pO = entry.pO;
                    var p = _delProperty(pO, property);
                    storage.set(id, p).then(function(r) {
                        resolve(r);
                        mutex.unlock(id);
                    }, function(e) {
                        w.error("PAP.api.delProperty is unable to delete property in entity with id '"+id+"'");
                        // Unable to update policy backend
                        reject(e);
                        mutex.unlock(id);
                    });
                } else {
                    resolve(null);
                    mutex.unlock(id);
                }
            });
        });
    });
};

function _delProperty(pObject, _property) {
    if(_property === "") {
        if(pObject.self !== null)
            pObject.self = null;
    } else {
        var curObj = pObject;
        var property = _property
            .replace(/\[/, ".")
            .replace(/\]./g, ".")
            .replace(/\]$/g, "");
        
        var attrNames = property.split(".");
        while(attrNames.length) {
            var n = attrNames.shift();
            if(curObj.properties.hasOwnProperty(n))
                curObj = curObj.properties[n];
            else
                return pObject;
        }
        
        if(curObj.self !== null)
            curObj.self = null;
    }
    
    return pObject;
};  

// TODO: check for errors during policy creation
function getEntity(id) {
    return new Promise(function(resolve, reject) {
        storage.get(id).then(function(entry) {
            if(entry) {
                var pO = entry.pO;
                resolve(new Policy(pO.entity));
            } else
                resolve(null);
        }, function(e) {
            reject(e);
        });
    });
};

function setEntity(id, policy) {
    return new Promise(function (resolve, reject) {
        mutex.lock(id).then(function() {
            storage.get(id).then(function(entry) {
                var pO = null;
                if(entry === null) {
                    pO = clone(emptyEntry);
                } else {
                    if(entry.pO)
                        pO = entry.pO;
                    else {
                        pO = clone(emptyEntry);
                    }
                }
                
                _setEntity(id, pO, policy).then(function(p) {
                    storage.set(id, p).then(function() {
                        resolve(p);
                        mutex.unlock(id);
                    }, function(e) {
                        reject(e);
                        mutex.unlock(id);
                    });
                }, function(e) {
                    reject(e);
                    mutex.unlock(id);
                });
            });
        });
    });
};

// TODO: update with change of ulock system
function _setEntity(id, pO, policy) {
    return new Promise(function(resolve, reject) {
        if(!(policy instanceof Policy))
            try {
                policy = new Policy(policy);
            } catch(e) {
                reject(e);
                return;
            }
        
        pO.entity = policy;

        resolve(pO);
    });
};

function delEntity(id) {
    return new Promise(function(resolve, reject) {
        mutex.lock(id).then(function() {
            storage.del(id).then(function(entry) {
                if(entry) {
                    resolve(entry.pO);
                    mutex.unlock(id);
                } else {
                    resolve(null);
                    mutex.unlock(id);
                }
            }, function(e) {
                reject(e);
                mutex.unlock(id);
            });
        });
    });
};

function getFullRecord(id) {
    if(!storage)
        return Promise.reject(new Error("PAP API has not been initialized before use."));
    if(id === undefined)
        return Promise.reject(new Error("PAP api.getFullRecord(...): Missing valid identifier to call getFullRecord."));

    return new Promise(function(resolve, reject) {
        storage.get(id).then(function(entry) {
            if(entry) {
                var pO = entry.pO;
                resolve(pO);
            } else
                resolve(null);
        }, function(e) {
            reject(e);
        });
    });
};

module.exports = {
    init: init,
    stop: stop,
    get: get,
    set: set,
    del: del,

    getFullRecord: getFullRecord
}
