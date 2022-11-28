const router = require("express").Router();
const { requiresAuth } = require("express-openid-connect");
const { check_replika_user } = require("../middlewares/auth.js");
const pool = require("../../src/database/pool.js");
const replika = require("../../src/replika.js");
const red_client = require("../../src/redis/client.js");

// Utils

const type_map = {
    base: "Unknown",
    discord: "Discord",
    discord_dual: "Discord (dialogue)"
}

// Base

router.get("/", requiresAuth(), async (req, res, next) => {
    const client = await pool.connect();
    let result;
    try {
        result = await client.query(
            "SELECT name, avatar, user_id FROM settings WHERE auth0_sub = $1 ORDER BY name",
            [req.oidc.user.sub]
        );
    } catch (err) {
        return next(err);
    } finally {
        await client.release();
    }

    const replikas = result.rows;
    for (let i=0; i < replikas.length; i++) {
        const active_raw = await red_client.hGet(`user:${replikas[i].user_id}`, "type");
        let type;
        if (active_raw) {
            replikas[i].type = type_map[active_raw];
        } else {
            replikas[i].type = "Inactive"
        }
    }

    res.render("replikas", {
        replikas: replikas,
    });
});

// Add

router.get("/add", requiresAuth(), (req, res, next) => {
    res.render("add");
});

router.post("/add", requiresAuth(), async (req, res, next) => {
    let user_data;
    try {
        user_data = await replika.login(req.body.rep_email, req.body.rep_pwd);
    } catch (err) {
        return next(err);
    }
    const user_id = user_data["x-user-id"];

    let client;
    try {
        client = await pool.connect();
    } catch (err) {
        return next(err);
    }

    let db_response;
    try {
        db_response = await client.query(
            "SELECT EXISTS( SELECT 1 FROM settings WHERE user_id = $1 )",
            [user_id]
        );
    } catch (err) {
        return next(err);
    } finally {
        await client.release();
    }

    if (db_response.rows[0].exists) {
        res.status(409).send("Replika already registered.");
        return;
    }

    let chat_data;
    try {
        chat_data = await replika.get_data(user_data, "chat");
    } catch (err) {
        return next(err);
    }

    let profile_data;
    try {
        profile_data = await replika.get_data(user_data, "profile");
    } catch (err) {
        return next(err);
    }

    try {
        client = await pool.connect();
    } catch (err) {
        console.log(err);
    }

    try {
        client.query(
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
                req.oidc.user.sub,
            ]
        );
    } catch (err) {
        return next(err);
    } finally {
        await client.release();
    }

    res.redirect("back");
});

// Delete

router.post(
    "/delete",
    requiresAuth(),
    check_replika_user,
    async (req, res, next) => {
        const user_id = req.body.user_id;
        let client;
        try {
            client = await pool.connect();
        } catch (err) {
            return next(err);
        }

        try {
            await client.query(
                "DELETE FROM settings WHERE user_id = $1 AND auth0_sub = $2",
                [user_id, req.oidc.user.sub]
            );
        } catch (err) {
            return next(err);
        } finally {
            await client.release();
        }

        try {
            await red_client.del(`user:${user_id}`);
        } catch (err) {
            return next(err);
        }

        res.redirect("back");
    }
);

// Deactivate

router.post("/deactivate", requiresAuth(), check_replika_user, async (req, res, next) => {
    try {
        await red_client.del(`user:${req.body.user_id}`);
    }
    catch (err) {
        return next(err);
    }
    
    res.redirect("/replikas");
})

module.exports = router;
