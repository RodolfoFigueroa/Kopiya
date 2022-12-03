const { Bot } = require("grammy");
const { ignoreOld } = require("grammy-middlewares");
const fs = require("fs");

const bot = new Bot(process.env.TELEGRAM_TOKEN);

bot.use(ignoreOld(5));

bot.catch(err => {
    console.log(err);
})

module.exports = bot; // Do NOT move the line

const command_files = fs
.readdirSync("./src/sources/telegram/commands")
.filter(file => file.endsWith(".js"));

for (let file of command_files) {
    const command = require(`./commands/${file}`);
    bot.command(command.name, (...args) => command.execute(...args));
}

const event_files = fs
    .readdirSync("./src/sources/telegram/events")
    .filter(file => file.endsWith(".js"));

for (let file of event_files) {
    const event = require(`./events/${file}`);
    bot.on(event.name, (...args) => event.execute(...args));
}