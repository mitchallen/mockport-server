"use strict";

const express = require('express'),
    os = require('os');

const HOST = os.hostname();

const mocks = {}

const httpMethod = {
    "HEAD": { curl: `-I`, status: 200 },    // TODO - status based on method?
    "GET": { curl: `-i -X GET -H "Accept: applications/json"`, status: 200 },
    "POST": { curl: `-i -X POST -H "Content-Type: application/json" -d '{}'`, status: 201 },
    "PUT": { curl: `-i -X PUT -H "Accept: applications/json" -d '{}'`, status: 204 },
    "PATCH": { curl: `-i -X PATCH -H "Content-Type: application/json" -d '{}'`, status: 204 },
    "DELETE": { curl: `-i -X DELETE -H "Content-Type: application/json"`, status: 204 }
}

module.exports.listen = (spec) => {

    spec = spec || {};
    const appName = spec.app || 'mockport';
    const version = spec.version;
    const service = spec.service; // TODO what if param missing
    const port = spec.port;   // TODO what if param missing
    const showHeaders = spec.headers || false;
    const notFoundStatus = spec.notFoundStatus || 404;

    function logMock(method, mock) {
        console.log(
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
                if( mock.response ) {
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

    const app = express();

    app.use(express.json());

    app.all('*', (req, res) => {
        const request = {};
        request.service = service;
        request.method = req.method;
        if (showHeaders) {
            request.headers = JSON.stringify(req.headers)
        }
        request.host = req.headers["host"];
        request.url = req.url;
        request.path = req.path;
        if (Object.keys(req.query).length) {
            request.query = JSON.stringify(req.query);
        }
        if (Object.keys(req.body).length) {
            request.body = JSON.stringify(req.body);
        }
        console.log('--');
        console.log(request);
        // Generate Mock Response - if available
        const key = `${req.method}|${req.url}`;
        var reply = mocks[key];
        if (reply) {
            const status = reply.status ? reply.status : httpMethod[req.method].status;
            console.log(status);
            if (status == 204) {
                // Not returning data
                res.status(status).send();
            } else {
                if (reply.body) {
                    console.log(reply.body);
                    res
                        .status(status)
                        .json(reply.body);
                } else {
                    res.status(status).send();
                }
            }
        } else {
            console.log(notFoundStatus);
            res
                .status(notFoundStatus)
                .json()
        }
    });

    app.listen(port, () => {
        console.log(`[HOST:${HOST}]:${appName}:${version} - [${service}] listening on port ${port}!`)
    });



}
