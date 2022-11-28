const {
    ActionRowBuilder,
    SelectMenuBuilder,
    ComponentType,
} = require("discord.js");
const pool = require("../../database/pool.js");
const db = require("../../database/commands.js");
const dbd = require("./database/commands.js");

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
        new SelectMenuBuilder()
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
    select_replikas: select_replikas,
};
