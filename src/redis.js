const { createClient } = require('redis');

const red_client = createClient();
red_client.on('error', err => console.log(err));
red_client.on('connect', () => console.log('Connected'));

async function activate_replika(params, profile) {
    await red_client.hSet(
        'user:' + params.user_id, 
        {
            'bot_id': params.bot_id,
            'chat_id': params.chat_id,
            'auth_token': params.auth_token,
            'device_id': params.device_id.toUpperCase(),
            'timestamp_hash': params.timestamp_hash.replaceAll('-', ''),
            'avatar': params.avatar,
            
            'name': profile.name,
            'exhaustion': profile.exhaustion,
            'day_counter': profile.day_counter,
            'xp': profile.xp,
            'xp_gap': profile.xp_gap,
            'level': profile.level,
        }
    );
}

async function deactivate_replika(user_id) {
    await red_client.del('user:' + user_id);
}

async function get_auth(user_id) {
    const res = await red_client.hmGet(
        'user:' + user_id, 
        ['auth_token', 'device_id', 'timestamp_hash']
    )
    return {
        user_id: user_id,
        auth_token: res[0],
        device_id: res[1],
        timestamp_hash: res[2]
    }
}

async function get_chat_ids(user_id) {
    const res = await red_client.hmGet(
        'user:' + user_id, 
        ['bot_id', 'chat_id']
    )
    return {
        bot_id: res[0],
        chat_id: res[1]
    }
}

async function set_stats(user_id, profile) {
    await red_client.hSet(
        'user:' + user_id,
        {
            'day_counter': profile.day_counter,
            'xp': profile.xp,
            'xp_gap': profile.xp_gap,
            'level': profile.level,      
        }
    );
}

async function get_field(user_id, field) {
    return await red_client.hGet('user:' + user_id, field)
}

async function get_fields(user_id, fields) {
    return await red_client.hmGet('user:' + user_id, fields)
}

async function is_active(user_id) {
    return await red_client.exists('user:' + user_id)
}


module.exports = {
    activate_replika: activate_replika,
    deactivate_replika: deactivate_replika,
    get_auth: get_auth,
    get_chat_ids: get_chat_ids,
    set_stats: set_stats,
    get_field: get_field,
    get_fields: get_fields,
    is_active: is_active,
    red_client: red_client
}