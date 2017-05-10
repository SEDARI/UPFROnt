"use strict";

var clone = require("clone");
var equal = require("deep-equal");
var uuid = require("uuid");
var w = require("winston");
w.level = process.env.LOG_LEVEL;

var emptyObject = {
    /* The policy for the object itself */
    s: null,
    /* All properties in this object which carry policies */
    p: {}
};

function invalid(o) {
    return (o === null) || (o === undefined)
}

/**
 * Constructs a new PolicyObject from another object or creates an empty PolicyObject
 * @constructor
 * @param {undefined|null|Object} object - Another PolicyObject from which to copy relevant properties.
 */
function PolicyObject(object) {
    /**
     * @memberof PolicyObject
     * @instance
     * @member {object} dictionary A dictionary of all policies contained in this PolicyObject */
    this.d = {};
    /**
     * @memberof PolicyObject
     * @instance
     * @member {object} entity The effective policy used when the entity represented by this object becomes active */
    this.e = null;
    /**
     * @memberof PolicyObject
     * @instance
     * @member {object} object The structure of the PolicyObject */
    this.o = clone(emptyObject);

    if(!invalid(object)) {
        if(invalid(object.d) || invalid(object.o)) {
            w.error("Cannot construct PolicyObject from invalid object. Construct empty PolicyObject.");
            return;
        }

        this.d = clone(object.d);
        this.o = clone(object.o);

        if(!invalid(object.e))
            this.e = clone(object.e);
    }
};

function getDictionaryPolicy(dict, ref) {
    w.debug("getDictionaryPolicy("+dict+", "+ref+")");
    if(ref !== null && ref !== undefined && dict.hasOwnProperty(ref))
        return dict[ref].p;
    else
        return null;
};

// TODO: simply take first free slot instead of the maximum!
function addDictionaryRef(dict, policy) {
    var free = null;
    var last = -1;

    w.debug("addDictionaryRef("+JSON.stringify(dict)+", "+policy+")");

    for(var ref in dict) {
        ref = parseInt(ref);

        // there was a gap
        if(free === null && ref != last + 1)
            free = last + 1;

        if(equal(dict[ref].p, policy)) {
            dict[ref].c++;
            return ref;
        }

        last = ref;
    }

    var ref = null;

    if(free === null)
        ref = last + 1;
    else
        ref = free;

    dict[ref] = { p: policy, c: 1 };

    return ref;
};

function delDictionaryRef(dict, ref) {
    w.debug("delDictionaryRef("+ref+")");
    
    if(ref !== null && ref !== undefined && dict.hasOwnProperty(ref)) {
        dict[ref].c--;
        if(dict[ref].c === 0)
            delete dict[ref];
    }
};


// TODO be more error friendly: address missing, e.g. property=system[0].key but entity with id does not have this property
/**
 * @public
 * @function
 * @param {string} property - The path to the property for which the policy should be deleted.
 * @param {Object} policy - The object representing the policy to be set for the specified property path.
 * @returns {null|Object} Returns null if the property path did not specify a policy before or a copy of the policy object replaced by the new one.
 */
PolicyObject.prototype.setProperty = function(property, policy) {
    var oldPolicy = null;

    if(property === "") {
        var pRef = addDictionaryRef(this.d, policy);
        if(this.o.s !== null) {
            oldPolicy = clone(getDictionaryPolicy(this.d, this.o.s));
            delDictionaryRef(this.d, this.o.s);
        }
        this.o.s = pRef;
    } else {
        var pRef = addDictionaryRef(this.d, policy);
        var curObj = this.o;

        var p = property
            .replace(/\[/, ".")
            .replace(/\]./g, ".")
            .replace(/\]$/g, "");

        var attrNames = p.split(".");
        while(attrNames.length) {
            var n = attrNames.shift();
            if(curObj.p.hasOwnProperty(n)) {
                curObj = curObj.p[n];
            } else {
                curObj.p[n] = clone(emptyObject);
                curObj = curObj.p[n];
            }
        }

        if(curObj.s !== null) {
            oldPolicy = clone(getDictionaryPolicy(this.d, curObj.s));
            delDictionaryRef(this.d, curObj.s);
        }
        curObj.s = pRef;
    }

    return oldPolicy;
};

/** @function
 * @param {string} property - The path to the property for which the policy should be deleted.
 * @returns {null|Object} Returns null if the property path does not exist or a copy of the object representing the policy set which was removed from this property path.
 */
PolicyObject.prototype.delProperty = function(property) {
    var oldPolicyRef = null;

    if(property === "") {
        oldPolicyRef = this.o.s;
        this.o.s = null;
    } else {
        var curObj = this.o;
        var parObj = null;

        var p = property
            .replace(/\[/, ".")
            .replace(/\]./g, ".")
            .replace(/\]$/g, "");

        var attrNames = p.split(".");
        var n = null;
        while(attrNames.length) {
            n = attrNames.shift();
            if(curObj.p.hasOwnProperty(n)) {
                parObj = curObj;
                curObj = curObj.p[n];
            } else
                return;
        }

        if(curObj.s !== null) {
            oldPolicyRef = curObj.s;
            curObj.s = null;
            if(parObj !== null && Object.keys(curObj.p).length === 0) {
                delete parObj.p[n];
            }
        }
    }

    var oldPolicy = clone(getDictionaryPolicy(this.d, oldPolicyRef));
    delDictionaryRef(this.d, oldPolicyRef);

    return oldPolicy;
};

/** @function
 * @param {string} property - The path to the property for which a policy should be derived.
 * @returns {null|Object} Returns null if no policy was set for this property path or a copy of the object representing the policy set for this property path.
 */
PolicyObject.prototype.getProperty = function(property) {
    w.info("PolicyObject.getProperty("+this+", '" + property+"')");
    if(property === "") {
        if(this.o.s !== null)
            return getDictionaryPolicy(this.d, this.o.s);
        else
            return null;
    } else {
        var curObj = this.o;

        var p = property
            .replace(/\[/, ".")
            .replace(/\]./g, ".")
            .replace(/\]$/g, "");

        var attrNames = p.split(".");
        var effPolicy = curObj.s;
        while(attrNames.length) {
            var n = attrNames.shift();
            if(curObj.p.hasOwnProperty(n)) {
                curObj = curObj.p[n];
                effPolicy = curObj.s;
            } else
                return clone(getDictionaryPolicy(this.d, effPolicy));
        }

        if(curObj.s === null)
            return clone(getDictionaryPolicy(this.d, effPolicy));
        else
            return clone(getDictionaryPolicy(this.d, curObj.s));
    }
};

/**
 * @public
 * @function
 * @param {Object} policy - The object representing the policy effective when the object is active as an entity
 * @returns {null|Object} Returns null if the effective policy for an entity was not specified or a copy of the policy object replaced by the new one.
 */
PolicyObject.prototype.setEntity = function(policy) {
    var oldPolicy = null;
    var pRef = addDictionaryRef(this.d, policy);
    if(this.e !== null) {
        oldPolicy = clone(getDictionaryPolicy(this.d, this.e));
        delDictionaryRef(this.d, this.e);
    }
    this.e = pRef;
    
    return oldPolicy;
};

/**
 * @public
 * @function
 * @returns {null|Object} Returns null if the effective policy for entity actions was not specified or a copy of the policy object.
 */
PolicyObject.prototype.getEntity = function() {
    if(this.e !== null) {
        return clone(getDictionaryPolicy(this.d, this.e));
    } else
        return null;
};

/**
 * @public
 * @function
 * @returns {null|Object} Returns null if the effective policy for an entity was not specified or a copy of the policy object originally specified for the effective policy.
 */
PolicyObject.prototype.delEntity = function() {
    var oldPolicy = null;
    if(this.e !== null) {
        oldPolicy = clone(getDictionaryPolicy(this.d, this.e));
        delDictionaryRef(this.d, this.e);
    }
    this.e = null;

    return oldPolicy;
};

function getSubObject(pO, property) {
    if(property === "")
        return pO.o;
    else {
        var curObj = pO.o;

        var p = property
            .replace(/\[/, ".")
            .replace(/\]./g, ".")
            .replace(/\]$/g, "");

        var attrNames = p.split(".");
        while(attrNames.length) {
            var n = attrNames.shift();
            if(curObj.p.hasOwnProperty(n)) {
                curObj = curObj.p[n];
            } else
                return null;
        }
        
        return curObj;
    }
};

PolicyObject.prototype.getSubPolicyObject = function(property) {
    var subObject = getSubObject(this, property);
    if(subObject !== null)
        return new PolicyObject({
            d : this.d,
            e : this.e,
            o : subObject
        });
    else
        return new PolicyObject();
}

module.exports = PolicyObject;
