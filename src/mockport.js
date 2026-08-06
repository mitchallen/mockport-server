"use strict";

const express = require('express'),
    cors = require('cors'),
    os = require('os');

const HOST = os.hostname();

const httpMethod = {
    "HEAD": { curl: `-I`, status: 200 },    // TODO - status based on method?
    "GET": { curl: `-i -X GET -H "Accept: applications/json"`, status: 200 },
    "POST": { curl: `-i -X POST -H "Content-Type: application/json" -d '{}'`, status: 201 },
    "PUT": { curl: `-i -X PUT -H "Accept: applications/json" -d '{}'`, status: 204 },
    "PATCH": { curl: `-i -X PATCH -H "Content-Type: application/json" -d '{}'`, status: 204 },
    "DELETE": { curl: `-i -X DELETE -H "Content-Type: application/json"`, status: 204 }
}

// Builds the mock lookup table, keyed by "METHOD|url".
function buildMocks(spec, log) {
    const mocks = {};
    const port = spec.port;

    function logMock(method, mock) {
        log(
            `[${method}]: curl ${httpMethod[method].curl}`
            + ` "http://localhost:${port}${mock.request.url}"`
        );
    }

    if (spec.mocks) {
        spec.mocks.forEach(mock => {
            // TODO - validate parameters exist
            var methods = [];
            if (mock.request.method != "HEAD") {
                // So curl -I will return proper status code
                methods.push("HEAD");
            }
            methods.push(mock.request.method);
            methods.forEach(method => {
                const key = `${method}|${mock.request.url}`;
                logMock(method, mock);
                if (mock.response) {
                    mocks[key] = {
                        status: mock.response.status,
                        body: mock.response.body
                    };
                } else {
                    mocks[key] = {};    // or null ?
                }
            });
        });
    }

    return mocks;
}

// Creates the configured express app without binding a port.
// Exported separately so tests can drive it via supertest.
module.exports.createApp = (spec) => {

    spec = spec || {};
    const service = spec.service; // TODO what if param missing
    const showHeaders = spec.headers || false;
    const notFoundStatus = spec.notFoundStatus || 404;
    const log = spec.log || console.log;

    const mocks = buildMocks(spec, log);

    const app = express();

    app.use(cors());

    app.use(express.json());

    // Express 5 (path-to-regexp 8) no longer accepts a bare '*' wildcard;
    // named wildcards are required.
    app.all('/*splat', (req, res) => {
        const request = {};
        request.service = service;
        request.method = req.method;
        if (showHeaders) {
            request.headers = JSON.stringify(req.headers)
        }
        request.host = req.headers["host"];
        request.url = req.url;
        request.path = req.path;
        if (req.query && Object.keys(req.query).length) {
            request.query = JSON.stringify(req.query);
        }
        // Express 5 leaves req.body undefined when no body parser matched.
        if (req.body && Object.keys(req.body).length) {
            request.body = JSON.stringify(req.body);
        }
        log('--');
        log(request);
        // Generate Mock Response - if available
        const key = `${req.method}|${req.url}`;
        var reply = mocks[key];
        if (reply) {
            const fallback = httpMethod[req.method]
                ? httpMethod[req.method].status
                : 200;
            const status = reply.status ? reply.status : fallback;
            log(status);
            if (status == 204) {
                // Not returning data
                res.status(status).send();
            } else {
                if (reply.body) {
                    log(reply.body);
                    res
                        .status(status)
                        .json(reply.body);
                } else {
                    res.status(status).send();
                }
            }
        } else {
            log(notFoundStatus);
            res
                .status(notFoundStatus)
                .json()
        }
    });

    return app;
}

module.exports.listen = (spec) => {

    spec = spec || {};
    const appName = spec.app || 'mockport';
    const version = spec.version;
    const service = spec.service;
    const port = spec.port;   // TODO what if param missing
    const log = spec.log || console.log;

    const app = module.exports.createApp(spec);

    return app.listen(port, () => {
        log(`[HOST:${HOST}]:${appName}:${version} - [${service}] listening on port ${port}!`)
    });
}
