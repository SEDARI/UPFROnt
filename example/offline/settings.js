module.exports = {
    ulocks: {
        entityTypes : {
            "/any"    :  0,
            "/group"  :  1,
            "/user"   :  2,
            "/sensor" :  3,
            "/client" :  4,
            "/api"    :  5,
            "/const"  :  6,
            "/attr"   :  6,
            "/prop"   :  6,
            "/var"    :  6,
        },
        locks: "./Locks/",
        actions: "./Actions"
    },
    pdp : {
    },
    pap: {
        // this specifies host, port and path where
        // this module should wait for requests
        // if specified, the module runs as a PAP server
        // if undefined, the module runs as a PAP client
        // accessing another PAP server
        server: {
            host: "localhost",
            port: 1234,
            path: "/pap/",
            tls: false,
            cluster: 1
        },
        // storage specifies where the policies
        // are stored persistently:
        // 1. if policies are stored remotely
        // in another PAP, specify as type "remote"
        // and indicate host, port and path
        // 2. if policies are stored locally
        // in a database, specify the db module
        // ("mongodb", tbd) and the hostname and
        // port
        // thus, specifying type "remote" and specifying
        // api yields an invalid configuration
        storage: {
            type: "mongodb",
            host: "localhost",
            port: 27017,
            password: "",
            user: "",
            dbName: "pap-database",
            collection: "policies",

            // specifies whether the module should check
            // the cache to fetch a policy, of course,
            // this may induce additional lookups but on
            // average using the cache is recommended
            cache: {
                enabled: false,
                TTL: 600,
                sync: {
                    type: "redis",
                    channel: "policyUpdates"
                }
            }
        }
    }
};
