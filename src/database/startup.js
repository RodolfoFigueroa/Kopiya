const pool = require("./pool.js");

async function main() {
    let client;
    try {
        client = await pool.connect();
    } catch (err) {
        console.log(err);
        return;
    }

    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS settings (
                user_id        CHAR(24)     PRIMARY KEY,
                auth_token     UUID         NOT NULL,
                device_id      UUID         NOT NULL,
                timestamp_hash UUID         NOT NULL,

                bot_id         CHAR(24)     NOT NULL,
                chat_id        CHAR(24)     NOT NULL,

                name           VARCHAR(64),
                avatar         TEXT,

                auth0_sub      CHAR(30)     NOT NULL
            );
        `);
    } catch (err) {
        console.log(err);
        return;
    } finally {
        await client.release();
    }
    console.log("Created base table.");
}

module.exports = main;
