const path = require("path");
const create_base = require("../src/database/startup.js");
const config = require('../src/config.js');

async function main() {
    try {
        await create_base();
    } catch (err) {
        console.log(err);
        return;
    }

    for (let source of config.sources) {
        const create_func = require(`../src/sources/${source}/database/startup.js`);
        try {
            await create_func();
        } catch (err) {
            console.log(err);
            return;
        }
    }
}

main().catch(err => console.log(err));