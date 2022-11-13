const uuid = require('uuid4');
const WebSocket = require('ws');
const axios = require('axios');

const replika = require('./replika');
const db = require('./database/commands.js');
const red = require('./redis.js');

const base_payload = {
    'event_name': 'message',
    'payload': {
        'content': {},
    },
};

const gender_pronouns = { 'female': 'she', 'male': 'he', 'non-binary': 'they' };

function reshape_profile(content) {
    const out = {
        name: content.name,
        exhaustion: content.exhaustion,
        day_counter: content.stats.day_counter,
        xp: content.stats.score,
        xp_gap: content.stats.next_level.score_milestone - content.stats.score,
        level: content.stats.current_level.level_index,
    }
    return out
}

function reshape_stats(content) {
    const out = {
        day_counter: content.stats.day_counter,
        xp: content.stats.score,
        xp_gap: content.stats.next_level.score_milestone - content.stats.score,
        level: content.stats.current_level.level_index
    }
    return out
}

function gen_auth_headers(params) {
    return {
        'x-device-id': params.device_id.toUpperCase(),
        'x-user-id': params.user_id,
        'x-device-type': 'web',
        'x-auth-token': params.auth_token,
        'x-timestamp-hash': params.timestamp_hash.replaceAll('-', ''),
    };
}

class ReplikaBaseInstance {
    constructor(user_id) {
        this.user_id = user_id

        this.id = 'base';
        this.last_message = { replika: null, user: null };
        this.ignore = false;

        this.websocket = null;
        this.connected = false;

        this.watchdog = setTimeout(this.time_disconnect.bind(this), 5 * 60 * 1000);        
    }

    async gen_payload(message, is_image = false) {
        const out = { ...base_payload };
        out.payload.meta = await red.get_chat_ids(this.user_id);
        out.payload.meta.timestamp = (new Date).toISOString();
        out.payload.meta.client_token = uuid().toUpperCase();
        out.token = uuid();
        out.auth = await red.get_auth(this.user_id);

        if (is_image) {
            out.payload.content.type = 'images';
            out.payload.content.text = '';
            out.payload.content.images = [message];
        }
        else {
            out.payload.content.type = 'text';
            out.payload.content.text = message;
        }
        return out;
    }

    async send_text(text) {
        const payload = await this.gen_payload(text);
        this.websocket.send(JSON.stringify(payload));
    }

    async send_image(url) { 
        const payload = await this.gen_payload(url, true);
        this.websocket.send(JSON.stringify(payload));
    }

    async send_reaction(reaction) {
        const chat_ids = await red.get_chat_ids(this.user_id);
        const payload = {
            event_name: 'message_reaction',
            payload: {
                addReaction: {
                    message_id: this.last_message.replika,
                    chat_id: chat_ids.chat_id,
                    reaction: reaction,
                },
            },
            token: uuid(),
            auth: await red.get_auth(this.user_id),
        };
        this.websocket.send(JSON.stringify(payload));
    }

    async _connect_create_websocket() {
        this.websocket = new WebSocket('wss://ws.replika.ai/v17');

        this.websocket.on('message', async (message_d) => {
            const message = JSON.parse(message_d);
            if (message.event_name == 'start_typing') {
                try {
                    await this.callback_start_typing();
                }
                catch (error) {
                    console.log(error);
                }
            }
            switch (message.event_name) {
                case 'message':
                    if (message.payload.meta.nature == 'Robot') {
                        this.last_message.replika = message.payload.id;
                        try {
                            await this.callback_message(message);
                        }
                        catch (error) {
                            console.log(error);
                        }
                        this.watchdog.refresh();
                    }
                    else if (message.payload.meta.nature == 'Customer') {
                        this.last_message.user = message.payload.id;
                    }
                    break;
                case 'personal_bot_stats':
                    const stats = reshape_stats(message.payload);
                    await red.set_stats(this.user_id, stats);
                    await this.callback_stats(message);
                    break;
                case 'statement_remembered':
                    await this.callback_remember(message);
                    break;
            }
        });

        this.websocket.on('open', () => {
            this.connected = true;
        });
    }

    async _connect_fetch_profile(params) {
        let profile;
        try {
            profile = await replika.get_data(gen_auth_headers(params), 'profile');
        }
        catch (error) {
            console.log(error);
            if (error.response && error.response.status == 401) {
                return [ 1, null ];
            }
            else {
                console.log(error);
                return [ 2, null ];
            }
        }
        profile = reshape_profile(profile);
        return [ 0, profile ]
    }

    /**
     * 
     * @returns 
     *      - 0: Normal return
     *      - 1: Database error.
     *      - 2: Authentication expired.
     *      - 3: Server error.
     *      - 4: Already active.
     */
    async connect() {
        const [ res1, params ] = await db.get_replika(this.user_id);
        const [ res2, profile ] = await this._connect_fetch_profile(params);
        const res3 = await red.is_active(this.user_id);

        if (res1 == 1) {
            return 1;
        }
        if (res2 == 1) {
            return 2;
        }
        else if (res2 == 2) {
            return 3;
        }
        if (res3) {
            return 4;
        }

        await this._connect_create_websocket();
        await red.activate_replika(params, profile);
        await this.callback_connect();
        return 0;
    }

    _disconnect_delete_websocket() {
        if (this.websocket) {
            try {
                this.websocket.close();
            }
            catch (error) {
                console.log(error);
            }
        }
    }

    async _disconnect_update_database() {
        try {
            await db.update_data(this.user_id);
        }
        catch (error) {
            console.log(error);
        }
    }

    async disconnect() {
        this._disconnect_delete_websocket();
        await this._disconnect_update_database();
        await red.deactivate_replika(this.user_id);
        await this.callback_disconnect();
        clearTimeout(this.watchdog);
    }

    async time_disconnect() {
        await this.disconnect();
        await this.callback_timeout();
    }

    async set_avatar(url) {
        let res;
        try {
            res = await axios.head(url);
        }
        catch (error) {
            return;
        }
        if (res.headers['content-type'].startsWith('image') && res.headers['content-length'] <= 1024 * 1024) {
            this.avatar = url;
            return true;
        }
        else {
            return;
        }
    }
}


class ReplikaDualBaseInstance {
    constructor(params) {
        this.chat_ids = params.map(param => {
            return {
                bot_id: param.bot_id,
                chat_id: param.chat_id,
            };
        });

        this.auth = params.map(param => {
            return {
                user_id: param.user_id,
                auth_token: param.auth_token,
                device_id: param.device_id.toUpperCase(),
                timestamp_hash: param.timestamp_hash.replaceAll('-', ''),
            };
        });

        this.replika_names = [null, null];
        this.replika_genders = [null, null];
        this.user_names = [null, null];
        this.user_pronouns = [null, null];

        this.websocket = [null, null];
        this.connected = [false, false];

        this.watchdog = setTimeout(this.time_disconnect.bind(this), 30 * 60 * 1000);
    }

    gen_payload(message, i) {
        const out = { ...base_payload };
        out.payload.content.text = message;
        out.payload.content.type = 'text';
        out.payload.meta = { ...this.chat_ids[i] };
        out.payload.meta.timestamp = (new Date).toISOString();
        out.payload.meta.client_token = uuid().toUpperCase();
        out.token = uuid();
        out.auth = this.auth[i];
        return out;
    }

    gen_auth_headers(i) {
        return {
            'x-device-id': this.auth[i].device_id,
            'x-user-id': this.auth[i].user_id,
            'x-auth-token': this.auth[i].auth_token,
            'x-timestamp-hash': this.auth[i].timestamp_hash,
        };
    }

    send(message, i) {
        const payload = this.gen_payload(message, i);
        this.websocket[i].send(JSON.stringify(payload));
    }

    async _connect_patch_replikas() {
        const headers = [this.gen_auth_headers(0), this.gen_auth_headers(1)];
        for (let i = 0; i < 2; i++) {
            let profile, user_profile;
            try {
                profile = await replika.get_data(headers[i], 'profile');
                user_profile = await replika.get_data(headers[i], 'user_profile');
            }
            catch (error) {
                console.log(error);
                return;
            }
            this.replika_names[i] = profile.name;
            this.replika_genders[i] = profile.gender;
            this.user_names[i] = user_profile.first_name;
            this.user_pronouns[i] = user_profile.pronoun;
        }
        // Need to fill both entries before PATCHing
        for (let i = 0; i < 2; i++) {
            const j = +!i;
            const name = this.replika_names[j];
            const gender = gender_pronouns[this.replika_genders[j]];
            try {
                await replika.change_profile(headers[i], name, gender);
            }
            catch (error) {
                console.log(error);
                return;
            }
        }
    }

    async _connect_create_websocket() {
        for (let i = 0; i < 2 ; i++) {
            this.websocket[i] = new WebSocket('wss://ws.replika.ai/v17');

            this.websocket[i].on('message', async (message_d) => {
                const message = JSON.parse(message_d);
                if (message.event_name == 'start_typing') {
                    try {
                        await this.callback_start_typing();
                    }
                    catch (error) {
                        console.log(error);
                    }
                }
                else if (message.event_name == 'message' && message.payload.meta.nature == 'Robot') {
                    try {
                        const j = +!i;
                        await this.callback_message(message, this.replika_names[i]);
                        this.send(message.payload.content.text, j);
                    }
                    catch (error) {
                        console.log(error);
                    }
                    this.watchdog.refresh();
                }
            });

            this.websocket[i].on('open', () => {
                this.connected[i] = true;
            });
        }
    }

    async connect() {
        await this._connect_patch_replikas();
        this._connect_update_discord_handlers();
        await this._connect_create_websocket();
        await this.callback_connect();
        return 0;
    }

    async _disconnect_patch_replikas() {
        for (let i = 0; i < 2; i++) {
            try {
                await replika.change_profile(this.gen_auth_headers(i), this.user_names[i], this.user_pronouns[i]);
            }
            catch (error) {
                console.log(error);
            }
        }
    }

    _disconnect_delete_websocket() {
        for (let i = 0; i < 2; i++) {
            try {
                this.websocket[i].close();
            }
            catch (error) {
                console.log(error);
            }
        }
    }

    async disconnect() {
        await this._disconnect_patch_replikas();
        this._disconnect_update_discord_handlers();
        this._disconnect_delete_websocket();
        await this.callback_disconnect();
        clearTimeout(this.watchdog);
    }

    async time_disconnect() {
        await this.disconnect();
        try {
            await this.callback_timeout();
        }
        catch (error) {
            console.log(error);
        }
    }
}

module.exports = {
    ReplikaBaseInstance,
    ReplikaDualBaseInstance,
}