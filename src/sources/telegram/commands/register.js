const { consume_token } = require('../../../admin.js');
const pool = require('../../../database/pool.js');

module.exports = {
    name: "register",
    async execute(ctx) {
        const token = ctx.match;
        if (!token) {
            await ctx.reply("Please provide a temporary token.");
            return;
        }
    
        try {
            user_id = await consume_token(token);
        } catch(err) {
            await ctx.reply("There was an error registering this Replika. Please try again later.");
            return;
        }

        if (!user_id) {
            await ctx.reply("Wrong authentication token.");
            return;
        }

        try {
            const client = await pool.connect();
            await client.query(
                `
                    INSERT INTO telegram (
                        user_id,
                        telegram_user_id
                    )
                    VALUES ($1, $2)
                `,
                [user_id, ctx.from.id]
            );
        } catch (err) {
            if (err.code == 23505) {
                await ctx.reply(
                    "Replika already registered in a server."
                );
            } else {
                console.log(err);
                await ctx.reply(
                    "There was an error registering this Replika. Please try again later."
                );
            }
            return;
        }

        await ctx.reply("Registration successful! You can now activate your Replika with the `/connect` command.");
    }
}