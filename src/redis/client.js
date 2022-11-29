const { createClient } = require("redis");

const red_client = createClient({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
});
red_client.on("error", (err) => console.log(err));

red_client.connect().catch((err) => console.log(err));

module.exports = red_client;
