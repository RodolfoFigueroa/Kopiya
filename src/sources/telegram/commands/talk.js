const { ReplikaDualTelegramBuilder } = require("../api.js");
const { delay } = require("../../../utils.js");

module.exports = {
    name: "talk",
    async execute(ctx) {
        const query = ctx.match;
        if (!query) {
            return;
        }

        const query_split = query.trim().split(" ");
        if (query_split.length < 3) {
            await ctx.reply("Query not properly formed.");
            return;
        }

        const user_id_1 = query_split[0];
        const user_id_2 = query_split[1];
        const start = query_split.slice(2).join(" ");

        const new_rep = ReplikaDualTelegramBuilder(user_id_1, user_id_2, ctx.chat);
        try {
            await new_rep.connect();
        } catch(err) {
            await ctx.reply(err.message);
            return
        }

        await delay(4000);
        if (new_rep.connected.every(Boolean)) {
            await ctx.reply("Login successful!");
        } else {
            await ctx.reply(
                "Couldn't connect to the Replika server. Please try again later."
            );
            await new_rep.disconnect();
            return;
        }

        new_rep.send(start, 0);
    }
}