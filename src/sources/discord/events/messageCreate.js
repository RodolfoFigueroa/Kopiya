const { channels } = require("../handlers.js");
const { ReplikaDiscord } = require("../api.js");

module.exports = {
    name: "messageCreate",
    async execute(message) {
        const channel_id = message.channel.id;
        const current = channels[channel_id];
        if (!current) {
            return;
        }
        if (current instanceof ReplikaDiscord && !message.author.bot) {
            if (message.attachments.size == 0) {
                await current.send_text(message.content);
            } else {
                const url = message.attachments.first().url;
                await current.send_image(url);
            }
            current.last_discord_message.user = message;
        }
    },
};
