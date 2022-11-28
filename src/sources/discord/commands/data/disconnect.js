const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = new SlashCommandBuilder()
    .setName("disconnect")
    .setDescription("Deactivate the Replika in the current channel.")
    .setDMPermission(false);
