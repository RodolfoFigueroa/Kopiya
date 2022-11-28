const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Stats for the current Replika.")
    .setDMPermission(false);
