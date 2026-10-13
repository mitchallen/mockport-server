"use strict";

const { describe, it } = require('node:test'),
    assert = require('assert'),
    fs = require('fs'),
    path = require('path');

const request = require('../helpers/request');
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

        it('returns the configured status and body for a GET', async function () {
            const res = await request(app(), 'get', '/pets/1');
            assert.strictEqual(res.status, 200);
            assert.match(res.headers.get('content-type'), /json/);
            assert.deepStrictEqual(res.body, { id: 1, name: 'Pepper' });
        });

        it('matches a url that includes a query string', async function () {
            const res = await request(app(), 'get', '/api/login?foo=bar&message=ping');
            assert.strictEqual(res.status, 201);
            assert.deepStrictEqual(res.body, { message: 'pong' });
        });

        it('returns the configured status and body for a POST', async function () {
            const res = await request(app(), 'post', '/pets', { name: 'Bluey' });
            assert.strictEqual(res.status, 201);
            assert.deepStrictEqual(res.body, { id: 5, name: 'Bluey' });
        });

        it('sends no content when the configured status is 204', async function () {
            const res = await request(app(), 'put', '/pets/8', {});
            assert.strictEqual(res.status, 204);
            assert.deepStrictEqual(res.body, {});
            assert.strictEqual(res.text, '');
        });

        it('honors a status with no body', async function () {
            const res = await request(app(), 'patch', '/pets/2', {});
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.text, '');
        });

        it('returns a body alongside an error status', async function () {
            const res = await request(app(), 'patch', '/pets/3', {});
            assert.strictEqual(res.status, 403);
            assert.deepStrictEqual(res.body, {
                error: 'Forbidden - you are not authorized'
            });
        });

        it('falls back to the per-method default status when none is given', async function () {
            // PATCH defaults to 204, so the mock's body is intentionally dropped.
            const res = await request(app(), 'patch', '/pets/4', {});
            assert.strictEqual(res.status, 204);
            assert.strictEqual(res.text, '');
        });

        it('handles a mock with no response block at all', async function () {
            const res = await request(app(), 'patch', '/pets/1', {});
            assert.strictEqual(res.status, 204);
        });

        it('handles DELETE', async function () {
            const res = await request(app(), 'delete', '/pets/5');
            assert.strictEqual(res.status, 204);
        });

        it('auto-registers HEAD for each mock so curl -I reports a status', async function () {
            const res = await request(app(), 'head', '/pets/1');
            assert.strictEqual(res.status, 200);
        });
    });

    describe('unmatched requests', function () {

        it('returns 404 by default', async function () {
            const res = await request(app(), 'get', '/nope');
            assert.strictEqual(res.status, 404);
        });

        it('honors a custom notFoundStatus', async function () {
            const res = await request(app({ notFoundStatus: 418 }), 'get', '/nope');
            assert.strictEqual(res.status, 418);
        });

        it('does not match a mock url when the query string differs', async function () {
            const res = await request(app(), 'get', '/api/login?foo=bar');
            assert.strictEqual(res.status, 404);
        });

        it('does not match a mocked url under a different method', async function () {
            const res = await request(app(), 'post', '/pets/1', {});
            assert.strictEqual(res.status, 404);
        });
    });

    describe('configuration', function () {

        it('serves nothing but 404s when no mocks are supplied', async function () {
            const res = await request(app({ mocks: undefined }), 'get', '/pets/1');
            assert.strictEqual(res.status, 404);
        });

        it('enables CORS', async function () {
            const res = await request(app(), 'get', '/pets/1');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
        });

        it('builds with no spec at all, logging to console.log', async function () {
            const logged = [];
            const original = console.log;
            console.log = (...args) => { logged.push(args); };
            let res;
            try {
                res = await request(mockPort.createApp(), 'get', '/pets/1');
            } finally {
                console.log = original;
            }
            assert.strictEqual(res.status, 404);
            assert.ok(logged.length > 0, 'expected the request to be logged');
        });

        it('accepts a request with no body and no content-type', async function () {
            // Express 5 leaves req.body undefined here; the handler must not throw.
            const res = await request(app(), 'get', '/pets/2');
            assert.strictEqual(res.status, 200);
            assert.deepStrictEqual(res.body, { id: 2, name: 'Marchio' });
        });
    });

    describe('listen', function () {

        it('binds a port and serves mocks', async function () {
            const server = mockPort.listen({
                app: 'mockport-server',
                version: 'test',
                service: 'myapi',
                port: 0,          // let the OS pick a free port
                mocks: mocks,
                log: quiet
            });

            await new Promise(resolve => server.on('listening', resolve));
            try {
                const res = await request(server, 'get', '/pets/1');
                assert.strictEqual(res.status, 200);
            } finally {
                server.closeAllConnections();
                await new Promise(resolve => server.close(resolve));
            }
        });

        it('falls back to defaults when called with no spec', async function () {
            // No spec: an OS-assigned port (listen(undefined)), the default
            // app name, and console.log for the startup banner.
            const logged = [];
            const original = console.log;
            console.log = (...args) => { logged.push(args.join(' ')); };
            const server = mockPort.listen();

            await new Promise(resolve => server.on('listening', resolve));
            console.log = original;
            await new Promise(resolve => server.close(resolve));
            assert.ok(
                logged.some(line => line.includes(':mockport:')),
                `expected the default app name in the banner, got: ${logged}`
            );
        });
    });
});
