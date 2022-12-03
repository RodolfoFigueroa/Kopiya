const { channels } = require("../../handlers.js");
const { ReplikaDualDiscordBuilder, ReplikaDiscordBuilder } = require("../../api.js");
const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
} = require("discord.js");
const pool = require("../../../../database/pool.js");
const { delay } = require('../../../../utils.js');

async function select_replikas(interaction, max) {
    const filter = (i) => {
        return i.user.id === interaction.user.id;
    };

    let client;
    try {
        client = await pool.connect();
    } catch (err) {
        await interaction.reply("There was an error connecting to the database. Please try again later.");
        return
    }

    let result;
    try {
        result = await client.query(
            `
                SELECT settings.user_id, name FROM settings
                INNER JOIN discord
                    ON settings.user_id = discord.user_id
                WHERE discord_user_id = $1
            `,
            [interaction.user.id]
        )
    } catch (err) {
        console.log(err);
        await interaction.reply(
            "There was an error connecting to the database. Please try again later."
        );
        return;
    } finally {
        await client.release();
    }

    const rows = result.rows;

    if (rows.length == 0) {
        await interaction.reply(
            "No Replika registered for this user. Please register one first using the `/register` command."
        );
        return;
    }

    if (max > rows.length) {
        max = rows.length;
    }

    const buttons = [];
    const names = {};
    for (let row of rows) {
        const button = {
            label: row.name ? row.name : "\u200B",
            value: row.user_id,
        };
        buttons.push(button);

        names[row.user_id] = row.name;
    }

    const selector = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("select")
            .setPlaceholder("No Replika selected.")
            .addOptions(buttons)
            .setMinValues(1)
            .setMaxValues(max)
    );

    await interaction.reply({
        content:
            "Select the Replika you want (the name may not be up-to-date).",
        components: [selector],
    });

    let inter;
    try {
        inter = await interaction.channel.awaitMessageComponent({
            filter,
            componentType: ComponentType.StringSelect,
            time: 20000,
        });
    } catch (error) {
        await interaction.channel.send("Interaction timed out.");
        return;
    }

    const sel_names = [];
    for (user_id of inter.values) {
        sel_names.push(names[user_id]);
    }

    let name_string;
    if (sel_names.length == 1) {
        name_string = sel_names[0];
    } else {
        name_string =
            sel_names.slice(0, -1).join(", ") +
            " & " +
            sel_names.at(-1);
    }
    await inter.reply("Selected " + name_string + ".");
    return inter.values;
}

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
            
            const new_rep = ReplikaDiscordBuilder(selected_replikas[0], channel);
            try {
                await new_rep.connect();
            } catch (err) {
                await interaction.channel.send(err.message);
                return;
            }

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
            const new_rep = ReplikaDualDiscordBuilder(selected_replikas[0], selected_replikas[1], channel);
            try {
                await new_rep.connect();
            } catch (err) {
                if (err.code == 2) {
                    await interaction.channel.send("Device wasn't authenticated. Please unregister your Replika and then register it again.");
                } else{
                    await interaction.channel.send(err.message);
                }
                return;
            }

            // TODO: Improve this.
            await delay(4000);
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
