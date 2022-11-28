const pool = require("../../../database/pool.js");

async function list_guild_replikas(guild_id) {
    const client = await pool.connect();
    try {
        return await client.query(
            `
                SELECT * FROM discord 
                INNER JOIN settings
                    ON settings.user_id = discord.user_id
                WHERE guild_id = $1;
            `,
            [guild_id]
        );
    } catch (error) {
        console.log(error);
        return;
    } finally {
        await client.release();
    }
}

module.exports = {
    list_guild_replikas: list_guild_replikas,
};
