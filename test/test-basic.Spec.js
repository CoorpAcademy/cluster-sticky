'use strict';
var assert = require('assert');
var sticky = require('../');
var path = require('path');
var http = require('http');
var recluster = require('recluster');
var getPort = require('get-port');
var Promise = require('bluebird');
var cluster = null;
var maxWorkers = 4;
describe('GET /', function() {
    it('should respond from worker', function(done) {
        this.timeout(10000);

        function startServer(port) {
            cluster = recluster(path.join(__dirname, 'harness/server.js'), {
                readyWhen: 'ready',
                workers: maxWorkers
            });
            cluster.run();
            return port;
        }

        function waitForWorkers(port) {
            function workerIsReady(resolve) {
                if (cluster.activeWorkers().length === maxWorkers) {
                    return resolve(port);
                }
                setTimeout(function() {
                    workerIsReady(resolve);
                }, 100);
            }

            return new Promise(function(resolve) {
                workerIsReady(resolve);
            });
        }

        function test(port) {
            var balancer = sticky.createBalancer({activeWorkers: cluster.activeWorkers});
            balancer.listen(port, function() {
                // Master
                var waiting = 50;
                var sticky = null;

                function cb(res) {
                    if (sticky === null) {
                        sticky = res.headers['x-sticky'];
                    }
                    assert.equal(res.statusCode, 200);
                    assert.equal(res.headers['x-sticky'].indexOf('process='), 0);
                    assert(res.headers['x-sticky'] === sticky);
                    res.resume();
                    if (--waiting === 0) {
                        cluster.terminate(done);
                    }
                }

                function call() {
                    var req = http.request({
                        method: 'GET',
                        host: '127.0.0.1',
                        port: port
                    }, cb);
                    req.end();
                }

                for (var i = 0; i < waiting; i++) {
                    call();
                }
            });
        }

        getPort()
        .then(startServer)
        .then(waitForWorkers)
        .then(test);
    });
});

