const fs = require("fs");

function array_equals(a, b) {
    return a.length == b.length && a.every((x) => b.includes(x));
}

function get_commands() {
    const commands_exec = fs
        .readdirSync("./src/sources/discord/commands/exec")
        .filter(file => file.endsWith(".js"));
    const commands_data = fs
        .readdirSync("./src/sources/discord/commands/data")
        .filter(file => file.endsWith(".js"));

    if (!array_equals(commands_exec, commands_data)) {
        throw new Error(
            "The exec and data directories don't have the same files."
        );
    }

    return commands_exec;
}

module.exports = {
    get_commands: get_commands,
};
