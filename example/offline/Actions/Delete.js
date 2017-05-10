module.exports = function(Action) {
    "use strict";
    
    var Delete = function(action) {
        Action.call(this, action);
    }

    Action.register("delete", Delete);
    
    Delete.prototype = Object.create(Action.prototype);

    Delete.prototype.copy = function(d) {
        var c = new Delete(d);
        return c;
    }

    Delete.prototype.perform = function(msg) {
        console.log("Apply delete action");

        return Promise.resolve({});
    }
    
    Delete.prototype.toString = function(args) {
        return "<< delete >>";
    }
}
