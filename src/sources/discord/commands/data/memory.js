const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = new SlashCommandBuilder()
    .setName("memory")
    .setDescription("Memory of the current Replika.")
    .setDMPermission(false);
