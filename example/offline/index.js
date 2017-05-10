var settings = require('./settings.js');
var upfront = require('./../../index.js');

var pap = upfront.pap;
var pdp = upfront.pdp;
var pep = upfront.pep;

var sample = require('./sample');

var papDB = {};
var setting = [];
var retrieve = [];
var deletions = [];

function chainError(e) {
    return Promise.reject(e);
}

upfront.init(settings)
    .then(function() {
        var creation = [];
        creation.push(pap.set(sample.entities.user.id, sample.policies.defaultActor));
        creation.push(pap.set(sample.entities.admin.id, sample.policies.defaultActor));
        creation.push(pap.set(sample.entities.sensor.id, sample.policies.defaultActor));
        creation.push(pap.set(sample.entities.sensor2.id, sample.policies.defaultActor));
        creation.push(pap.set(sample.entities.client.id, sample.policies.defaultActor));

        return Promise.all(creation);
    }, chainError).then(function() {      
        var retrieve = [];

        retrieve.push(pap.get(sample.entities.user.id));
        retrieve.push(pap.get(sample.entities.admin.id));
        retrieve.push(pap.get(sample.entities.sensor.id));
        retrieve.push(pap.get(sample.entities.sensor2.id));
        retrieve.push(pap.get(sample.entities.client.id));

        return Promise.all(retrieve);
    }, function(e) {
        return Promise.reject(e);
    })
    .then(function(v) {
        for(var i = 0; i < 5; i++)
            console.log("values["+i+"]: " + v[i]);
        
        if(!v[0] || !v[0].eq(sample.policies.defaultActor) ||
           !v[1] || !v[1].eq(sample.policies.defaultActor) ||
           !v[2] || !v[2].eq(sample.policies.defaultActor) ||
           !v[3] || !v[3].eq(sample.policies.defaultActor) ||
           !v[4] || !v[4].eq(sample.policies.defaultActor))
            return Promise.reject(new Error("Actor policy mismatches!"));

        var setting = [];
        // set the default policy for all properties, i.e. everyone may read only the owner may write
        // WARNING: In production this should first be set more restrictive, otherwise, the password
        // can be read during creation (use policy such as sample.policies.adminOnly)
        setting.push(pap.set(sample.entities.user.id, "", sample.policies.defaultEntity));
        setting.push(pap.set(sample.entities.admin.id, "", sample.policies.defaultEntity));
        setting.push(pap.set(sample.entities.sensor.id, "", sample.policies.defaultEntity));
        setting.push(pap.set(sample.entities.client.id, "", sample.policies.defaultEntity));

        // set the policies for the properties
        setting.push(pap.set(sample.entities.user.id, "password", sample.policies.defaultPasswd));
        setting.push(pap.set(sample.entities.admin.id, "password", sample.policies.defaultPasswd));

        setting.push(pap.set(sample.entities.user.id, "role", sample.policies.defaultRole));
        setting.push(pap.set(sample.entities.admin.id, "role", sample.policies.defaultRole));

        setting.push(pap.set(sample.entities.sensor.id, "credentials", sample.policies.defaultPasswd));
        setting.push(pap.set(sample.entities.client.id, "credentials", sample.policies.defaultPasswd));

        // TODO what if one element is declassified in an array ... it should still be in the correct position
        // but it also reveals that there was another declassified element
        setting.push(pap.set(sample.entities.sensor.id, "credentials[1].system", sample.policies.defaultRole));
        setting.push(pap.set(sample.entities.sensor.id, "credentials[2].system", sample.policies.defaultRole));

        return Promise.all(setting);
    }, function(e) {
        console.log("ERROR: Unable to retrieve all policies: " + e);
        return Promise.reject(e);
    })
    .then(function(v) {
        for(var i = 0; i < 12; i++)
            console.log("values["+i+"]: ", v[i]);

        var retrieve = [];
        retrieve.push(pap.get(sample.entities.user.id, ""));
        retrieve.push(pap.get(sample.entities.admin.id, ""));
        retrieve.push(pap.get(sample.entities.sensor.id, ""));
        retrieve.push(pap.get(sample.entities.client.id, ""));
        
        // set the policies for the properties
        retrieve.push(pap.get(sample.entities.user.id, "password"));
        retrieve.push(pap.get(sample.entities.admin.id, "password"));
        
        retrieve.push(pap.get(sample.entities.user.id, "role"));
        retrieve.push(pap.get(sample.entities.admin.id, "role"));
        
        retrieve.push(pap.get(sample.entities.sensor.id, "credentials"));
        retrieve.push(pap.get(sample.entities.client.id, "credentials"));
        
        retrieve.push(pap.get(sample.entities.sensor.id, "credentials[1].system"));
        retrieve.push(pap.get(sample.entities.sensor.id, "credentials[2].system"));
        
        return Promise.all(retrieve);
    }, chainError).then(function(values) {
        for(var i = 0; i < 12; i++)
            console.log("values["+i+"]: ", values[i]);
            
        if(!values[0].eq(sample.policies.defaultEntity) ||
           !values[1].eq(sample.policies.defaultEntity) ||
           !values[2].eq(sample.policies.defaultEntity) ||
           !values[3].eq(sample.policies.defaultEntity))
            return Promise.reject(new Error("default entity policies modified during creation or retrieval"));
        
        
        if(!values[4].eq(sample.policies.defaultPasswd) ||
           !values[5].eq(sample.policies.defaultPasswd))
            return Promise.reject(new Error("default password policies modified during creation or retrieval"));
        
        if(!values[6].eq(sample.policies.defaultRole) ||
           !values[7].eq(sample.policies.defaultRole))
            return Promise.reject(new Error("default role policy modified during creation or retrieval"));
                    
        if(!values[8].eq(sample.policies.defaultPasswd) ||
           !values[9].eq(sample.policies.defaultPasswd))
            return Promise.reject(new Error("default credentials policy modified during creation or retrieval"));
                    
        if(!values[10].eq(sample.policies.defaultRole) ||
           !values[11].eq(sample.policies.defaultRole))
            return Promise.reject(new Error("default entity policy modified during creation or retrieval"));

        console.log("storing and retrieval works, testing policy decisions now");
        
        return Promise.resolve();
    }, chainError).then(function() {
        // *******************************************************
        // storing and retrieval works, lets test policy decisions
        // *******************************************************
        
        // USER WRITES TO ADMIN PASSWORD
        var p = pdp.checkWrite(sample.entities.user, sample.policies.defaultActor, sample.entities.admin, sample.policies.defaultPasswd);
        return p;
    }, chainError).then(function(decision) {
        if(decision.result !== false)
            return Promise.reject(new Error("ERROR: Write from user to admin password should be forbidden but is allowed: ",decision));
        else
            console.log("Success: Write from user to admin not granted");

        // USER READS ADMIN PASSWORD
        return pdp.checkRead(sample.entities.user, sample.policies.defaultActor, sample.entities.admin, sample.policies.defaultPasswd);
    }, chainError).then(function(decision) {
        if(decision.result !== false)
            return Promise.reject(new Error("ERROR: Read from user of admin password should be forbidden but is allowed: ",decision));
        else
            console.log("Success: Read from user to admin password not granted");

        // ADMIN WRITES ITS PASSWORD
        return pdp.checkWrite(sample.entities.admin, sample.policies.defaultActor, sample.entities.admin, sample.policies.defaultPasswd);
    }, chainError).then(function(decision) {
        if(decision.result !== true)
            return Promise.reject(new Error("ERROR: Write from admin to admin password should be allowed but is forbidden: ",decision));
        else
            console.log("Success: Write from admin to admin password granted");

        // ADMIN READS ITS PASSWORD
        return pdp.checkRead(sample.entities.admin, sample.policies.defaultActor, sample.entities.admin, sample.policies.defaultPasswd);
    }, chainError).then(function(decision) {
        if(decision.result !== true) {
            return Promise.reject(new Error("ERROR: Read from admin of admin password should be allowed but is forbidden: ", decision));
        } else
            console.log("Success: Read from admin to admin password granted");

        // ADMIN SETS PASSWORD OF USER
        return pdp.checkWrite(sample.entities.admin, sample.policies.defaultActor, sample.entities.user, sample.policies.defaultPasswd);
    }, chainError).then(function(decision) {
        if(decision.result !== true)
            return Promise.reject(new Error("ERROR: Write from admin to user password should be allowed but is forbidden: ",decision));
        else
            console.log("Success: Write from admin to user password granted");

        // ADMIN SETS ROLE OF USER
        return pdp.checkWrite(sample.entities.admin, sample.policies.defaultActor, sample.entities.user, sample.policies.defaultRole);
    }, chainError).then(function(decision) {
        if(decision.result !== true)
            return Promise.reject(new Error("ERROR: Write from admin to user role should be allowed but is forbidden: ",decision));
        else
            console.log("Success: Write from admin to user role granted");

        // USER SETS ROLE OF USER
        return pdp.checkWrite(sample.entities.user, sample.policies.defaultActor, sample.entities.user, sample.policies.defaultRole);
    }, chainError).then(function(decision) {
        if(decision.result !== false)
            return Promise.reject(new Error("ERROR: Write from user to user role should be forbidden but is allowed: ",decision));
        else
            console.log("Success: Write from user to user role not granted");

        // USER SETS NAME OF SENSOR HE DOES NOT OWN
        return pdp.checkWrite(sample.entities.user, sample.policies.defaultActor, sample.entities.sensor, sample.policies.defaultEntity);
    }, chainError).then(function(decision) {
        if(decision.result !== false)
            return Promise.reject(new Error("ERROR: Write from user to sensor name should be forbidden but is allowed: ",decision));
        else
            console.log("Success: Write from user to sensor name not granted");

        // ADMIN SETS NAME OF SENSOR HE OWNS
        return pdp.checkWrite(sample.entities.admin, sample.policies.defaultActor, sample.entities.sensor, sample.policies.defaultEntity);
    }, chainError).then(function(decision) {
        if(decision.result !== true)
            return Promise.reject(new Error("ERROR: Write from admin to sensor name should be allowed but is forbidden: ",decision));
        else
            console.log("Success: Write from admin to sensor name granted");
        
        return pep.declassify(sample.entities.sensor, sample.entities.admin);
    }, chainError).then(function(filteredObject) {
        if(filteredObject.credentials.length != 4)
            return Promise.reject(new Error("ERROR: Object was filtered incorrectly: " + JSON.stringify(filteredObject, null, 2)));
        else
            console.log("Success: Credentials were not filtered.");

        // DECLASSIFY SENSOR RECORD SENT TO USER
        return pep.declassify(sample.entities.sensor, sample.entities.user);
    }, chainError).then(function(filteredObject) {
        if(filteredObject.credentials.length != 4 &&
           (filteredObject.credentials[0] !== null || filteredObject.credentials[3] !== null))
                return Promise.reject(new Error("ERROR: Object was filtered incorrectly: " + JSON.stringify(filteredObject, null, 2)));
        else
            console.log("Success: Credentials were filtered.");

        return Promise.resolve();
    }, chainError).then(function() {
        // USER SETS NAME OF CLIENT HE DOES NOT OWN
        return pdp.checkWrite(sample.entities.user, sample.policies.defaultActor, sample.entities.client, sample.policies.defaultEntity);
    }, chainError).then(function(decision) {
        if(decision.result !== false)
            return Promise.reject(new Error("ERROR: Write from user to client name should be forbidden but is allowed: ", decision));
        else
            console.log("Success: Write from user to client name not granted");

        // ADMIN SETS NAME OF CLIENT HE OWNS
        return pdp.checkWrite(sample.entities.admin, sample.policies.defaultActor, sample.entities.client, sample.policies.defaultEntity);
    }, chainError).then(function(decision) {
        if(decision.result !== true)
            return Promise.reject(new Error("ERROR: Write from admin to client name should be allowed but is forbidden: ", decision));
        else
            console.log("Success: Write from admin to client name granted");

        return Promise.resolve();
    }, chainError).then(function() {
        values = [];
        return pap.del(sample.entities.sensor.id, "");
    }, chainError).then(function(r) {
        values.push(r);
        return pap.del(sample.entities.sensor.id, "credentials");
    }, chainError).then(function(r) {
        values.push(r);
        for(var d in values)
            if(!values[d])
                return Promise.reject(new Error("ERROR: Property policy deletion was not successful: "+JSON.stringify(values[d])));
        
        return pap.getFullRecord(sample.entities.sensor.id);
    }, chainError).then(function(r) {
        if(r.o.s === undefined || r.o.s === undefined || r.o.s !== null ||
           r.o.p === undefined || r.o.p.credentials === undefined ||
           r.o.p.credentials.s === undefined || r.o.p.credentials.s !== null)
            return Promise.reject(new Error("ERROR: Deletion did not reset policies or destroyed PAP structure"));
        else
            console.log("Success: Properties deleted successfully");

        // TODO: Wrong test case as this should only delete the entity policy not the whole record
           return pap.del(sample.entities.sensor.id);
    }, chainError).then(function(del) {
        if(del === null)
            return Promise.reject(new Error("ERROR: Entity policy deletion was not successful."));
        else
            console.log("Success: Entity policy deletion was triggered.");
        
        return pap.get(sample.entities.sensor.id);
    }, chainError).then(function(r) {
        if(r !== null)
            return Promise.reject(new Error("Entity policy deletion was not successful as the sensor still has a policy"));
        else
            console.log("Success: Sensor does not have policy after deletion.");

        return pap.delRecord(sample.entities.sensor.id);
    }, chainError).then(function(del) {
        if(del === null)
            return Promise.reject(new Error("PolicyObject record deletion was not successful."));
        else
            console.log("Success: PolicyObject record deletion was triggered.");

        return pap.get(sample.entities.sensor.id);
    }, chainError).then(function(r) {
        if(r !== null) 
            return Promise.reject(new Error("Record deletion was not successful as the record for this sensor still exists"));
        else
            console.log("Success: Sensor does not have a record.");

        return pap.delRecord(sample.entities.sensor.id);
    }, chainError).then(function(del) {
        if(del !== null)
            return Promise.reject(new Error("It should not be possible to delete a PolicyObject record policy a second time!"));
        else
            console.log("Success: PolicyObject record can only be deleted once.");

        return Promise.resolve();
    }, chainError).catch(function(reason) {
        if(reason && reason.stack !== undefined)
            console.log(reason.stack);
        else
            console.log("ERROR: "+reason);
    });

