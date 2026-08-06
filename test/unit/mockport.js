"use strict";

const assert = require('assert'),
    request = require('supertest'),
    fs = require('fs'),
    path = require('path');

const mockPort = require('../../src/mockport');

const mocks = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../data/mock.json'))
);

// Silence the request/mock logging that listen() would otherwise emit.
const quiet = () => { };

function app(overrides) {
    return mockPort.createApp(Object.assign({
        app: 'mockport-server',
        version: 'test',
        service: 'myapi',
        port: 1234,
        headers: true,
        mocks: mocks,
        log: quiet
    }, overrides));
}

describe('mockport', function () {

    describe('matched mocks', function () {

        it('returns the configured status and body for a GET', function () {
            return request(app())
                .get('/pets/1')
                .expect(200)
                .expect('Content-Type', /json/)
                .then(res => {
                    assert.deepStrictEqual(res.body, { id: 1, name: 'Pepper' });
                });
        });

        it('matches a url that includes a query string', function () {
            return request(app())
                .get('/api/login?foo=bar&message=ping')
                .expect(201)
                .then(res => {
                    assert.deepStrictEqual(res.body, { message: 'pong' });
                });
        });

        it('returns the configured status and body for a POST', function () {
            return request(app())
                .post('/pets')
                .send({ name: 'Bluey' })
                .expect(201)
                .then(res => {
                    assert.deepStrictEqual(res.body, { id: 5, name: 'Bluey' });
                });
        });

        it('sends no content when the configured status is 204', function () {
            return request(app())
                .put('/pets/8')
                .send({})
                .expect(204)
                .then(res => {
                    assert.deepStrictEqual(res.body, {});
                    assert.strictEqual(res.text, '');
                });
        });

        it('honors a status with no body', function () {
            return request(app())
                .patch('/pets/2')
                .send({})
                .expect(401)
                .then(res => {
                    assert.strictEqual(res.text, '');
                });
        });

        it('returns a body alongside an error status', function () {
            return request(app())
                .patch('/pets/3')
                .send({})
                .expect(403)
                .then(res => {
                    assert.deepStrictEqual(res.body, {
                        error: 'Forbidden - you are not authorized'
                    });
                });
        });

        it('falls back to the per-method default status when none is given', function () {
            // PATCH defaults to 204, so the mock's body is intentionally dropped.
            return request(app())
                .patch('/pets/4')
                .send({})
                .expect(204)
                .then(res => {
                    assert.strictEqual(res.text, '');
                });
        });

        it('handles a mock with no response block at all', function () {
            return request(app())
                .patch('/pets/1')
                .send({})
                .expect(204);
        });

        it('handles DELETE', function () {
            return request(app())
                .delete('/pets/5')
                .expect(204);
        });

        it('auto-registers HEAD for each mock so curl -I reports a status', function () {
            return request(app())
                .head('/pets/1')
                .expect(200);
        });
    });

    describe('unmatched requests', function () {

        it('returns 404 by default', function () {
            return request(app())
                .get('/nope')
                .expect(404);
        });

        it('honors a custom notFoundStatus', function () {
            return request(app({ notFoundStatus: 418 }))
                .get('/nope')
                .expect(418);
        });

        it('does not match a mock url when the query string differs', function () {
            return request(app())
                .get('/api/login?foo=bar')
                .expect(404);
        });

        it('does not match a mocked url under a different method', function () {
            return request(app())
                .post('/pets/1')
                .send({})
                .expect(404);
        });
    });

    describe('configuration', function () {

        it('serves nothing but 404s when no mocks are supplied', function () {
            return request(app({ mocks: undefined }))
                .get('/pets/1')
                .expect(404);
        });

        it('enables CORS', function () {
            return request(app())
                .get('/pets/1')
                .expect('Access-Control-Allow-Origin', '*')
                .expect(200);
        });

        it('accepts a request with no body and no content-type', function () {
            // Express 5 leaves req.body undefined here; the handler must not throw.
            return request(app())
                .get('/pets/2')
                .expect(200)
                .then(res => {
                    assert.deepStrictEqual(res.body, { id: 2, name: 'Marchio' });
                });
        });
    });

    describe('listen', function () {

        it('binds a port and serves mocks', function (done) {
            const server = mockPort.listen({
                app: 'mockport-server',
                version: 'test',
                service: 'myapi',
                port: 0,          // let the OS pick a free port
                mocks: mocks,
                log: quiet
            });

            server.on('listening', () => {
                request(server)
                    .get('/pets/1')
                    .expect(200)
                    .then(() => server.close(done))
                    .catch(err => server.close(() => done(err)));
            });
        });
    });
});
