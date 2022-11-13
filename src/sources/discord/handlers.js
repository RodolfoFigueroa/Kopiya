require('dotenv').config();
const { Pool } = require('pg');

const registering = new Set();
const active = new Set();
const channels = {};
const guilds = {};

module.exports = {
    registering: registering,
    active: active,
    channels: channels,
    guilds: guilds,
};


