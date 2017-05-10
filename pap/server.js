var bodyParser = require('body-parser');
var express = require('express');
var path = require('path');
var w = require('winston');

function Server(settings) {
    this.settings = settings;
    this.useCluster = false;
    this.cluster = null;
    this.server = null;

    this.app = null;
};

Server.prototype.init = function(initFunction) {
    this.app = express();

    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({extended: true}));

    if(this.settings && this.settings.cluster && this.settings.cluster > 1) {
        this.cluster = require('cluster');
        this.useCluster = true;
    } else
        this.useCluster = false;

    var self = this;

    if (this.useCluster) {
        if(this.cluster.isMaster) {
            // Count the machine's CPUs
            var cpuCount = require('os').cpus().length;
            if(this.settings.cluster < cpuCount)
                cpuCount = this.settings.cluster;

            var promises = [];
            // Create a worker for each CPU
            for (var i = 0; i < cpuCount; i += 1) {
                promises.push(new Promise(function(resolve, reject) {
                    var worker = self.cluster.fork().on('online', function() {
                        worker.on('message', function(msg) {
                            if(msg.msg) {
                                resolve();
                            } else if(msg.error) {
                                reject(new Error(JSON.stringify(msg.error)));
                                worker.kill();
                            } else {
                                reject(new Error("Unspecified error in worker."));
                            }
                        });
                    });
                }));
            }

            return Promise.all(promises);
        } else {
            var self = this;
            var f = function(resolve, reject) {
                self.server = self.app.listen(
                    self.settings.port,
                    self.settings.host,
                    function () {
                        initFunction().then(function() {
                            var msg = "UPFront PAP instance ("+process.pid+") is now running at "+getListenPath(self.settings);
                            process.tite = "UPFront PAP";
                            process.send({msg: msg});
                        }, function(e) {
                            process.send({error: e});
                        })
                    });
            };
            
            f(console.log, console.log);
            return Promise.resolve(false);
        }
    } else {
        w.info("PAP Server is running without cluster.");
        return new Promise(function(resolve, reject) {
            self.server = self.app.listen(
                self.settings.port,
                self.settings.host,
                function() {
                    initFunction().then(function(r) {
                        resolve(r);
                    }, function(e) {
                        reject(e);
                    })
                });
        });
    }
};

function getListenPath(settings) {
    var listenPath = 'http' + (settings.tls ? 's' : '') + '://'+
        (settings.host == '0.0.0.0' ? '127.0.0.1' : settings.host)+
        ':'+settings.port + "/";

    if(settings.path.startsWith("/"))
        listenPath += settings.path.substring(1);
    else
        listenPath += settings.path;

    if(!listenPath.endsWith("/"))
        listenPath += "/";

    return listenPath;
};


module.exports = Server;
