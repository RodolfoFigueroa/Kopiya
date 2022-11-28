const axios = require("axios");
const router = require("express").Router();
const { requiresAuth } = require("express-openid-connect");
const pool = require("../../src/database/pool.js");
const red_client = require("../../src/redis/client.js");
const crypto = require("crypto");
const { check_replika_user } = require("../middlewares/auth.js");
const config = require('../../src/config.js');

// Utils
const headers = { Authorization: `Bot ${process.env.DISCORD_TOKEN}` };

async function get_discord_guild_name(guild_id) {
    let guild_name;
    try {
        const guild_info = await axios.get(
            `https://discord.com/api/guilds/${guild_id}/preview`,
            { headers: headers }
        );
        guild_name = guild_info.data.name;
    } catch (err) {
        guild_name = guild_id;
    }
    return guild_name;
}

async function get_discord_username(discord_user_id) {
    let user_name;
    try {
        const user_info = await axios.get(
            `https://discord.com/api/users/${discord_user_id}`,
            { headers: headers }
        );
        user_name = `${user_info.data.username}#${user_info.data.discriminator}`;
    } catch (err) {
        user_name = discord_user_id;
    }
    return user_name;
}

async function get_discord_data(user_id) {
    let client;
    try {
        client = await pool.connect();
    } catch (err) {
        return;
    }

    let result;
    try {
        result = await client.query(
            "SELECT discord_user_id FROM discord WHERE user_id = $1",
            [user_id]
        );
    } catch (err) {
        return;
    } finally {
        await client.release();
    }

    if (result.rows.length == 0) {
        return;
    }

    const row = result.rows[0];
    const username = await get_discord_username(row.discord_user_id);
    return {
        User: username,
    };
}

// Base

router.get("/:user_id", requiresAuth(), check_replika_user, async (req, res, next) => {
    const user_id = req.params.user_id;

    if (!user_id) {
        res.status(400).send('No user ID provided.');
        return;
    }

    const tokens = [];

    if (config.sources.has("discord")) {
        const discord_result = await get_discord_data(user_id);
        if (discord_result) {
            tokens.push({
                type: "Discord",
                data: discord_result,
            });
        }
    }

    let token;
    try {
        token = await red_client.get(`user_token:${user_id}`);
    } catch (err) {
        return next(err);
    }

    res.render("tokens", {
        user_id: user_id,
        tokens: tokens,
        temp_token: token,
    });
});

// Add

router.post(
    "/add",
    requiresAuth(),
    check_replika_user,
    async (req, res, next) => {
        let existing_token;
        try {
            existing_token = await red_client.get(`user_token:${req.body.user_id}`);
        } catch (err) {
            return next(err);
        }

        let token;
        if (existing_token) {
            token = existing_token
        } else {
            token = crypto.randomBytes(8).toString("hex");
        }

        try {
            const [set1, set2] = await red_client
                .multi()
                .set(`token:${token}`, req.body.user_id, {EX: 600,})
                .set(`user_token:${req.body.user_id}`, token, {EX:600})
                .exec();
        } catch (err) {
            return next(err);
        }
        res.redirect("back");
    }
);

// Delete

router.post(
    "/delete",
    requiresAuth(),
    check_replika_user,
    async (req, res, next) => {
        let client;
        try {
            client = await pool.connect();
        } catch (err) {
            return next(err);
        }

        if (req.body.token_type == "Discord") {
            try {
                await client.query("DELETE FROM discord WHERE user_id = $1", [
                    req.body.user_id,
                ]);
            } catch (err) {
                return next(err);
            } finally {
                await client.release();
            }
        }
        res.redirect("back");
    }
);

module.exports = router;
