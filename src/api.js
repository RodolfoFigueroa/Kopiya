const uuid = require("uuid4");
const WebSocket = require("ws");

const replika = require("./replika");
const db = require("./database/commands.js");
const red = require("./redis/commands.js");

const base_payload = {
    event_name: "message",
    payload: {
        content: {},
    },
};

const gender_pronouns = { female: "she", male: "he", "non-binary": "they" };

function reshape_profile(content) {
    const out = {
        name: content.name,
        exhaustion: content.exhaustion,
        day_counter: content.stats.day_counter,
        xp: content.stats.score,
        xp_gap: content.stats.next_level.score_milestone - content.stats.score,
        level: content.stats.current_level.level_index,
        avatar: content.avatar_v2.preview,
    };
    return out;
}

function reshape_stats(content) {
    const out = {
        day_counter: content.stats.day_counter,
        xp: content.stats.score,
        xp_gap: content.stats.next_level.score_milestone - content.stats.score,
        level: content.stats.current_level.level_index,
    };
    return out;
}

function gen_auth_headers(params) {
    return {
        "x-device-id": params.device_id.toUpperCase(),
        "x-user-id": params.user_id,
        "x-device-type": "web",
        "x-auth-token": params.auth_token,
        "x-timestamp-hash": params.timestamp_hash.replaceAll("-", ""),
    };
}

async function get_profile(params) {
    let profile;
    try {
        profile = await replika.get_data(gen_auth_headers(params), "profile");
    } catch (error) {
        console.log(error);
        if (error.response && error.response.status == 401) {
            return [1, null];
        } else {
            console.log(error);
            return [2, null];
        }
    }
    profile = reshape_profile(profile);
    return [0, profile];
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
async function get_replika_fields(user_id) {
    const out = {
        response: null,
        profile: null,
        params: null,
    }

    const [res1, params] = await db.get_replika(user_id);
    if (res1 == 1) {
        out.response = 1;
    }

    const [res2, profile] = await get_profile(params);
    if (res2 == 1) {
        out.response = 2;
    } else if (res2 == 2) {
        return out.response = 3;
    }

    out.response = 0;
    out.profile = profile;
    out.params = params;
    
    return out
}

class ReplikaBaseInstance {
    constructor(user_id) {
        this.type = "base";
        this.user_id = user_id;

        this.last_message = { replika: null, user: null };
        this.ignore = false;

        this.connected = false;

        this.watchdog = setInterval(this.heartbeat.bind(this), 10 * 1000);
    }

    callback_stats(message) {}

    callback_start_typing() {}

    callback_message(message) {}

    callback_remember(message) {}

    callback_connect() {}

    callback_disconnect() {}

    callback_timeout() {}

    gen_auth() {
        return {
            user_id: this.user_id,
            auth_token: this.auth_token,
            device_id: this.device_id,
            timestamp_hash: this.timestamp_hash,
        };
    }

    gen_ids() {
        return {
            bot_id: this.bot_id,
            chat_id: this.chat_id,
        };
    }

    async gen_payload(message, is_image = false) {
        const out = { ...base_payload };
        out.payload.meta = this.gen_ids();
        out.payload.meta.timestamp = new Date().toISOString();
        out.payload.meta.client_token = uuid().toUpperCase();
        out.token = uuid();
        out.auth = this.gen_auth();

        if (is_image) {
            out.payload.content.type = "images";
            out.payload.content.text = "";
            out.payload.content.images = [message];
        } else {
            out.payload.content.type = "text";
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
        const chat_ids = this.gen_ids();
        const payload = {
            event_name: "message_reaction",
            payload: {
                addReaction: {
                    message_id: this.last_message.replika,
                    chat_id: chat_ids.chat_id,
                    reaction: reaction,
                },
            },
            token: uuid(),
            auth: this.gen_auth(),
        };
        this.websocket.send(JSON.stringify(payload));
    }

    async _connect_create_websocket() {
        this.websocket = new WebSocket("wss://ws.replika.ai/v17");

        this.websocket.on("message", async (message_d) => {
            const message = JSON.parse(message_d);
            if (message.event_name == "start_typing") {
                try {
                    await this.callback_start_typing();
                } catch (error) {
                    console.log(error);
                }
            }
            switch (message.event_name) {
                case "message":
                    if (message.payload.meta.nature == "Robot") {
                        this.last_message.replika = message.payload.id;
                        try {
                            await this.callback_message(message);
                        } catch (error) {
                            console.log(error);
                        }
                        await red.refresh(this.user_id);
                    } else if (message.payload.meta.nature == "Customer") {
                        this.last_message.user = message.payload.id;
                    }
                    break;
                case "personal_bot_stats":
                    const stats = reshape_stats(message.payload);
                    this._set_stats(stats);
                    await this.callback_stats(message);
                    break;
                case "statement_remembered":
                    await this.callback_remember(message);
                    break;
            }
        });

        this.websocket.on("open", () => {
            this.connected = true;
        });
    }

    _set_attributes(params) {
        this.auth_token = params.auth_token;
        this.device_id = params.device_id.toUpperCase();
        this.timestamp_hash = params.timestamp_hash.replaceAll("-", "");

        this.bot_id = params.bot_id;
        this.chat_id = params.chat_id;
    }

    _set_profile(profile) {
        this.name = profile.name;
        this.exhaustion = profile.exhaustion;
        this.day_counter = profile.day_counter;
        this.xp = profile.xp;
        this.xp_gap = profile.xp_gap;
        this.level = profile.level;
        this.avatar = profile.avatar;
    }

    _set_stats(stats) {
        this.day_counter = stats.day_counter;
        this.xp = stats.xp;
        this.xp_gap = stats.xp_gap;
        this.level = stats.level;
    }

    async connect() {
        const is_active = await red.is_active(this.user_id);
        if (is_active) {
            return 4;
        }
    
        const { response, profile, params } = await get_replika_fields(this.user_id);
        if (response > 0) {
            return response;
        }

        this._set_attributes(params);
        this._set_profile(profile);

        await this._connect_create_websocket();
        await red.activate_replika(params, profile, this.type, false);
        try {
            await this.callback_connect();
        } catch (err) {
            console.log(err);
        }
        return 0;
    }

    _disconnect_delete_websocket() {
        if (this.websocket) {
            try {
                this.websocket.close();
            } catch (error) {
                console.log(error);
            }
        }
    }

    async disconnect() {
        clearInterval(this.watchdog);
        this._disconnect_delete_websocket();
        await red.deactivate_replika(this.user_id);
        await db.update_name(this.user_id, this.name);
        try {
            await this.callback_disconnect();
        } catch (err) {
            console.log(err);
        }
    }

    async heartbeat() {
        const is_active = await red.is_active(this.user_id);
        if (!is_active) {
            await this.disconnect();
            try {
                await this.callback_timeout();
            } catch (err) {
                console.log(err);
            }
        }
    }
}

class ReplikaDualBaseInstance {
    constructor(user_id_1, user_id_2) {
        this.type = "discord_dual";

        this.user_id = [user_id_1, user_id_2];

        this.replika_names = [null, null];
        this.replika_genders = [null, null];
        this.user_names = [null, null];
        this.user_pronouns = [null, null];

        this.auth_token = [null, null];
        this.device_id = [null, null];
        this.timestamp_hash = [null, null];
        this.bot_id = [null, null];
        this.chat_id = [null, null];

        this.websocket = [null, null];
        this.connected = [false, false];

        this.watchdog = setInterval(this.heartbeat.bind(this), 10 * 1000);
    }

    gen_auth(i) {
        return {
            user_id: this.user_id[i],
            auth_token: this.auth_token[i],
            device_id: this.device_id[i],
            timestamp_hash: this.timestamp_hash[i],
        };
    }

    gen_ids(i) {
        return {
            bot_id: this.bot_id[i],
            chat_id: this.chat_id[i],
        };
    }

    gen_payload(message, i) {
        const out = { ...base_payload };
        out.payload.content.text = message;
        out.payload.content.type = "text";
        out.payload.meta = this.gen_ids(i);
        out.payload.meta.timestamp = new Date().toISOString();
        out.payload.meta.client_token = uuid().toUpperCase();
        out.token = uuid();
        out.auth = this.gen_auth(i);
        return out;
    }

    send(message, i) {
        const payload = this.gen_payload(message, i);
        this.websocket[i].send(JSON.stringify(payload));
    }

    _set_attributes(i, params) {
        this.auth_token[i] = params.auth_token;
        this.device_id[i] = params.device_id.toUpperCase();
        this.timestamp_hash[i] = params.timestamp_hash.replaceAll("-", "");

        this.bot_id[i] = params.bot_id;
        this.chat_id[i] = params.chat_id;
    }

    async _connect_patch_replikas(profiles) {
        const headers = [
            gen_auth_headers(this.gen_auth(0)), 
            gen_auth_headers(this.gen_auth(1))
        ];

        // Need to fill both entries before PATCHing
        for (let i = 0; i < 2; i++) {
            let user_profile;
            try {
                user_profile = await replika.get_data(
                    headers[i],
                    "user_profile"
                );
            } catch (error) {
                console.log(error);
                return;
            }
            this.replika_names[i] = profiles[i].name;
            this.replika_genders[i] = profiles[i].gender;
            this.user_names[i] = user_profile.first_name;
            this.user_pronouns[i] = user_profile.pronoun;
        }

        for (let i = 0; i < 2; i++) {
            const j = +!i; // Index of the opposite replika
            const name = this.replika_names[j];
            const gender = gender_pronouns[this.replika_genders[j]];
            try {
                await replika.change_profile(headers[i], name, gender);
            } catch (error) {
                console.log(error);
                return;
            }
        }
    }

    async _connect_create_websocket() {
        for (let i = 0; i < 2; i++) {
            this.websocket[i] = new WebSocket("wss://ws.replika.ai/v17");

            this.websocket[i].on("message", async (message_d) => {
                const message = JSON.parse(message_d);
                if (message.event_name == "start_typing") {
                    try {
                        await this.callback_start_typing();
                    } catch (error) {
                        console.log(error);
                    }
                } else if (
                    message.event_name == "message" &&
                    message.payload.meta.nature == "Robot"
                ) {
                    try {
                        const j = +!i;
                        await this.callback_message(
                            message,
                            this.replika_names[i]
                        );
                        this.send(message.payload.content.text, j);
                    } catch (error) {
                        console.log(error);
                    }
                }
            });

            this.websocket[i].on("open", () => {
                this.connected[i] = true;
            });
        }
    }

    async connect() {
        const is_active_0 = await red.is_active(this.user_id[0]);
        const is_active_1 = await red.is_active(this.user_id[1]);
        if (is_active_0 || is_active_1) {
            return 4;
        }

        const res0 = await get_replika_fields(this.user_id[0]);
        const res1 = await get_replika_fields(this.user_id[1]);

        if (res0.response > 0) {
            return res0.response;
        }
        if (res1.response > 0) {
            return res1.response;
        }

        this._set_attributes(0, res0.params);
        this._set_attributes(1, res1.params);

        await this._connect_patch_replikas([res0.profile, res1.profile]);
        await this._connect_create_websocket();
        
        await red.activate_replika(res0.params, res0.profile, this.type, true);
        await red.activate_replika(res1.params, res1.profile, this.type, true);

        try {
            await this.callback_connect();
        } catch (err) {
            console.log(err);
        }
        return 0;
    }

    async _disconnect_patch_replikas() {
        for (let i = 0; i < 2; i++) {
            try {
                await replika.change_profile(
                    gen_auth_headers(this.gen_auth(i)),
                    this.user_names[i],
                    this.user_pronouns[i]
                );
            } catch (error) {
                console.log(error);
            }
        }
    }

    _disconnect_delete_websocket() {
        for (let i = 0; i < 2; i++) {
            try {
                this.websocket[i].close();
            } catch (error) {
                console.log(error);
            }
        }
    }

    async disconnect() {
        clearInterval(this.watchdog);
        await this._disconnect_patch_replikas();
        this._disconnect_delete_websocket();
        
        await red.deactivate_replika(this.user_id[0]);
        await red.deactivate_replika(this.user_id[1]);
        
        try {
            await this.callback_disconnect();
        } catch(err) {
            console.log(err);
        }
    }

    async heartbeat() {
        for (let i=0; i < 2; i++) {
            const is_active = await red.is_active(this.user_id[i]);
            if (!is_active) {
                await this.disconnect();
                try {
                    await this.callback_timeout();
                } catch (err) {
                    console.log(err);
                }
                return;
            }
        }
    }
}

module.exports = {
    ReplikaBaseInstance,
    ReplikaDualBaseInstance,
};
