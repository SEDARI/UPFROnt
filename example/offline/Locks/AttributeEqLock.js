module.exports = function(Lock) {
    "use strict";
    
    var AttributeEqLock = function(lock) {
        // call the super class constructor
        Lock.call(this, lock);
    }

    Lock.registerLock("attrEq", AttributeEqLock);

    AttributeEqLock.prototype = Object.create(Lock.prototype);

    AttributeEqLock.prototype.copy = function() {
        var c = new AttributeEqLock(this);
        return c;
    }

    function check(subject, lock) {
        var match = false;
        if(subject.data.hasOwnProperty(lock.args[0]))
            if(subject.data[lock.args[0]] == lock.args[1])
                match = true;
        
        if(match && !lock.not || !match && lock.not)
            return { result : true, conditional : false };
        else
            return { result : false, conditional : false, lock : lock };
    }

    AttributeEqLock.prototype.handleUser = function(subject, isStatic) {
        if(isStatic) {
            throw new Error("AttributeEqLock.prototype.handleUser: Not support for static eval yet");
        } else {
            return check(subject, this);
        }
    };

    AttributeEqLock.prototype.handleSO = function(subject, isStatic) {
        if(isStatic) {
            throw new Error("AttributeEqLock.prototype.handleSO: Not support for static eval yet");
        } else {
            return check(subject, this);
        }
    };

    AttributeEqLock.prototype.handleAny = function(subject, isStatic) {
        if(isStatic) {
            throw new Error("AttributeEqLock.prototype.handleAny is not supported in static analysis, yet.");
        } else {
            var r = this.handleUser(subject, isStatic);
            var acResult = r.result;
            if(r.result && !this.not)
                return r;

            r = this.handleSO(subject, isStatic);
            acResult &= r.result;
            if(r.result && !this.not) 
                return r;

            if(this.not && !acResult)
                return { result : true, conditional : false };
            else
                return { result : false, conditional : false, lock : this };
        }
    };

    AttributeEqLock.prototype.isOpen = function(context, scope) {
	    if(context) {
            var subject = null;

            switch(scope) {
            case "/any" :
                return this.handleAny(context.subject, context.isStatic);
                break;
            case "/sensor" :            
                return this.handleSO(context.subject, context.isStatic);
                break;
            case "/user" :
                return this.handleUser(context.subject, context.isStatic);
                break;
            default :
                throw new Error("Scope is not supported for for hasAttribute lock evaluation.");
            }
        } else {
            throw new Error("AttributeEqLock: Requires user, sender or receiver context to evaluate lock. Context type set?");
        }
    };

    AttributeEqLock.prototype.lub = function(lock) {
        if(this.eq(lock))
            return Lock.createLock(this);
        else
            return null;
    };

    AttributeEqLock.prototype.le = function(lock) {
        if(this.eq(lock))
            return true;
        else
            return false;
    };
}
