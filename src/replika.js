const axios = require("axios");
const md5 = require("md5");
const uuid = require("uuid4");

const base_headers = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.5",
    Connection: "keep-alive",
    "content-type": "application/json",
    "x-device-type": "web",
};

const endpoints = {
    chat: "personal_bot_chat",
    profile: "personal_bot",
    memory: "memory",
    user_profile: "profile",
};

function reshape_auth(auth) {
    return {
        "x-device-id": auth.device_id.toUpperCase(),
        "x-timestamp-hash": auth.timestamp_hash.replaceAll("-", ""),
        "x-user-id": auth.user_id,
        "x-auth-token": auth.auth_token,
    };
}

function gen_timestamp_hash(device_id) {
    return md5("time_covfefe_prefix=2020_" + device_id);
}

async function get_auth(username) {
    const device_id = uuid().toUpperCase();
    const timestamp_hash = gen_timestamp_hash(device_id);
    const headers = {
        ...base_headers,
        "x-device-id": device_id,
        "x-timestamp-hash": timestamp_hash,
    };
    const payload = { id_string: username };
    await axios.post(
        "https://my.replika.ai/api/mobile/1.4/auth/sign_in/actions/get_auth_type",
        payload,
        { headers: headers }
    );
    return {
        "x-device-id": device_id,
        "x-timestamp-hash": timestamp_hash,
    };
}

async function login(username, password) {
    const auth = await get_auth(username);
    const user_headers = {
        ...base_headers,
        ...auth,
        "User-Agent": "ReplikaJS",
    };
    const payload = {
        id_type: "email",
        id_string: username,
        password: password,
    };

    const response = await axios.post(
        "https://my.replika.ai/api/mobile/1.4/auth/sign_in/actions/auth_by_password",
        payload,
        { headers: user_headers }
    );
    return {
        ...auth,
        "x-user-id": response.data["user_id"],
        "x-auth-token": response.data["auth_token"],
    };
}

async function get_data(auth, endpoint) {
    const user_headers = {
        ...base_headers,
        ...auth,
    };
    const url = "https://my.replika.ai/api/mobile/1.4/" + endpoints[endpoint];
    const response = await axios.get(url, { headers: user_headers });
    return response.data;
}

async function change_profile(auth, name, gender) {
    const user_headers = {
        ...base_headers,
        ...auth,
    };
    const payload = {
        first_name: name,
        last_name: null,
        pronoun: gender,
    };
    const response = await axios.patch(
        "https://my.replika.ai/api/mobile/1.4/profile",
        payload,
        { headers: user_headers }
    );
    return response;
}

module.exports = {
    get_auth: get_auth,
    get_data: get_data,
    login: login,
    gen_timestamp_hash: gen_timestamp_hash,
    change_profile: change_profile,
    reshape_auth: reshape_auth,
};
