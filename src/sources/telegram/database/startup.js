const pool = require("../../../database/pool.js");

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
            CREATE TABLE IF NOT EXISTS telegram (
                user_id          CHAR(24)   PRIMARY KEY,
                telegram_user_id BIGINT     NOT NULL,
            
                CONSTRAINT fk_user_id
                    FOREIGN KEY(user_id)
                        REFERENCES settings(user_id)
                        ON DELETE CASCADE
            );
        `);
    } catch (err) {
        console.log(err);
        return;
    } finally {
        await client.release();
    }
}

module.exports = main;
