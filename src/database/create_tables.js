/* eslint-disable no-unused-vars */
require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

client.connect();

client
    .query('DROP TABLE IF EXISTS settings, discord')
    .then( res => {
        console.log("Dropped existing table. Creating new table...");
        client
            .query(`
                CREATE TABLE IF NOT EXISTS settings (
                    user_id        CHAR(24) NOT NULL  PRIMARY KEY,
                    auth_token     UUID     NOT NULL,
                    device_id      UUID     NOT NULL,
                    timestamp_hash UUID     NOT NULL,

                    bot_id         CHAR(24) NOT NULL,
                    chat_id        CHAR(24) NOT NULL,

                    name           VARCHAR(64),
                    avatar         TEXT
                );

                CREATE TABLE IF NOT EXISTS discord (
                    user_id        CHAR(24) PRIMARY KEY,
                    guild_id       BIGINT   NOT NULL,

                    CONSTRAINT fk_user_id
                        FOREIGN KEY(user_id)
                            REFERENCES settings(user_id)
                            ON DELETE CASCADE
                );
            `)
            .then(res => {
                console.log("Created new tables.");
                client.end();
            })
            .catch(e => console.log(e))
    })
    .catch(e => console.log(e))
// process.exit();