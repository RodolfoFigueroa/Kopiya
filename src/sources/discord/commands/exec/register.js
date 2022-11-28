const pool = require("../../../../database/pool.js");
const { consume_token } = require('../../../../admin.js');

module.exports = {
    async execute(interaction) {
        const token = interaction.options.getString("token");

        let user_id;
        try {
            user_id = await consume_token(token);
        } catch (err) {
            console.log(err);
            await interaction.reply(
                "There was an error registering this Replika. Please try again later."
            );
            return;
        }

        if (!user_id) {
            await interaction.reply("Wrong authentication token.");
            return;
        }

        try {
            const client = await pool.connect();
            await client.query(
                `
                    INSERT INTO discord (
                        user_id,
                        discord_user_id
                    )
                    VALUES ($1, $2)
                `,
                [user_id, interaction.user.id]
            );
        } catch (err) {
            if (err.code == 23505) {
                await interaction.reply(
                    "Replika already registered in a server."
                );
            } else {
                console.log(err);
                await interaction.reply(
                    "There was an error registering this Replika. Please try again later."
                );
            }
            return;
        }

        await interaction.reply(
            "Registration successful! You can now activate your Replika with the `/connect` command."
        );
    },
};
