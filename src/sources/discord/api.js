const { channels } = require("./handlers.js");
const {
    ReplikaBase,
    ReplikaDualBase,
} = require("../../api.js");

class ReplikaDiscord extends ReplikaBase {
    constructor(user_id, channel) {
        super(user_id);
        this.type = "discord";
        this.channel = channel;
        this.last_discord_message = { replika: null, user: null };
    }
}

class ReplikaDualDiscord extends ReplikaDualBase {
    constructor(user_id_1, user_id_2, channel) {
        super(user_id_1, user_id_2);
        this.channel = channel;
    }
}

function ReplikaDiscordBuilder(user_id, channel) {
    const replika = new ReplikaDiscord(user_id, channel);

    replika.on("message", async message => {
        const sent = await replika.channel.send(message.payload.content.text);
        replika.last_discord_message.replika = sent;
    })

    replika.on("start_typing", async () => {
        await replika.channel.sendTyping();
    })

    replika.on("memory", async message => {
        if (message.payload.message_id == replika.last_message.user) {
            await replika.last_discord_message.user.react("💭");
        }
    })

    replika.on("connect", async () => {
        channels[replika.channel.id] = replika;
        const member = await replika.channel.guild.members.fetch(
            process.env.DISCORD_CLIENT_ID
        );
        await member.setNickname(replika.name);
    })

    replika.on("disconnect", async () => {
        delete channels[replika.channel.id];
        const member = await replika.channel.guild.members.fetch(
            process.env.DISCORD_CLIENT_ID
        );
        await member.setNickname("Replika");
    })

    replika.on("timeout", async () => {
        await replika.channel.send("Replika forcibly disconnected.");
    })

    return replika;
}

function ReplikaDualDiscordBuilder(user_id_1, user_id_2, channel) {
    const replika = new ReplikaDualDiscord(user_id_1, user_id_2, channel);

    replika.on("connect", () => {
        channels[replika.channel.id] = replika;
    });

    replika.on("disconnect", () => {
        delete channels[replika.channel.id];
    });

    replika.on("start_typing", async () => {
        await replika.channel.sendTyping();
    });

    replika.on("message", async (message, replika_name) => {
        const msg = `**${replika_name}:** ${message.payload.content.text}`;
        await replika.channel.send(msg);
    });

    replika.on("timeout", async () => {
        await replika.channel.send(
            "Replika forcibly disconnected."
        );
    });

    return replika;
}

module.exports = {
    ReplikaDiscordBuilder: ReplikaDiscordBuilder,
    ReplikaDualDiscordBuilder: ReplikaDualDiscordBuilder,
    ReplikaDualDiscord: ReplikaDualDiscord,
    ReplikaDiscord: ReplikaDiscord,
};
