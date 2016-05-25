'use strict';
var assert = require('assert');
var sticky = require('../');
var path = require('path');
var http = require('http');
var recluster = require('recluster');

var PORT = 8099;

describe('GET /', function() {
    it('shdould respond from worker', function(done) {
        var cluster = recluster(path.join(__dirname, 'harness/server.js'), {
            readyWhen: 'ready'
        });
        cluster.run();

        assert(cluster.activeWorkers().length > 1);
        var balancer = sticky.createBalancer({activeWorkers: cluster.activeWorkers});
        balancer.listen(PORT, function() {
            // Master
            var waiting = 100;
            var sticky = null;

            function cb(res) {
                if (sticky == null) {
                    sticky = res.headers['x-sticky'];
                }
                assert.notEqual(res.headers['x-sticky'], null);
                assert(res.headers['x-sticky'] === sticky);
                sticky = res.headers['x-sticky'];
                res.resume();
                if (--waiting === 0) {
                    done();
                }
            }

            for (var i = 0; i < waiting; i++) {
                http.request({
                    method: 'GET',
                    host: '127.0.0.1',
                    port: PORT
                }, cb).end();
            }
        });
    });
});

