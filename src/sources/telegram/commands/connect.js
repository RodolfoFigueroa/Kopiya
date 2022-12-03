const { ReplikaTelegramBuilder } = require("../api.js");
const { delay } = require('../../../utils.js');
const bot = require("../bot.js");

module.exports = {
    name: "connect",
    async execute(ctx) {
        const user_id = ctx.match;
        if (!user_id) {
            await ctx.reply("No user ID provided. If you don't know your Replika's user ID, you can view all of the Replikas registered to your account with the /list command.");
            return;
        }

        const new_rep = ReplikaTelegramBuilder(user_id, ctx.chat, bot);
        try {
            await new_rep.connect();
        } catch (err) {
            await ctx.reply(err.message);
            return;
        }

        await delay(4000);
            if (new_rep.connected) {
                await ctx.reply(
                    "Login successful! You may start chatting now."
                );
            } else {
                await ctx.reply(
                    "Couldn't connect to the Replika server. Please try again later."
                );
                new_rep.disconnect();
            }
    }
}