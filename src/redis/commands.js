const red_client = require("./client.js");
const config = require('../config.js');

async function activate_replika(params, profile, type, dialogue) {
    let timeout;
    if (dialogue) {
        timeout = config.timeout_dialogue;
    }
    else {
        timeout = config.timeout;
    }
    
    const key = `user:${params.user_id}`;
    await red_client
        .multi()
        .hSet(key, {
            avatar: params.avatar,
            name: profile.name,
            exhaustion: profile.exhaustion,
            day_counter: profile.day_counter,
            xp: profile.xp,
            xp_gap: profile.xp_gap,
            level: profile.level,
            type: type
        })
        .expire(key, timeout)
        .exec();
}

async function deactivate_replika(user_id) {
    await red_client.del(`user:${user_id}`);
}

async function is_active(user_id) {
    return await red_client.exists(`user:${user_id}`);
}

async function refresh(user_id) {
    let timeout;
    if (process.env.REPLIKA_TIMEOUT) {
        timeout = process.env.REPLIKA_TIMEOUT;
    } else {
        timeout = 300;
    }
    await red_client.expire(`user:${user_id}`, timeout);
}

module.exports = {
    activate_replika: activate_replika,
    deactivate_replika: deactivate_replika,
    is_active: is_active,
    refresh: refresh,
    red_client: red_client,
};
