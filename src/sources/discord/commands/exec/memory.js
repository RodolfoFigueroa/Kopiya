const { EmbedBuilder } = require("discord.js");
const { channels } = require("../../handlers.js");
const { ReplikaDiscord } = require("../../api.js");
const replika = require("@kopiya/kopiya-common");

module.exports = {
    async execute(interaction) {
        const current = channels[interaction.channel.id];
        if (!current) {
            await interaction.reply("Channel isn't in use");
            return;
        }
        if (!(current instanceof ReplikaDiscord)) {
            await interaction.reply("Command not available in dialogue mode.");
            return;
        }

        const memory = await replika.get_data(
            current.gen_auth_headers(),
            "memory"
        );
        const facts = memory.facts
            .slice(0, 5)
            .map((x) => x.text)
            .join("\n");
        const people = memory.persons
            .slice(0, 5)
            .map((x) => x.name + " (" + x.relation + ")")
            .join("\n");
        const title =
            current.name +
            (current.name.endsWith("s") ? "'" : "'s") +
            " memory";

        let fields;
        if (!facts) {
            fields = { name: "People in your life", value: people };
        } else if (!people) {
            fields = { name: "Facts about you", value: facts };
        } else {
            fields = [
                { name: "Facts about you", value: facts },
                { name: "People in your life", value: people },
            ];
        }
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor("#0099ff")
            .setTitle(title)
            .addFields(fields)
            .setTimestamp();
        interaction.reply({ embeds: [embed] });
    },
};
