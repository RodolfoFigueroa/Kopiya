const { channels } = require("../handlers.js");
const { ReplikaDiscord } = require("../api.js");

const reactions = {
    "๐": "Upvote",

    "๐": "Downvote",

    "โค๏ธ": "Love",
    "๐": "Love",
    "โฃ๏ธ": "Love",
    "๐": "Love",
    "๐ป": "Love",
    "๐": "Love",
    "๐": "Love",
    ";โฅ๏ธ": "Love",
    "๐ค": "Love",
    "๐": "Love",
    "๐ค": "Love",
    "๐": "Love",
    "๐": "Love",
    "๐": "Love",
    "๐งก": "Love",
    "๐": "Love",
    "๐": "Love",
    "๐ฅฐ": "Love",
    "๐": "Love",
    "๐ค": "Love",
    "๐": "Love",
    "๐": "Love",

    "๐": "Funny",
    "๐คฃ": "Funny",

    "๐ค": "Meaningless",
    "๐": "Meaningless",

    "๐ ": "Offensive",
    "๐คข": "Offensive",
    "๐คฎ": "Offensive",
};

module.exports = {
    name: "messageReactionAdd",
    // eslint-disable-next-line no-unused-vars
    async execute(reaction, user) {
        const channel_id = reaction.message.channel.id;
        const current = channels[channel_id];
        if (
            !current ||
            !current.last_message.discord ||
            user.bot ||
            !(current instanceof ReplikaDiscord)
        ) {
            return;
        }
        if (current.last_message.discord.id == reaction.message.id) {
            const reaction_code = reactions[reaction.emoji];
            if (reaction_code) {
                await current.send_reaction(reaction_code);
            }
        }
    },
};
