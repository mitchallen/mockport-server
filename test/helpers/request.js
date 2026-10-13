"use strict";

// A minimal stand-in for supertest built on Node's own http server and fetch,
// so the test suite carries no HTTP-client dependency (supertest pulled in
// superagent, form-data and qs, which kept raising Dependabot alerts).
//
// request(target, method, url, body) resolves to
//   { status, headers, text, body }
// where body is the parsed JSON for a JSON response and {} otherwise, matching
// what the tests previously read from supertest's res.body.
//
// target is either an Express app (started on an OS-assigned port for the one
// request, then closed) or an http.Server that is already listening.

function serve(target) {
    if (typeof target.address === 'function') {
        return Promise.resolve({ server: target, close: () => Promise.resolve() });
    }
    return new Promise((resolve, reject) => {
        const server = target.listen(0, '127.0.0.1', err => {
            if (err) return reject(err);
            resolve({
                server,
                close: () => new Promise(done => {
                    server.closeAllConnections();
                    server.close(() => done());
                })
            });
        });
    });
}

function request(target, method, url, body) {
    return serve(target).then(({ server, close }) => {
        const init = { method: method.toUpperCase() };
        if (body !== undefined) {
            init.headers = { 'Content-Type': 'application/json' };
            init.body = JSON.stringify(body);
        }
        const port = server.address().port;
        return fetch(`http://127.0.0.1:${port}${url}`, init)
            .then(res => res.text().then(text => {
                const type = res.headers.get('content-type') || '';
                return {
                    status: res.status,
                    headers: res.headers,
                    text,
                    body: text && /json/.test(type) ? JSON.parse(text) : {}
                };
            }))
            .finally(close);
    });
}

module.exports = request;
