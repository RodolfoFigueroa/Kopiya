const { chats } = require('../handlers.js');

module.exports = {
    name: "disconnect",
    async execute(ctx) {
        const chat_id = ctx.chat.id;
        const current = chats[chat_id];
        if (!current) {
            await ctx.reply("Chat isn't in use.");
            return;
        }
        try {
            await current.disconnect();
            await ctx.reply("Replika disconnected.");
        } catch (error) {
            console.log(error);
            await ctx.reply(
                "There was an error disconnecting your Replika. Your settings may have not been saved."
            );
        }
    }
}