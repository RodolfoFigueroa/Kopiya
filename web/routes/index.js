var router = require("express").Router();
const pool = require("../../src/database/pool.js");

router.get("/", (req, res, next) => {
    res.render("index");
});

module.exports = router;
