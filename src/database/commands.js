require('dotenv').config();
const { Pool } = require('pg');
const red = require('../redis.js');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

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
        VALUES($1, $2, $3, $4, $5, $6, $7, $8)`;
    try {
        await client.query(
            query,
            [
                params['x-user-id'], params['x-auth-token'], params['x-device-id'], params['x-timestamp-hash'],
                params['bot_id'], params['chat_id'],
                params['name'], params['avatar']
            ],
        );
        return 0;
    }
    catch (error) {
        console.log(error);
        return 1;
    }
    finally {
        client.release();
    }
}

async function delete_replika(user_id) {
    const client = await pool.connect();
    const query = 'DELETE FROM settings WHERE user_id = $1';
    try {
        await client.query(query, [user_id]);
        return 0;
    }
    catch (error) {
        console.log(error);
        return 1;
    }
    finally {
        client.release();
    }
}

async function get_replika(user_id) {
    const client = await pool.connect();
    const query = 'SELECT * FROM settings WHERE user_id = $1';
    try {
        res = await client.query(query, [user_id]);
        return [ 0, res.rows[0] ];
    }
    catch (error) {
        console.log(error);
        return [ 1, null ];
    }
    finally {
        client.release();
    }
}

async function list_replikas(guild_id) {
    const client = await pool.connect();
    try {
        return await client.query(
            `
                SELECT * FROM discord 
                INNER JOIN settings
                    ON settings.user_id = discord.user_id
                WHERE guild_id = $1;
            `, 
            [ guild_id ]
        );
    }
    catch (error) {
        console.log(error);
        return;
    }
    finally {
        client.release();
    }
}

async function update_data(user_id) {
    const client = await pool.connect();
    const res = await red.get_fields(user_id, ['name', 'avatar']);
    try {
        return await client.query(
            'UPDATE settings SET name = $1, avatar = $2 WHERE user_id = $3',
            [res[0], res[1], user_id]);
    }
    catch (error) {
        console.log(error);
        return;
    }
    finally {
        client.release();
    }
}


module.exports = {
    insert_replika: insert_replika,
    delete_replika: delete_replika,
    get_replika: get_replika,
    list_replikas: list_replikas,
    update_data: update_data,
};