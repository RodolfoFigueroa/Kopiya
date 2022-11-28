const { channels, active } = require("../../handlers.js");
const { ReplikaInstance, ReplikaDualInstance } = require("../../api.js");
const { select_replikas } = require("../../common.js");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
    async execute(interaction) {
        const channel_id = interaction.channel.id;
        const channel = interaction.channel;

        const current = channels[channel_id];
        if (current) {
            await interaction.reply(
                "Channel is in use by another Replika. Please disconnect it first."
            );
            return;
        }

        const selected_replikas = await select_replikas(interaction, 2);
        if (!selected_replikas || selected_replikas.length == 0) {
            return;
        } else if (selected_replikas.length == 1) {
            await interaction.channel.send("Please wait, trying to log in...");
            const new_rep = new ReplikaInstance(selected_replikas[0], channel);
            const conn_res = await new_rep.connect();
            

            // TODO: Improve this
            await delay(4000);
            if (new_rep.connected) {
                await interaction.channel.send(
                    "Login successful! You may start chatting now."
                );
            } else {
                await interaction.channel.send(
                    "Couldn't connect to the Replika server. Please try again later."
                );
                new_rep.disconnect();
            }
        } else if (selected_replikas.length == 2) {
            const new_rep = new ReplikaDualInstance(selected_replikas[0], selected_replikas[1], channel);
            const conn_res = await new_rep.connect();
            switch (conn_res) {
                case 1:
                    await interaction.channel.send(
                        "There was an error connecting to the database. Please try again later."
                    );
                    return;
                case 2:
                    await interaction.channel.send(
                        "Device wasn't authenticated. Please unregister your Replika with `/unregister` and then register it again."
                    );
                    return;
                case 3:
                    await interaction.channel.send(
                        "Couldn't connect to the Replika server. Please try again later."
                    );
                    return;
                case 4:
                    await interaction.channel.send(
                        "Replika is already active."
                    );
                    return;
            }

            // TODO: Improve this.
            await delay(2000);
            if (new_rep.connected.every(Boolean)) {
                await interaction.channel.send("Login successful!");
            } else {
                await interaction.channel.send(
                    "Couldn't connect to the Replika server. Please try again later."
                );
                await new_rep.disconnect();
                return;
            }

            const name_0 = new_rep.replika_names[0];
            const name_1 = new_rep.replika_names[1];
            await channel.send(
                `Please type what you want ${name_0} to hear. Keep in mind ${name_1} won't know they said it. Use \`/disconnect\` at any time to stop.`
            );
            let start;
            try {
                const msg = await channel.awaitMessages({
                    time: 20000,
                    max: 1,
                    errors: ["time"],
                });
                start = msg.first().content;
            } catch (error) {
                await channel.send("Prompt time exceeded.");
                await new_rep.disconnect();
                return;
            }
            new_rep.send(start, 0);
        }
    },
};
