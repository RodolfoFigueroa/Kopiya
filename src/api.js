const uuid = require("uuid4");
const WebSocket = require("ws");
const { EventEmitter } = require('node:events');
const { ConnectionError } = require('./errors.js');

const replika = require("@kopiya/kopiya-common");
const db = require("./database/commands.js");
const red = require("./redis/commands.js");
const pool = require('./database/pool.js');

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
        profile: null,
        params: null,
    }

    let client;
    try {
        client = await pool.connect()
    } catch (err) {
        throw new ConnectionError(1, "There was an error connecting to the database.");
    }

    let result;
    try {
        result = await client.query(
            "SELECT * FROM settings WHERE user_id = $1",
            [ user_id ]
        );
    } catch (err) {
        throw new ConnectionError(1, "There was an error connecting to the database.");
    } finally {
        await client.release();
    }

    if (result.rows.length == 0) {
        throw new ConnectionError(5, "No Replika matching the provided user ID.");
    }

    const params = result.rows[0];

    const [res2, profile] = await get_profile(params);
    if (res2 == 1) {
        throw new ConnectionError(2, "Device wasn't authenticated. Please unregister your Replika and then register it again.");
    } else if (res2 == 2) {
        throw new ConnectionError(3, "Couldn't connect to the Replika server.");
    }

    out.profile = profile;
    out.params = params;
    
    return out
}


class ReplikaBase extends EventEmitter {
    constructor(user_id) {
        super();
        this.type = "base";
        this.user_id = user_id;

        this.last_message = { replika: null, user: null };

        this.connected = false;

        this.watchdog = setInterval(this.heartbeat.bind(this), 10 * 1000);
    }

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
        if (!this.connected) {
            return;
        }

        const payload = await this.gen_payload(text);
        this.websocket.send(JSON.stringify(payload));
    }

    async send_image(url) {
        if (!this.connected) {
            return;
        }

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
            switch (message.event_name) {
                case "start_typing":
                    this.emit("start_typing");
                    break;
                case "message":
                    switch (message.payload.meta.nature) {
                        case "Robot":
                            this.last_message.replika = message.payload.id;                        
                            await red.refresh(this.user_id);
                            this.emit("message", message);
                            break;
                        case "Customer":
                            this.last_message.user = message.payload.id;
                            break;
                    }
                    break;
                case "personal_bot_stats":
                    const stats = reshape_stats(message.payload);
                    this._set_stats(stats);
                    this.emit("stats", stats);
                    break;
                case "statement_remembered":
                    this.emit("memory", message);
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
            throw new ConnectionError(4, "Replika is already active.")
        }
    
        const { profile, params } = await get_replika_fields(this.user_id);

        this._set_attributes(params);
        this._set_profile(profile);

        await this._connect_create_websocket();
        await red.activate_replika(params, profile, this.type);
        this.emit("connect");
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
        this.emit("disconnect");
    }

    async heartbeat() {
        const is_active = await red.is_active(this.user_id);
        if (!is_active) {
            await this.disconnect();
            this.emit("timeout");
        }
    }
}

class ReplikaDualBase extends EventEmitter {
    constructor(user_id_1, user_id_2) {
        super();

        this.type = "base_dual";
        this.start = Date.now();

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

                switch (message.event_name) {
                    case "start_typing":
                        this.emit("start_typing", i);
                        break;
                    case "message":
                        if (message.payload.meta.nature == "Robot") {
                            const j = +!i;
                            this.send(message.payload.content.text, j);
                            this.emit("message", message, this.replika_names[i]);
                        }
                        break;
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
            throw new ConnectionError(4, "Replika is already active.");
        }

        const timeout0 = await red.get_dialogue_timeout(this.user_id[0]);
        const timeout1 = await red.get_dialogue_timeout(this.user_id[1]);

        if (timeout0 <= 0 || timeout1 <= 0) {
            throw new ConnectionError(6, "Replika has a dialogue cooldown.");
        }

        const res0 = await get_replika_fields(this.user_id[0]);
        const res1 = await get_replika_fields(this.user_id[1]);

        this._set_attributes(0, res0.params);
        this._set_attributes(1, res1.params);

        await this._connect_patch_replikas([res0.profile, res1.profile]);
        await this._connect_create_websocket();
        
        await red.activate_replika_dialogue(res0.params, res1.params, res0.profile, res1.profile, timeout0, timeout1, this.type);

        this.emit("connect");
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

    async _disconnect_update_timeouts() {
        const [rem0, rem1] = await red.red_client
            .multi()
            .get(`remaining:${this.user_id[0]}`)
            .get(`remaining:${this.user_id[1]}`)
            .exec()

        if (!rem0 || !rem1) {
            return;
        }

        const diff = Math.trunc((Date.now() - this.start) / 1000);
        const new0 = rem0 - diff;
        const new1 = rem1 - diff;

        await red.red_client
            .multi()
            .set(`remaining:${this.user_id[0]}`, new0, { XX: true, KEEPTTL: true })
            .set(`remaining:${this.user_id[1]}`, new1, { XX: true, KEEPTTL: true })
            .exec()
    }

    async disconnect() {
        clearInterval(this.watchdog);
        await this._disconnect_patch_replikas();
        this._disconnect_delete_websocket();
        
        await red.deactivate_replika(this.user_id[0]);
        await red.deactivate_replika(this.user_id[1]);

        await this._disconnect_update_timeouts();
        
        this.emit("disconnect");
    }

    async heartbeat() {
        for (let i=0; i < 2; i++) {
            const is_active = await red.is_active(this.user_id[i]);
            if (!is_active) {
                await this.disconnect();
                this.emit("timeout");
                return;
            }
        }
    }
}

module.exports = {
    ReplikaBase,
    ReplikaDualBase,
};
