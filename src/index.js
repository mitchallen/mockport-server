
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

mockPort.listen(options);
