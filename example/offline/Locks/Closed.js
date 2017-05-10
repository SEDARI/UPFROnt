module.exports = function(Lock) {
    "use strict";
    
    var ClosedLock = function(lock) {
        // call the super class constructor
        // ClosedLock.super_.call(this, lock);
        Lock.call(this, lock);
    }

    Lock.registerLock("closed", ClosedLock);

    ClosedLock.prototype = Object.create(Lock.prototype);

    ClosedLock.prototype.copy = function() {
        var c = new Closed();
        return c;
    }

    ClosedLock.prototype.eq = function(lock) {
        return (lock.lock == this.lock) && (this.not == lock.not);
    }

    ClosedLock.prototype.isOpen = function(context) {
        return { open : false, conditional : false };
    }

    ClosedLock.prototype.lub = function(lock) {
        return Lock.createLock(this);
    }

    ClosedLock.prototype.toString = function(lock) {
        return "[[ closed ]]";
    }
}
