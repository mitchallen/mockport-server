"use strict";

// Every mockfile shipped in the repo is exercised here, so an alternate
// mockfile (data/animal.json, used by `npm run start:animal`) cannot drift
// out of sync with the server without a test failing.

const assert = require('assert'),
    request = require('supertest'),
    fs = require('fs'),
    path = require('path');

const mockPort = require('../../src/mockport');

const root = path.join(__dirname, '../..');

const mockfiles = [
    'data/mock.json',
    'data/animal.json',
    'test/data/mock.json'
];

// Mirrors the per-method defaults in src/mockport.js.
const defaultStatus = {
    HEAD: 200,
    GET: 200,
    POST: 201,
    PUT: 204,
    PATCH: 204,
    DELETE: 204
};

const quiet = () => { };

function load(file) {
    return JSON.parse(fs.readFileSync(path.join(root, file)));
}

function appFor(mocks) {
    return mockPort.createApp({
        service: 'myapi',
        port: 1234,
        mocks: mocks,
        log: quiet
    });
}

describe('shipped mockfiles', function () {

    it('covers every mockfile referenced by an npm script', function () {
        const pkg = require(path.join(root, 'package.json'));
        const referenced = Object.values(pkg.scripts)
            .map(s => (s.match(/MOCKFILE=\.\/(\S+)/) || [])[1])
            .filter(Boolean);

        referenced.forEach(file => {
            assert.ok(
                mockfiles.includes(file),
                `${file} is used by an npm script but is not covered by this test`
            );
        });
    });

    mockfiles.forEach(function (file) {

        describe(file, function () {

            let mocks;

            before(function () {
                mocks = load(file);
            });

            it('is valid JSON describing an array of mocks', function () {
                assert.ok(Array.isArray(mocks), 'expected an array');
                assert.ok(mocks.length > 0, 'expected at least one mock');
            });

            it('declares a method and url for every entry', function () {
                mocks.forEach((mock, i) => {
                    assert.ok(mock.request, `entry ${i} has no request`);
                    assert.ok(
                        defaultStatus[mock.request.method],
                        `entry ${i} has unsupported method ${mock.request.method}`
                    );
                    assert.strictEqual(
                        typeof mock.request.url, 'string',
                        `entry ${i} has no url`
                    );
                    assert.ok(
                        mock.request.url.startsWith('/'),
                        `entry ${i} url must start with /`
                    );
                });
            });

            it('has no duplicate method+url pairs', function () {
                const seen = new Set();
                mocks.forEach(mock => {
                    const key = `${mock.request.method}|${mock.request.url}`;
                    assert.ok(!seen.has(key), `duplicate mock: ${key}`);
                    seen.add(key);
                });
            });

            it('serves every declared mock', function () {
                const app = appFor(mocks);

                return mocks.reduce(function (chain, mock) {
                    return chain.then(function () {
                        const method = mock.request.method.toLowerCase();
                        const response = mock.response;
                        const expected = (response && response.status)
                            || defaultStatus[mock.request.method];

                        let req = request(app)[method](mock.request.url);
                        if (method === 'post' || method === 'put' || method === 'patch') {
                            req = req.send({});
                        }

                        return req.expect(expected).then(function (res) {
                            // A 204 never carries a body, even when one is declared.
                            if (expected === 204) {
                                assert.strictEqual(res.text, '');
                            } else if (response && response.body) {
                                assert.deepStrictEqual(res.body, response.body);
                            }
                        });
                    });
                }, Promise.resolve());
            });

            it('registers a HEAD route for every mock', function () {
                const app = appFor(mocks);

                return mocks.reduce(function (chain, mock) {
                    return chain.then(function () {
                        return request(app).head(mock.request.url).then(function (res) {
                            assert.notStrictEqual(
                                res.status, 404,
                                `no HEAD route for ${mock.request.url}`
                            );
                        });
                    });
                }, Promise.resolve());
            });

            it('404s a path that is not declared', function () {
                return request(appFor(mocks))
                    .get('/definitely-not-mocked')
                    .expect(404);
            });
        });
    });
});
