
const mockPort = require('./mockport'),
    fs = require("fs")

const APP_NAME = 'mockport-server';
const APP_VERSION = '0.0.1';
const PORT = process.env.PORT || 3002;

const MOCKFILE = process.env.MOCKFILE || './data/mock.json';

var contents = fs.readFileSync(`${MOCKFILE}`);
// Define to JSON type
 var mockData = JSON.parse(contents);

const options = {
    app: APP_NAME,
    version: APP_VERSION,
    service: "myapi",
    port: PORT,
    mocks: mockData
}

mockPort.listen(options);

