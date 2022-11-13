const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function delete_guild(guild_id) {
    const client = await pool.connect();
    const query = 'DELETE FROM discord where guild_id = $1';
    try {
        await client.query(query, [guild_id]);
        return true;
    }
    catch (error) {
        console.log(error);
        return false;
    }
    finally {
        client.release();
    }
}

async function create_replika(user_id, guild_id) {
    const client = await pool.connect();
    const query = `
        INSERT INTO discord (
            user_id,
            guild_id
        )
        VALUES($1, $2)
    `;
    try {
        await client.query(query, [user_id, guild_id]);
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

/**
 * 
 * @param {*} user_id 
 * @param {*} guild_id 
 * @returns {number}
 *      - 0: Replika is not registered anywhere.
 *      - 1: Replika registered in same server.
 *      - 2: Replika registered in another server.
 *      - 3: Database error.
 */
 async function is_registered(user_id, guild_id) {
    const client = await pool.connect();
    let res;
    try {
        res = await client.query(
            `
                SELECT * FROM discord WHERE user_id = $1;
            `, 
            [ user_id, guild_id ]
        );
    }
    catch (error) {
        console.log(error);
        return 3;
    }
    finally {
        client.release();
    }

    if (res.rows.length == 0) {
        return 0;
    }
    else if (res.rows[0]['guild_id'] == guild_id) {
        return 1;
    }
    else {
        return 2;
    }
}

module.exports = {
    delete_guild: delete_guild,
    create_replika: create_replika,
    is_registered: is_registered
}