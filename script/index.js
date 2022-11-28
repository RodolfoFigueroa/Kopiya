const path = require("path");
const config = require('../src/config.js');

for (let source of config.sources) {
    require(path.join(__dirname, "../src/sources/", source, "/main.js"));
}
