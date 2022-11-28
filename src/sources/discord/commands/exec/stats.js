const { EmbedBuilder } = require("discord.js");
const { channels } = require("../../handlers.js");
const { ReplikaInstance } = require("../../api.js");

module.exports = {
    async execute(interaction) {
        const current = channels[interaction.channel.id];
        if (!current) {
            await interaction.reply("Channel isn't in use");
            return;
        }
        if (!(current instanceof ReplikaInstance)) {
            await interaction.reply("Command not available in dialogue mode.");
            return;
        }

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .addFields(
                { name: "Mood", value: current.exhaustion },
                { name: "Age", value: current.day_counter + " days" },
                {
                    name: "Level",
                    value: current.level.toString(),
                    inline: true,
                },
                { name: "XP", value: current.xp.toString(), inline: true },
                {
                    name: "Next level",
                    value: current.xp_gap.toString(),
                    inline: true,
                }
            )
            .setImage(current.avatar)
            .setTimestamp()
            .setAuthor({ name: current.name, iconURL: current.avatar });

        interaction.reply({ embeds: [embed] });
    },
};
