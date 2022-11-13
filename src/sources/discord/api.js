const { channels, guilds, active } = require('./handlers.js')
const { ReplikaBaseInstance, ReplikaDualBaseInstance } = require('../../api.js')
const red = require('../../redis.js');

class ReplikaInstance extends ReplikaBaseInstance {
    constructor(user_id, channel) {
        super(user_id);
        this.channel = channel;
        this.last_discord_message = { replika: null, user: null };
    }

    async send(message) {
        if (this.ignore || !this.connected) {
            return;
        }
        if (message.attachments.size == 0) {
            await this.send_text(message.content);
        }
        else {
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

    async callback_stats(message) {}

    async callback_remember(message) {
        if (message.payload.message_id == this.last_message.user) {
            await this.last_discord_message.user.react('💭');
        }
    }

    async callback_connect() {
        await this._connect_set_discord_nickname();
        this._connect_update_discord_handlers();
    }

    async callback_disconnect() {
        await this._disconnect_set_discord_nickname();
        this._disconnect_update_discord_handlers();
    }

    async callback_timeout() {
        await this.channel.send('Replika disconnected due to inactivity.');
    }

    _connect_update_discord_handlers() {
        channels[this.channel.id] = this;
        if (guilds[this.guild_id]) {
            guilds[this.guild_id].add(this.channel.id);
        }
        else {
            guilds[this.guild_id] = new Set([this.channel.id]);
        }
    }

    async _connect_set_discord_nickname() {
        const member = await this.channel.guild.members.fetch(process.env.CLIENT_ID);
        const name = await red.get_field(this.user_id, 'name');
        await member.setNickname(name);
    }

    _disconnect_update_discord_handlers() {
        delete channels[this.channel.id];
        guilds[this.guild_id].delete(this.channel.id);
    }

    async _disconnect_set_discord_nickname() {
        const member = await this.channel.guild.members.fetch(process.env.CLIENT_ID);
        await member.setNickname('Replika');
    }

}

class ReplikaDualInstance extends ReplikaDualBaseInstance {
    constructor(params, channel) {
        super(params);
        this.guild_id = params[0].guild_id;
        this.channel = channel;
    }

    callback_connect() {
        channels[this.channel.id] = this;
        if (guilds[this.guild_id]) {
            guilds[this.guild_id].add(this.channel.id);
        }
        else {
            guilds[this.guild_id] = new Set([this.channel.id]);
        }
        active.add(this.auth[0].user_id);
        active.add(this.auth[1].user_id);
    }

    callback_disconnect() {
        delete channels[this.channel.id];
        guilds[this.guild_id].delete(this.channel.id);
        active.delete(this.auth[0].user_id);
        active.delete(this.auth[1].user_id);
    }

    async callback_start_typing() {
        await this.channel.sendTyping();
    }

    async callback_message(message, replika_name) {
        const msg = `**${replika_name}:** ${message.payload.content.text}`;
        await this.channel.send(msg);
    }

    async callback_timeout() {
        await this.channel.send('Dialogues can\'t go on for more than 30 minutes.');
    }
}

module.exports = {
    ReplikaInstance,
    ReplikaDualInstance
}