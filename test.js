
var request = require('request');
var assert = require('assert'),
    //kukarddd
    http = require('http');

    supertest = require('supertest'),
    api = supertest('http://localhost:3000/api/temp');


describe('Unit Test 1: Check if API is live', function () {
    it('should return 200, OK', function (done) {
        http.get('http://localhost:3000/api/temp', function (res) {
            assert.equal(200, res.statusCode);
            done();
        });
    });
});




//wahegurujii