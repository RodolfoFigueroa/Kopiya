const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = new SlashCommandBuilder()
    .setName("connect")
    .setDescription("Activate one or two Replikas in the current channel.")
    .setDMPermission(false);
