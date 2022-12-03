const pool = require('../../../database/pool.js');
const escape = require("markdown-escape");

module.exports = {
    name: "list",
    async execute(ctx) {
        let client;
        try {
            client = await pool.connect()
        } catch (err) {
            await ctx.reply("There was an error connecting to the database.");
            return;
        }

        let result;
        try {
            result = await client.query(
                `
                    SELECT settings.user_id, name FROM telegram
                    INNER JOIN settings
                        ON telegram.user_id = settings.user_id 
                    WHERE telegram_user_id = $1
                `,
                [ ctx.from.id ]
            );
        } catch(err) {
            await ctx.reply("There was an error connecting to the database.");
            return;
        }
        finally {
            await client.release();
        }

        if (result.rows.length == 0){
            await ctx.reply("No Replikas registered in this server.");
            return;
        }

        let names = "";
        for (row of result.rows) {
            names += `${escape(row.name)}: \`${row.user_id}\`\n`
        }
        names = names.trim();

        await ctx.reply(names, { parse_mode: "Markdown" });
    }
}