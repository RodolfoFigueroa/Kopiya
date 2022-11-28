const toml = require('toml');
const fs = require('fs');

const config = toml.parse(fs.readFileSync(__dirname + '/../config.toml', 'utf-8'));
config.sources = new Set(config.sources);

module.exports = config;