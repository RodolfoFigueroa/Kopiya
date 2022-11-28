const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = new SlashCommandBuilder()
    .setName("register")
    .setDescription("Register a new Replika using an authentication token.")
    .addStringOption((option) =>
        option
            .setName("token")
            .setDescription("The temporary token.")
            .setRequired(true)
    )
    .setDMPermission(false);
