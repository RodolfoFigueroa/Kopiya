const escape = require('markdown-escape')
const { chats } = require("./handlers.js");
const {
    ReplikaBase,
    ReplikaDualBase,
} = require("../../api.js");
const bot = require("./bot.js");

class ReplikaTelegram extends ReplikaBase {
    constructor(user_id, chat) {
        super(user_id);
        this.type = "telegram";
        this.chat = chat;
        this.last_telegram_message = { replika: null, user: null };
    }
}

class ReplikaDualTelegram extends ReplikaDualBase {
    constructor(user_id_1, user_id_2, chat) {
        super(user_id_1, user_id_2);
        this.chat = chat;
    }
}

function ReplikaTelegramBuilder(user_id, channel) {
    const replika = new ReplikaTelegram(user_id, channel);

    replika.on("message", async message => {
        const sent = await bot.api.sendMessage(replika.chat.id, message.payload.content.text);
        replika.last_telegram_message.replika = sent;
    })

    replika.on("start_typing", async () => {
        test = await bot.api.sendChatAction(replika.chat.id, "typing");
    })

    replika.on("connect", async () => {
        chats[replika.chat.id] = replika;
    })

    replika.on("disconnect", async () => {
        delete chats[replika.chat.id];
    })

    replika.on("timeout", async () => {
        await bot.api.sendMessage(replika.chat.id, "Replika forcibly disconnected.");
    })

    return replika;
}

function ReplikaDualTelegramBuilder(user_id_1, user_id_2, chat) {
    const replika = new ReplikaDualTelegram(user_id_1, user_id_2, chat);

    replika.on("connect", async () => {
        chats[replika.chat.id] = replika;
    })

    replika.on("disconnect", async () => {
        delete chats[replika.chat.id];
    })

    replika.on("start_typing", async () => {
        test = await bot.api.sendChatAction(replika.chat.id, "typing");
    })

    replika.on("message", async (message, replika_name) => {
        const msg = `*${replika_name}:* ${escape(message.payload.content.text)}`;
        await bot.api.sendMessage(replika.chat.id, msg, { parse_mode: "Markdown" });
    })

    replika.on("timeout", async () => {
        await bot.api.sendMessage(replika.chat.id, "Replika forcibly disconnected.");
    })

    return replika;
}

module.exports = {
    ReplikaTelegramBuilder: ReplikaTelegramBuilder,
    ReplikaDualTelegramBuilder: ReplikaDualTelegramBuilder,
    ReplikaTelegram: ReplikaTelegram,
    ReplikaDualTelegram: ReplikaDualTelegram
};
