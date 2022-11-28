const path = require("path");
const create_base = require("../src/database/startup.js");
const create_discord = require("../src/sources/discord/database/startup.js");

create_base()
    .then(() => {
        create_discord().catch((err) => {
            console.log(err);
            return;
        });
    })
    .catch((err) => {
        console.log(err);
        return;
    });
