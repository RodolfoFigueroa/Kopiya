const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const { get_commands } = require("./utils.js");

const command_files = get_commands();

const commands = [];
for (const file of command_files) {
    const data = require(`./commands/data/${file}`);
    commands.push(data.toJSON());
}

const rest = new REST({ version: "9" }).setToken(process.env.DISCORD_TOKEN);

let is_local, route;
if (
    process.env.DISCORD_DEV_GUILD === null ||
    process.env.DISCORD_DEV_GUILD == ""
) {
    route = Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);
    is_local = false;
} else {
    route = Routes.applicationCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.DISCORD_DEV_GUILD
    );
    is_local = true;
}

if (is_local) {
    console.log(
        `Started refreshing local application commands on guild ${process.env.DISCORD_DEV_GUILD}.`
    );
} else {
    console.log(`Started refreshing global application commands.`);
}

rest.put(route, { body: commands })
    .then((res) => console.log(`Successfully reloaded application commands.`))
    .catch((err) => console.error(err));
