const router = require("express").Router();
const pool = require("../../src/database/pool.js");
const { requiresAuth } = require("express-openid-connect");
const { check_replika_user } = require('../middlewares/auth.js');

router.get("/:user_id", requiresAuth(), check_replika_user, async (req, res, next) => {
    const user_id = req.params.user_id;

    if (!user_id) {
        res.status(400).send('No user ID provided.');
        return;
    }

    let client;
    try {
        client = await pool.connect();
    } catch (err) {
        return next(err);
    }

    let settings;
    try {
        settings = await client.query(
            "SELECT name, user_id, avatar from settings WHERE user_id = $1 AND auth0_sub = $2",
            [user_id, req.oidc.user.sub]
        );
    } catch (err) {
        return next(err);
    } finally {
        await client.release();
    }

    if (settings.rows.length == 0) {
        res.status(403).send(
            "The given Replika is not associated with the authenticated user."
        );
        return;
    }

    res.render("settings", { settings: settings.rows[0] });
});

module.exports = router;
