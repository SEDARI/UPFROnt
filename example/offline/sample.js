module.exports = {
    entities : {
        admin : {
            "user_name":"bob",
            "auth_type":"agile-local",
            "password":"secret",
            "id":"bob!@!agile-local",
            "type":"/user",
            "role":"admin",
            "owner":"bob!@!agile-local"
        },
        user : {
            "user_name":"alice",
            "auth_type":"agile-local",
            "password":"secret",
            "id":"alice!@!agile-local",
            "type":"/user",
            "role":"student",
            "owner":"alice!@!agile-local"
        },
        sensor : {
            "name"  : "sensor",
            "id"    : "some_id_for_sensor",
            "type"  : "/sensor",
            "owner" : "bob!@!agile-local",
            "credentials" : [
                "start token",
                {"system" : "dropbox", "value": "xyzsometoken"},
                {"system" : "github", "value": "xyzsomeothertoken"},
                "sometoken in a mixed array"
            ]
        },
        sensor2: {
            "credentials"  : [ "sensor" ],
            "id"    : "some_id_for_sensor2"
        },            
        client : {
            "name"  : "client",
            "id"    : "some_id_for_client",
            "type"  : "/client",
            "owner" : "bob!@!agile-local",
            "credentials" : [ "foo", "bar" ]
        },
    },
    policies : {
        // default policy for an entity if becomes an active entity, trying to interact with other entities
        defaultActor : [
            // actions of an actor are not restricted a priori
            { target : { type: "/any" } },
            { source : { type: "/any" } }
        ],
        // default policy for all properties of entities
        defaultEntity : { flows: [
            // all properties can be read by everyone
            { target : { type: "/any" } },
            // all properties can only be changed by the owner of the entity
            { source : { type: "/user" }, locks : [ { lock : "isOwner" } ] }
        ], actions: [ { name: "delete" } ] },
        defaultPasswd : [
            // the property can only be read by the user itself
            { target : { type: "/user" }, locks : [ { lock : "isOwner" } ] },
            // the property can be set by the user itself and
            { source : { type: "/user" }, locks : [ { lock : "isOwner" } ] },
            // by all users with role admin
            { source : { type: "/user" }, locks : [ { lock : "attrEq", args : [ "role", "admin" ] } ] }
        ],
        defaultRole : [
            // can be read by everyone 
            { target : { type: "/any" } },
            // can only be changed by users with role admin
            { source : { type: "/user" }, locks : [ { lock : "attrEq", args : [ "role", "admin" ] } ] }
        ],
        adminOnly : [
            { target : { type: "/user" }, locks : [ { lock : "attrEq", args : [ "role", "admin" ] } ] },
            { source : { type: "/user" }, locks : [ { lock : "attrEq", args : [ "role", "admin" ] } ] }
        ]
    }
};
