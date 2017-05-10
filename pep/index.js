/** 
 * Policy Enforcement Point
 * @module pep
 * @author Daniel Schreckling
 */

var clone = require('clone');

var Promise=require('bluebird');

var pap = require('../pap');
var pdp = require('../pdp');
var Policy = require('ULocks').Policy;

// TODO: replace, fixed access to id by method which is required to be implemented by objects and subjects
// TODO: targetpolicy could be replaced by record as well to be more consistent
// TODO: it should not happen that a less restrictive policy inside a subobject
// reveals the possible confidential structure of the object containing this subobject

function isValid(o) {
    return (o !== undefined && o !== null)
}

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
            console.log("ERROR: PEP.declassify: Unable to create Policy");
            return Promise.reject(e);
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
    return new Promise(function(resolve, reject) {
        pdp.checkRead(target, targetPolicy, objInfo, effPolicy).then(function(decision) {
            if(decision.result) {
                // TODO: apply action here
                resolve({ prop: property, value: object[property]});
            } else {
                resolve({ prop: property, value: undefined });
            }
        }, function(e) {
            console.log("ERROR: PEP is unable to declassify property '"+property+"': ", e);
            reject(e)
        });
    });
}

function genDeclassifyPromise(property, object, policyObject, target, targetPolicy, objInfo, effPolicy) {
    return new Promise(function(resolve, reject) {
        declassifyRec(objInfo, object, policyObject, target, targetPolicy, effPolicy).then(function(o) {
            resolve({ prop: property, value: o});
        }, function(e) {
            console.log("ERROR: PEP is unable to declassify object '"+property+"': ", e);
            reject(e)
        });
    });
}

function declassifyRec(objInfo, object, objectPO, target, targetPolicy, effPolicy) {
    return new Promise(function(resolve, reject) {        
        var promises = [];

        // TODO: RELIES ON OLD POLICYOBJECT -> REVISE!!! 

        var filtered = object instanceof Array ? [] : {};
        var curPO = objectPO;

        if(effPolicy === undefined)
            effPolicy = objectPO.getProperty("");

        for(var p in object) {
            if(object.hasOwnProperty(p)) {
                var promise = null;

                var propPolicy = curPO.getProperty(p);

                if(propPolicy === null && effPolicy === null)
                    continue;

                if(typeof object[p] === "object" && propPolicy !== null) {
                    promise = genDeclassifyPromise(p, object[p], curPO.getSubPolicyObject(p), target, targetPolicy, objInfo, effPolicy);
                } else {

                    // TODO: p is inside a loop => correct as it changes in the promise while looping
                    // translate into function call => only way to avoid the same variable scope!

                    if(propPolicy === null)
                        promise = genCheckReadPromise(p, object, target, targetPolicy, objInfo, effPolicy);
                    else 
                        promise = genCheckReadPromise(p, object, target, targetPolicy, objInfo, propPolicy);
                }

                promises.push(promise);
            }
        }

        if(promises.length === 0)
            return resolve(clone(object));
        else {
            
            Promise.all(promises).then(function(values) {
                for(var i in values) {
                    // console.log("prop: "+values[i].prop+", value: "+JSON.stringify(values[i].value));
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
    declassify : declassify
};
