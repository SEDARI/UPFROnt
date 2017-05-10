module.exports = function(Lock) {
    "use strict";

    var IsOwnerLock = function(lock) {
        // call the super class constructor
        Lock.call(this, lock);
    };

    Lock.registerLock("isOwner", IsOwnerLock);

    IsOwnerLock.prototype = Object.create(Lock.prototype);

    IsOwnerLock.prototype.copy = function() {
        var c = new IsOwnerLock(this);
        return c;
    }

    IsOwnerLock.prototype.handleUser = function(subject, object, isStatic) {
        if(isStatic) {
            throw new Error("handleUser for hasId lock is not supported in static analysis yet");
        } else {
            if((subject.type == '/user' && object.data.hasOwnProperty('owner') &&
                object.data.owner == subject.data.id && !this.not) ||
               ((subject.type != '/user' || !object.data.hasOwnProperty('owner') ||
                 object.data.owner != subject.data.id) && this.not))
                return { result : true, conditional : false };
            else
                return { result : false, conditional : false, lock : this };
        }
    };

    IsOwnerLock.prototype.handleSensor = function(subject, object, isStatic) {
        if(isStatic) {
            throw new Error("handleSO for hasId lock is not supported in static analysis yet");
        } else {
            if((subject.type == '/sensor' && object.data.hasOwnProperty('owner') &&
                object.data.owner == subject.data.id && !this.not) ||
               ((subject.type != '/sensor' || !object.data.hasOwnProperty('owner') ||
                 object.data.owner != subject.data.id) && this.not))
                return { result : true, conditional : false };
            else
                return { result : false, conditional : false, lock : this };
        }
    };

    IsOwnerLock.prototype.handleAny = function(subject, object, isStatic) {
        if(isStatic) {
            throw new Error("IsOwnerLock.prototype.handleAny is not supported in static analysis, yet.");
        } else {
            var r = this.handleSensor(subject, object, isStatic);
            if(this.not) {
                if(!r.result)
                    return { result : false, conditional : false, lock : this };
            } else
                if(r.result)
                    return r;

            r = this.handleUser(subject, object, isStatic);
            if(this.not) {
                if(!r.result)
                    return { result : false, conditional : false, lock : this };
            } else {
                if(r.result)
                    return r;
            }
            
            if(this.not)
                return { result : true, conditional : false };
            else
                return { result : false, conditional : false, lock : this };
        }
    };

    IsOwnerLock.prototype.isOpen = function(context, scope) {
	    if(context) {
            switch(scope) {
            case "/any" :
                return this.handleAny(context.subject, context.object, context.isStatic);
                break;
            case "/user" :
                return this.handleUser(context.subject, context.object, context.isStatic);
                break;
            case "/sensor" :
                return this.handleSensor(context.subject, context.object, context.isStatic);
                break;
            default :
                throw new Error("Unknown scope '"+scope+"' for isOwner lock evaluation.");
            }
        } else {
            throw new Error("IsOwnerLock: Requires sender or receiver context to evaluate lock. Did you set context type?");
        }
    };

    IsOwnerLock.prototype.lub = function(lock) {
        if(this.eq(lock))
		    return this;
        else {
            if(this.lock == lock.lock)
                return Lock.closedLock();
            else
                return null;
        }
    };
}
