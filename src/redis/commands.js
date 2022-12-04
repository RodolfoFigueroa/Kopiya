const red_client = require("./client.js");
const config = require('../config.js');

async function get_dialogue_timeout(user_id) {
    if (!config.timeout_dialogue || !config.cooldown_dialogue) {
        return;
    }

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


async function activate_replika(params, profile, type) {
    const key = `user:${params.user_id}`;
    let transaction = red_client
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
    if (config.timeout){
        transaction = transaction.expire(key, config.timeout)
    }
    await transaction.exec();
}

async function activate_replika_dialogue(params_0, params_1, profile_0, profile_1, timeout_0, timeout_1, type) {
    const key_0 = `user:${params_0.user_id}`;
    const key_1 = `user:${params_1.user_id}`;
    let transaction = red_client
        .multi()
        .hSet(key_0, {
            avatar: params_0.avatar,
            name: profile_0.name,
            exhaustion: profile_0.exhaustion,
            day_counter: profile_0.day_counter,
            xp: profile_0.xp,
            xp_gap: profile_0.xp_gap,
            level: profile_0.level,
            type: type
        })
        .hSet(key_1, {
            avatar: params_1.avatar,
            name: profile_1.name,
            exhaustion: profile_1.exhaustion,
            day_counter: profile_1.day_counter,
            xp: profile_1.xp,
            xp_gap: profile_1.xp_gap,
            level: profile_1.level,
            type: type
        })

    if (timeout_0 && timeout_1) {
        transaction = transaction
            .expire(key_0, timeout_0)
            .expire(key_1, timeout_1)
    }

    await transaction.exec();
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
    activate_replika_dialogue: activate_replika_dialogue,
    deactivate_replika: deactivate_replika,
    is_active: is_active,
    refresh: refresh,
    get_dialogue_timeout: get_dialogue_timeout,
    red_client: red_client,
};
