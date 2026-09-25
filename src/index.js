
const mockPort = require('./mockport'),
    fs = require("fs")

const APP_NAME = 'mockport-server';
const APP_VERSION = require("./../package").version;
const PORT = process.env.PORT || 1234;

const MOCKFILE = process.env.MOCKFILE || './data/mock.json';

var contents = fs.readFileSync(`${MOCKFILE}`);
var mockData = JSON.parse(contents);

const options = {
    app: APP_NAME,
    version: APP_VERSION,
    service: "myapi",
    port: PORT,
    headers: true,
    mocks: mockData
}

const server = mockPort.listen(options);

// Graceful shutdown: stop accepting connections and exit once in-flight
// requests have drained. Without this, SIGTERM (docker stop) kills node
// outright, which also discards the V8 coverage c8 collects from the
// entrypoint tests' child processes.
function shutdown(signal) {
    console.log(`\n${signal} signal received: closing HTTP server`);
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
}

['SIGINT', 'SIGTERM'].forEach(signal => process.on(signal, () => shutdown(signal)));
