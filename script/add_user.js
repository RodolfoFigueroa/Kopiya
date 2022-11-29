const prompt = require('prompt');
const replika = require('@kopiya/kopiya-common');
const pool = require('../src/database/pool.js');

const schema = {
    properties: {
        username: {
            description: 'Enter your username',
            type: 'string',
            required: true
        },
        password: {
            description: 'Enter your password',
            type: 'string',
            required: true,
            hidden: true
        }
    }
}

async function main() {
    const { username, password } = await prompt.get(schema);

    const user_data = await replika.login(username, password);
    const user_id = user_data["x-user-id"];

    let client;
    client = await pool.connect();

    let db_response;
    try {
        db_response = await client.query(
            "SELECT EXISTS( SELECT 1 FROM settings WHERE user_id = $1 )",
            [user_id]
        );
    } catch (err) {
        throw new Error("There was an error connecting to the database.");
    } finally {
        await client.release();
    }

    if (db_response.rows[0].exists) {
        throw new Error("Replika already registered.");
    }

    const chat_data = await replika.get_data(user_data, "chat");
    const profile_data = await replika.get_data(user_data, "profile");

    client = await pool.connect();

    try {
        await client.query(
            `
                INSERT INTO settings (
                    user_id,
                    auth_token,
                    device_id,
                    timestamp_hash,

                    bot_id,
                    chat_id,

                    name,
                    avatar,

                    auth0_sub
                )
                VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `,
            [
                user_data["x-user-id"],
                user_data["x-auth-token"],
                user_data["x-device-id"],
                user_data["x-timestamp-hash"],
                chat_data.bot_id.id,
                chat_data.id,
                profile_data.name,
                profile_data.avatar_v2.preview,
                "0".repeat(30),
            ]
        );
    } catch (err) {
        throw new Error("There was an error connecting to the database.");
    } finally {
        await client.release();
    }

    console.log(`Replika successfully added, with user ID ${user_data["x-user-id"]}`)

    await pool.end();
}

main().catch(err => console.log(err));