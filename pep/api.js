var clone = require('clone');
var w = require('winston');
w.level = process.env.LOG_LEVEL;

var pap = require('../pap');
var pdp = require('../pdp');
var Policy = require('ulocks').Policy;

function isValid(o) {
    return (o !== undefined && o !== null)
};

function init(settings) {
    // nothing required here
}

// TODO: replace, fixed access to id by method which is required to be implemented by objects and subjects
// TODO: targetpolicy could be replaced by record as well to be more consistent
// TODO: it should not happen that a less restrictive policy inside a subobject
// reveals the possible confidential structure of the object containing this subobject

/**
 * Declassify a given object by simply removing the properties in the object which must not be read by the target
 * 
 * @function declassify
 * @param {!Object} object - The complete object to be declassified. Currently, this objcet must contain the property id to be uniquely identified.
 * @param {!Object} target - The complete entitiy object to which the object should be sent. Currently, this objcet must contain the property id to be uniquely identified.
 * @return {Promise.<Object>} The declassified object.
 * @static
 */
/**
 * Declassify a given object by simply removing the properties in the object which must not be read by the target
 * 
 * @function declassify
 * @param {!Object} object - The complete object to be declassified. Currently, this objcet must contain the property id to be uniquely identified.
 * @param {!PolicyRecord} objPolicyRecord - The policy record for the object retrieved from the pap with getFullRecord.
 * @param {!Object} target - The complete entitiy object to which the object should be sent. Currently, this objcet must contain the property id to be uniquely identified.
 * @param {!Policy} targetPolicy - The effective policy of the target receiving the object.
 * @return {Promise.<Object>} The declassified object.
 * @static
 *
 */
function declassify(object, objPolicyRecord, target, targetPolicy) {
    w.debug("UPFROnt.pep.declassify");
    
    if(!isValid(object))
        return Promise.reject(new Error("Unable to declassify invalid object"));
    
    if(!isValid(object))
        return Promise.reject(new Error("Invalid object policy record during call to PEP.declassify"));

    if((isValid(target) || isValid(targetPolicy)) && (!isValid(target) || !isValid(targetPolicy)))
        return Promise.reject(new Error("Invalid target specification in PEP.declassify"));

    if(!isValid(target) && !isValid(targetPolicy)) {
        target = objPolicyRecord;
        objPolicyRecord = null;
        targetPolicy = null;
    }

    var effPolicy = null;

    if(targetPolicy) {
        try {
            if(!(targetPolicy instanceof Policy))
                targetPolicy = new Policy(targetPolicy);
            
            return declassifyRec(clone(object), clone(object), objPolicyRecord, target, targetPolicy, effPolicy);
        } catch(e) {
            var err = new Error("UPFROnt.pep.declassify: Unable to create Policy: " + e);
            w.error(err);
            return Promise.reject(err);
        }
    } else {
        return new Promise(function(resolve, reject) { 
            pap.getFullRecord(object.id).then(function(opr) {
                pap.get(target.id).then(function(tp) {
                    declassifyRec(clone(object), clone(object), opr, target, tp, effPolicy).then(function(filteredObject) {
                        resolve(filteredObject);
                    }, function(e) {
                        reject(e);
                    });
                }, function(e) {
                    reject(e);
                });
            }, function(e) {
                reject(e);
            });
        });
    }
};

function genCheckReadPromise(property, object, target, targetPolicy, objInfo, effPolicy) {
    w.debug("pep.api.genCheckReadPromise");
    return new Promise(function(resolve, reject) {
        pdp.checkRead(target, targetPolicy, objInfo, effPolicy).then(function(result) {
            return Policy.enforce(object[property], null, null, result);
        }, function(e) {
            w.error("PDP is unable to check read access on property '"+property+"': " + e);
            reject(e)
        }).then(function(r) {
            if(r === null)
                resolve({ prop: property });
            else
                resolve({ prop: property, value: r });
        }, function(e) {
            w.error("PEP is unable to declassify property '"+property+"': " + e);
            reject(e)
        });
    });                                                     
}

function genDeclassifyPromise(property, object, policyObject, target, targetPolicy, objInfo, effPolicy) {
    return new Promise(function(resolve, reject) {
        declassifyRec(objInfo, object, policyObject, target, targetPolicy, effPolicy).then(function(o) {
            if(Object.keys(o).length > 0)
                resolve({ prop: property, value: o});
            else
                resolve({ prop: property });
        }, function(e) {
            w.error("PEP is unable to declassify object '"+property+"': ", e);
            reject(e)
        });
    });
}

function declassifyRec(objInfo, object, objectPolicy, target, targetPolicy, effPolicy) {
    return new Promise(function(resolve, reject) {        
        var promises = [];

        var filtered = object instanceof Array ? [] : {};
        var curOPol = objectPolicy;

        if(objectPolicy.self !== null || effPolicy === undefined)
            effPolicy = objectPolicy.self;

        for(var p in object) {
            if(object.hasOwnProperty(p)) {
                var promise = null;

                if(!(curOPol.properties && curOPol.properties.hasOwnProperty(p)) && effPolicy === null)
                    continue;

                if(typeof object[p] === "object" && curOPol.properties && curOPol.properties.hasOwnProperty(p)) {
                    promise = genDeclassifyPromise(p, object[p], curOPol.properties[p], target, targetPolicy, objInfo, effPolicy);
                } else {

                    // TODO: p is inside a loop => correct as it changes in the promise while looping
                    // translate into function call => only way to avoid the same variable scope!

                    if(!curOPol.properties || !curOPol.properties.hasOwnProperty(p) || curOPol.properties[p].self === null)
                        promise = genCheckReadPromise(p, object, target, targetPolicy, objInfo, effPolicy);
                    else 
                        promise = genCheckReadPromise(p, object, target, targetPolicy, objInfo, curOPol.properties[p].self);
                }

                promises.push(promise);
            }
        }

        if(promises.length === 0)
            return resolve(clone(object));
        else {
            
            Promise.all(promises).then(function(values) {
                for(var i in values) {
                    if(values[i].value !== undefined)
                        filtered[values[i].prop] = values[i].value;
                }
                resolve(filtered);
            }, function(reason) {              
                reject(reason);
            });
        }
    });
};

module.exports = {
    init: init,
    
    declassify: declassify
};
