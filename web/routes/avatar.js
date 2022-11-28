const router = require("express").Router();
const probe = require("probe-image-size");
const { requiresAuth } = require("express-openid-connect");
const { check_replika_user } = require("../middlewares/auth.js");
const pool = require("../../src/database/pool.js");
const replika = require("../../src/replika.js");

// Update

router.post(
    "/update",
    requiresAuth(),
    check_replika_user,
    async (req, res, next) => {
        try {
            await probe(req.body.avatar_url);
        } catch (err) {
            return next(err);
        }

        let client;
        try {
            client = await pool.connect();
        } catch (err) {
            return next(err);
        }

        try {
            await client.query(
                "UPDATE settings SET avatar = $1 WHERE user_id = $2 AND auth0_sub = $3",
                [req.body.avatar_url, req.body.user_id, req.oidc.user.sub]
            );
        } catch (err) {
            return next(err);
        } finally {
            await client.release();
        }

        res.redirect("/replikas");
    }
);

// Delete

router.post(
    "/delete",
    requiresAuth(),
    check_replika_user,
    async (req, res, next) => {
        let auth;

        let client;
        try {
            client = await pool.connect();
        } catch (err) {
            return next(err);
        }

        try {
            auth = await client.query(
                "SELECT device_id, timestamp_hash, user_id, auth_token FROM settings WHERE user_id = $1",
                [req.body.user_id]
            );
        } catch (err) {
            return next(err);
        } finally {
            await client.release();
        }
        auth = replika.reshape_auth(auth.rows[0]);

        let profile;
        try {
            profile = await replika.get_data(auth, "profile");
        } catch (err) {
            return next(err);
        }

        try {
            client = await pool.connect();
        } catch (err) {
            return next(err);
        }

        try {
            await client.query(
                "UPDATE settings SET avatar = $1 WHERE user_id = $2 AND auth0_sub = $3",
                [profile.avatar_v2.preview, req.body.user_id, req.oidc.user.sub]
            );
        } catch (err) {
            return next(err);
        } finally {
            await client.release();
        }

        res.redirect("/replikas");
    }
);

module.exports = router;
