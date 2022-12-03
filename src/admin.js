const red_client = require('./redis/client.js');
const config = require("./config.js");

async function consume_token(token) {
    const user_id = await red_client.getDel(`token:${token}`);
    await red_client.del(`user_token:${user_id}`);
    return user_id;
}


module.exports = {
    consume_token: consume_token,
}