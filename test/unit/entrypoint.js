"use strict";

// Exercises src/index.js as a real process, which is the only place the
// MOCKFILE and PORT environment variables are read. `npm run start:animal`
// depends on this path.

const assert = require('assert'),
    http = require('http'),
    net = require('net'),
    path = require('path'),
    { spawn } = require('child_process');

const root = path.join(__dirname, '../..');

function freePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.on('error', reject);
        srv.listen(0, '127.0.0.1', () => {
            const port = srv.address().port;
            srv.close(() => resolve(port));
        });
    });
}

function get(port, urlPath) {
    return new Promise((resolve, reject) => {
        const req = http.get(
            { host: '127.0.0.1', port: port, path: urlPath },
            res => {
                let body = '';
                res.on('data', chunk => { body += chunk; });
                res.on('end', () => resolve({ status: res.statusCode, body: body }));
            }
        );
        req.on('error', reject);
    });
}

// Poll until the child process is accepting connections.
function waitForServer(port, child, attempts) {
    attempts = attempts === undefined ? 100 : attempts;
    return get(port, '/').catch(err => {
        if (child.exitCode !== null) {
            throw new Error(`server exited early with code ${child.exitCode}`);
        }
        if (attempts <= 0) {
            throw err;
        }
        return new Promise(r => setTimeout(r, 100))
            .then(() => waitForServer(port, child, attempts - 1));
    });
}

function start(env) {
    return freePort().then(port => {
        const child = spawn(
            process.execPath,
            [path.join(root, 'src/index.js')],
            {
                cwd: root,
                env: Object.assign({}, process.env, env, { PORT: String(port) }),
                stdio: ['ignore', 'pipe', 'pipe']
            }
        );

        let stderr = '';
        child.stderr.on('data', d => { stderr += d; });
        child.stdout.resume();

        return waitForServer(port, child)
            .then(() => ({ port, child, stderr: () => stderr }))
            .catch(err => {
                child.kill();
                throw new Error(`${err.message}\nstderr: ${stderr}`);
            });
    });
}

function stop(server) {
    if (!server || !server.child) return Promise.resolve();
    return new Promise(resolve => {
        server.child.on('exit', () => resolve());
        server.child.kill();
    });
}

describe('src/index.js', function () {

    this.timeout(20000);

    describe('default mockfile', function () {

        let server;

        before(function () {
            return start({}).then(s => { server = s; });
        });

        after(function () {
            return stop(server);
        });

        it('serves data/mock.json', function () {
            return get(server.port, '/pets/1').then(res => {
                assert.strictEqual(res.status, 200);
                assert.deepStrictEqual(JSON.parse(res.body), { id: 1, name: 'Pepper' });
            });
        });
    });

    describe('MOCKFILE=./data/animal.json', function () {

        let server;

        before(function () {
            return start({ MOCKFILE: './data/animal.json' }).then(s => { server = s; });
        });

        after(function () {
            return stop(server);
        });

        it('serves the animal mocks', function () {
            return get(server.port, '/animals/1').then(res => {
                assert.strictEqual(res.status, 200);
                assert.deepStrictEqual(JSON.parse(res.body), { id: 1, name: 'Pepper' });
            });
        });

        it('does not serve the default mocks', function () {
            return get(server.port, '/pets/1').then(res => {
                assert.strictEqual(res.status, 404);
            });
        });
    });

    describe('a missing mockfile', function () {

        it('exits rather than starting with no mocks', function () {
            return freePort().then(port => new Promise((resolve, reject) => {
                const child = spawn(
                    process.execPath,
                    [path.join(root, 'src/index.js')],
                    {
                        cwd: root,
                        env: Object.assign({}, process.env, {
                            MOCKFILE: './data/does-not-exist.json',
                            PORT: String(port)
                        }),
                        stdio: ['ignore', 'ignore', 'pipe']
                    }
                );

                let stderr = '';
                child.stderr.on('data', d => { stderr += d; });
                child.on('error', reject);
                child.on('exit', code => {
                    assert.notStrictEqual(code, 0, 'expected a non-zero exit');
                    assert.ok(
                        /ENOENT/.test(stderr),
                        `expected ENOENT in stderr, got: ${stderr}`
                    );
                    resolve();
                });
            }));
        });
    });
});
