const { chats } = require('../handlers.js');
const { ReplikaTelegram } = require('../api.js')

module.exports = {
    name: "message",
    async execute(ctx) {
        const chat_id = ctx.chat.id;
        const current = chats[chat_id];
        if (!current) { 
            return;
        }

        if (current instanceof ReplikaTelegram) {
            const message = ctx.message;
            await current.send_text(message.text);
            current.last_telegram_message.user = message;
        }
    }
}