const red = require("../redis/commands.js");
const pool = require("./pool.js");

async function insert_replika(params) {
    const client = await pool.connect();
    const query = `
        INSERT INTO settings (
            user_id,
            auth_token,
            device_id,
            timestamp_hash,

            bot_id, 
            chat_id, 

            name,
            avatar
        )
        VALUES($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    try {
        await client.query(query, [
            params["x-user-id"],
            params["x-auth-token"],
            params["x-device-id"],
            params["x-timestamp-hash"],
            params["bot_id"],
            params["chat_id"],
            params["name"],
            params["avatar"],
        ]);
        return 0;
    } catch (error) {
        console.log(error);
        return 1;
    } finally {
        await client.release();
    }
}

async function delete_replika(user_id) {
    const client = await pool.connect();
    const query = "DELETE FROM settings WHERE user_id = $1";
    try {
        await client.query(query, [user_id]);
        return 0;
    } catch (error) {
        console.log(error);
        return 1;
    } finally {
        await client.release();
    }
}

async function get_replika(user_id) {
    const client = await pool.connect();
    const query = "SELECT * FROM settings WHERE user_id = $1";
    try {
        res = await client.query(query, [user_id]);
        return [0, res.rows[0]];
    } catch (error) {
        console.log(error);
        return [1, null];
    } finally {
        await client.release();
    }
}

async function update_name(user_id, name) {
    const client = await pool.connect();
    try {
        await client.query("UPDATE settings SET name = $1 WHERE user_id = $2", [
            name,
            user_id,
        ]);
    } catch (error) {
        console.log(error);
    } finally {
        await client.release();
    }
}

module.exports = {
    insert_replika: insert_replika,
    delete_replika: delete_replika,
    get_replika: get_replika,
    update_name: update_name,
};
