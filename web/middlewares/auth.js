const pool = require("../../src/database/pool.js");

async function check_replika_user(req, res, next) {
    let user_id;
    if (req.method == "POST") {
        user_id = req.body.user_id;
    } else if (req.method == "GET") {
        user_id = req.params.user_id;
    }

    let client;
    try {
        client = await pool.connect();
    } catch (err) {
        return next(err);
    }

    let result;
    try {
        result = await client.query(
            "SELECT EXISTS( SELECT 1 FROM settings WHERE user_id = $1 AND auth0_sub = $2 )",
            [user_id, req.oidc.user.sub]
        );
    } catch (err) {
        return next(err);
    } finally {
        await client.release();
    }

    if (!result.rows[0].exists) {
        res.status(403).send(
            "The given Replika is not associated with the authenticated user."
        );
        return;
    }

    next();
}

module.exports = {
    check_replika_user: check_replika_user,
};
