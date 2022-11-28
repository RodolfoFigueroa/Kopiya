const { channels, active } = require("./handlers.js");
const {
    ReplikaBaseInstance,
    ReplikaDualBaseInstance,
} = require("../../api.js");
const red = require("../../redis/commands.js");

class ReplikaInstance extends ReplikaBaseInstance {
    constructor(user_id, channel) {
        super(user_id);
        this.type = "discord";
        this.channel = channel;
        this.last_discord_message = { replika: null, user: null };
    }

    async send(message) {
        if (this.ignore || !this.connected) {
            return;
        }
        if (message.attachments.size == 0) {
            await this.send_text(message.content);
        } else {
            const url = message.attachments.first().url;
            await this.send_image(url);
        }
        this.last_discord_message.user = message;
    }

    async callback_start_typing() {
        await this.channel.sendTyping();
    }

    async callback_message(message) {
        const sent = await this.channel.send(message.payload.content.text);
        this.last_discord_message.replika = sent;
    }

    async callback_remember(message) {
        if (message.payload.message_id == this.last_message.user) {
            await this.last_discord_message.user.react("💭");
        }
    }

    async callback_connect() {
        channels[this.channel.id] = this;
        const member = await this.channel.guild.members.fetch(
            process.env.DISCORD_CLIENT_ID
        );
        await member.setNickname(this.name);
    }

    async callback_disconnect() {
        delete channels[this.channel.id];
        const member = await this.channel.guild.members.fetch(
            process.env.DISCORD_CLIENT_ID
        );
        await member.setNickname("Replika");
    }

    async callback_timeout() {
        await this.channel.send("Replika forcibly disconnected.");
    }
}

class ReplikaDualInstance extends ReplikaDualBaseInstance {
    constructor(user_id_1, user_id_2, channel) {
        super(user_id_1, user_id_2);
        this.channel = channel;
    }

    callback_connect() {
        channels[this.channel.id] = this;
    }

    callback_disconnect() {
        delete channels[this.channel.id];
    }

    async callback_start_typing() {
        await this.channel.sendTyping();
    }

    async callback_message(message, replika_name) {
        const msg = `**${replika_name}:** ${message.payload.content.text}`;
        await this.channel.send(msg);
    }

    async callback_timeout() {
        await this.channel.send(
            "Replika forcibly disconnected."
        );
        
    }
}

module.exports = {
    ReplikaInstance,
    ReplikaDualInstance,
};
