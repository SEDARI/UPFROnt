var NodeCache = require('node-cache');
var clone = require('clone');
var Promise = require('bluebird');
var w = require('winston');
w.level = process.env.LOG_LEVEL;

var policyCache = null;
var syncModule = require("./modules/nosync");;
var dbModule = null;

// TODO: Ensure that we get infos from storage module when it updates
// TODO: Cache is not needed if we run in cluster mode and some pub sub module is avaiable

function init(settings, cluster) {
    return new Promise(function(resolve, reject) {
        if(dbModule !== null)
            reject(new Error("pap.storage.init(...): Storage module has already been initialized"));
        
        if(!settings)
            reject(new Error("pap.storage.init(...): Missing or invalid settings file."));

        if(!settings.type)
            reject(new Error("pap.storage.init(...): Missing 'type' in PAP storage settings."));
        else
            if(settings.type === "remote") {
                // TODO: connect to another PAP
                reject(new Error("pap.storage.init(...): Remote storage type has not been implemented yet!"));
            } else {
                try {
                    if(settings.type ==="external" && settings.module_name){
                       dbModule = require(settings.module_name);
                    }
                    else{
                      dbModule = require("./modules/"+settings.type);
                    }
                } catch(e) {
                    reject(new Error("pap.storage.init(...): Unable to load database module '"+settings.type+"'. " + e));
                    return;
                };

                dbModule.init(settings).then(function() {
                    if(settings.cache && settings.cache.enabled) {
                        policyCache = new NodeCache({
                            stdTTL: settings.cache.TTL || 600,
                            checkPeriod: (settings.cache.TTL || 600)/2,
                            useClones: true,
                            errorOnMissing: false
                        });

                        if(!settings.cache.sync && cluster > 1) {
                            reject(new Error("pap.storage.init(...): PAP is misconfigured. Configuration specifies cache without a sync module for cache synchronisation!"));
                            return;
                        }

                        if(cluster > 1) {
                            w.info("PAP storage connects to synchronisation server");
                            try {
                                // TODO: change such that it can also be loaded from an arbitrary directory
                                syncModule = require("./modules/"+settings.cache.sync.type);
                            } catch(e) {
                                reject(new Error("pap.storage.init(...): PAP is unable to load synchronization module '"+settings.cache.sync.type+"' for cache synching in cluster! "+e));
                                w.error("pap.storage.init(...): PAP is unable to load synchronization module '"+settings.cache.sync.type+"' for cache synching in cluster! "+e);
                                return;
                            }

                            syncModule.init(settings.cache.sync, function(id) {
                                var p = policyCache.get(id);
                                if(p) {
                                    policyCache.del(id);
                                    dbModule.read(id).then(function(pO) {
                                        policyCache.set(id, pO);
                                    });
                                }
                            }).then(function() {
                                w.info("Storage successfully started synchronization module.");
                                resolve();
                            }, function(e) {
                                w.error("pap.storage.init(...): Storage module is unable to instantiate synchronization module.");
                                reject(e);
                            });
                        } else {
                            resolve();
                        }
                    } else {
                        resolve();
                    }
                }, function(e) {
                    reject(e);
                });
            }
    });
};

module.exports = {
    init : init,
    get  : get,
    set  : set,
    del  : del
}

function get(id) {
    return new Promise(function (resolve, reject) {
        if(id === undefined) {
            reject(new Error("pap.storage.get(...): Missing valid identifier to call get."));
            return;
        }

        if(dbModule === null)
            reject(new Error("pap.storage.get(...): PAP does not know how to lookup policies."));
        else if(id === undefined)
            reject(new Error("pap.storage.get: Must specify id when calling getEntity"));

        var policyObject = undefined;
        if(policyCache !== null)
            policyObject = policyCache.get(id);

        if(policyObject === undefined) {
            dbModule.read(id).then(function(pO) {
                if(policyCache !== null)
                    policyCache.set(id, pO);
                w.debug("pap.storage.get(...): Cache miss! Retrieved object '"+id+"' from db.");
                w.debug("\tstorage.get("+id+") => "+JSON.stringify(pO));
                resolve(pO);
            }, function(e) {
                reject(e);
            });
        } else {
            w.log('debug', "Retrieved object '"+id+"' from cache.");
            resolve(policyObject);
        }
    });
};

// TODO: requries some locking here in sync medium
function set(id, policyObject) {
    return new Promise(function (resolve, reject) {
        if(id === undefined) {
            reject(new Error("pap.storage.set(...): Missing valid identifier to call set."));
            return;
        }
        if(policyObject === undefined) {
            reject(new Error("pap.storage.set(...): Missing policyObject to call set."));
            return;
        }

        if(dbModule === null)
            reject(new Error("pap.storage.set(...): PAP does not know how to lookup policies."));
        else if(id === undefined)
            reject(new Error("pap.storage.set(...): Must specify id, policy when calling setEntity"));

        syncModule.lock(id).then(function(unlock) {
            dbModule.update(id, policyObject).then(function(r) {
                if(policyCache !== null)
                    policyCache.set(id, r);
                
                if(syncModule)
                    syncModule.mark(id);

                w.debug("storage.set("+id+", "+JSON.stringify(policyObject)+")");
                resolve(r.pO);
                unlock();
            }, function(e) {
                reject(e);
                unlock();
            });
        });
    });
};

/** returns the deleted object or null if the object did not exist in the database before deletion */
// TODO: requries some locking here in sync medium
function del(id) {
    return new Promise(function (resolve, reject) {
        if(dbModule === null)
            reject("ERROR: PAP does not know how to lookup policies.");
        else if(id === undefined)
            reject("ERROR: Must specify id when calling delEntity");

        syncModule.lock(id).then(function(unlock) {
            dbModule.del(id).then(function(entity) {
                if(policyCache !== null)
                    policyCache.del(id);
                resolve(entity);
                unlock();
            }, function(e) {
                reject(e);
                unlock();
            });
        });
    });
};
