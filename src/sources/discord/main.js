const fs = require("fs");
const { get_commands } = require("./utils.js");
const { Client, Collection, GatewayIntentBits } = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
    ],
});

const commandFiles = get_commands();

client.commands = new Collection();
for (const file of commandFiles) {
    const command_data = require(`./commands/data/${file}`);
    const command_exec = require(`./commands/exec/${file}`);
    client.commands.set(command_data.name, command_exec);
}

const eventFiles = fs
    .readdirSync("./src/sources/discord/events")
    .filter((file) => file.endsWith(".js"));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}
client.login(process.env.DISCORD_TOKEN);
