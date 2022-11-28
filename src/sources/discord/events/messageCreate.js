const { channels } = require("../handlers.js");
const { ReplikaInstance } = require("../api.js");

module.exports = {
    name: "messageCreate",
    async execute(message) {
        const channel_id = message.channel.id;
        const current = channels[channel_id];
        if (!current) {
            return;
        }
        if (current instanceof ReplikaInstance && !message.author.bot) {
            await current.send(message);
        }
    },
};
