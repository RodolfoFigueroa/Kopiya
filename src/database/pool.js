const { Pool } = require("pg");

const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
});
pool.on("error", (err) => console.log(err));

module.exports = pool;
