const red_client = require("./client.js");
const config = require('../config.js');

async function get_dialogue_timeout(user_id) {
    const exists = await red_client.exists(`remaining:${user_id}`);
    if (!exists) {
        await red_client.set(
            `remaining:${user_id}`,
            config.timeout_dialogue,
            {
                EX: config.cooldown_dialogue
            }
        )
    }
    const timeout = await red_client.get(`remaining:${user_id}`);
    return timeout;
}


async function activate_replika(params, profile, type, timeout=null) {
    let set_timeout;
    if (timeout) {
        set_timeout = timeout;
    } else {
        set_timeout = config.timeout;
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
        .expire(key, set_timeout)
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
    get_dialogue_timeout: get_dialogue_timeout,
    red_client: red_client,
};
