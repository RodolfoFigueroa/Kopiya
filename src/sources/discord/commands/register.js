const { SlashCommandBuilder } = require('@discordjs/builders');
const { registering, active, channels } = require('../handlers.js');

const db = require('../../../database/commands.js');
const dbd = require('../database.js');

const { MessageActionRow, MessageButton } = require('discord.js');
const replika = require('../../../replika.js');

/**
 * 
 * @param {*} dm_channel 
 * @returns 
 *      - 0: Normal return
 *      - 1: Canceled
 *      - 2: Timeout
 *      - 3: Wrong credentials
 */
async function _login_username_password(dm_channel) {
    let username, password;

    await dm_channel.send('Please enter your Replika e-mail.');
    try {
        const msg = await dm_channel.awaitMessages({ time: 20000, max: 1, errors: ['time'] });
        username = msg.first().content;
        if (username == 'cancel') {
            await dm_channel.send('Registration canceled.');
            return [1, null];
        }
    }
    catch (error) {
        console.log(error);
        await dm_channel.send('Registration time exceeded.');
        return [2, null];
    }

    await dm_channel.send('Please enter your Replika password.');
    try {
        const msg = await dm_channel.awaitMessages({ time: 20000, max: 1, errors: ['time'] });
        password = msg.first().content;
        if (password == 'cancel') {
            await dm_channel.send('Registration canceled.');
            return [1, null];
        }
    }
    catch (error) {
        await dm_channel.send('Registration time exceeded.');
        return [2, null];
    }

    await dm_channel.send('Trying to log in...');
    try {
        auth_tokens = await replika.login(username, password);
        await dm_channel.send('Login succesful!');
        return [0, auth_tokens];
    }
    catch (error) {
        await dm_channel.send('Wrong username or password. Please try again.');
        return [3, null];
    }
}

/**
 *
 * @param {*} dm_channel 
 * @returns 
 *      - 0: Normal return
 *      - 1: Canceled
 *      - 2: Timeout
 *      - 3: Wrong credentials 
 */
async function _login_tokens(dm_channel) {
    await dm_channel.send('Please enter your user ID.');
    try {
        const msg = await dm_channel.awaitMessages({ time: 30000, max: 1, errors: ['time'] });
        const res = msg.first().content;
        if (res == 'cancel') {
            await dm_channel.send('Registration canceled.');
            return [1, null];
        }
        else {
            auth_tokens['x-user-id'] = res;
        }
    }
    catch (error) {
        console.log(error);
        await dm_channel.send('Registration time exceeded.');
        return [2, null];
    }

    await dm_channel.send('Please enter your auth token.');
    try {
        const msg = await dm_channel.awaitMessages({ time: 30000, max: 1, errors: ['time'] });
        const res = msg.first().content;
        if (res == 'cancel') {
            await dm_channel.send('Registration canceled.');
            return [1, null];
        }
        else {
            auth_tokens['x-auth-token'] = res;
        }
    }
    catch (error) {
        console.log(error);
        await dm_channel.send('Registration time exceeded.');
        return [2, null];
    }

    await dm_channel.send('Please enter your device ID.');
    try {
        const msg = await dm_channel.awaitMessages({ time: 30000, max: 1, errors: ['time'] });
        const res = msg.first().content;
        if (res == 'cancel') {
            await dm_channel.send('Registration canceled.');
            return [1, null];
        }
        else {
            auth_tokens['x-device-id'] = res;
        }
    }
    catch (error) {
        console.log(error);
        await dm_channel.send('Registration time exceeded.');
        return [2, null];
    }

    auth_tokens['x-timestamp-hash'] = replika.gen_timestamp_hash(auth_tokens['x-device-id']);
    await dm_channel.send('Verifying tokens...');
    try {
        await replika.get_data(auth_tokens, 'profile');
        await dm_channel.send('Tokens are correct!');
        return [0, auth_tokens];
    }
    catch (error) {
        await dm_channel.send('Wrong tokens, please try again.');
        return [3, null];
    }
}

async function _register_replika(params) {
    const res1 = await db.insert_replika(params);
    const res2 = await dbd.create_replika(params.user_id, params.guild_id);
    console.log(res1);
    console.log(res2);
    if (res1 == 0 && res2 == 0) {
        return 0;
    }
    else {
        return 1;
    }
}

/**
 * 
 * @param {*} interaction 
 * @returns 
 *      - 0: Normal return
 *      - 1: Canceled
 *      - 2: Timeout
 *      - 3: Error
 */
async function prompt_login(interaction) {
    const guild_id = interaction.guild.id;

    await interaction.reply('Please check your DMs.');
    const dm_channel = await interaction.user.createDM();
    const row = new MessageActionRow().addComponents (
        new MessageButton()
            .setCustomId('password')
            .setLabel('Username and password')
            .setStyle('PRIMARY'),
        new MessageButton()
            .setCustomId('tokens')
            .setLabel('Authentication tokens')
            .setStyle('PRIMARY'),
        new MessageButton()
            .setCustomId('cancel')
            .setLabel('Cancel registration')
            .setStyle('DANGER'),
    );
    await dm_channel.send({ content: 'Please select your login method.', components: [row] });

    let inter;
    try {
        inter = await dm_channel.awaitMessageComponent({ ComponentType: 'BUTTON', time: 20000 });
    }
    catch (error) {
        await dm_channel.send('Interaction timed out.');
        return 2;
    }

    let auth_tokens = {};
    if (inter.customId == 'password') {
        await inter.reply('Starting registration by username and password. Type "cancel" at any point to exit.');
        [ res, auth_tokens ] = await _login_username_password(dm_channel);
        if (res > 0) {
            return res;
        }
    }
    else if (inter.customId == 'tokens') {
        await inter.reply('Starting registration by auth tokens. Type "cancel" at point to exit.');
        [ res, auth_tokens ] = await _login_tokens(dm_channel);
        if (res > 0) {
            return res;
        }
    }

    else {
        await inter.reply('Registration canceled');
        return 1;
    }

    /* Building data dictionaries */
    const user_id = auth_tokens['x-user-id'];
    const params = {
        ...auth_tokens,
    };

    let res, profile_data;
    try {
        // Required to register the device server-side
        await replika.get_data(auth_tokens, 'profile');
        res = await replika.get_data(auth_tokens, 'chat');
        profile_data = await replika.get_data(auth_tokens, 'profile');
    }
    catch (error) {
        console.log(error);
        await dm_channel.send('Couldn\'t connect to Replika server. Please try again later.');
        return 3;
    }

    params.chat_id = res.id;
    params.bot_id = res.bot_id.id;

    params.name = profile_data.name;
    params.avatar = profile_data.avatar_v2.preview;

    params.user_id = user_id;
    params.guild_id = guild_id;

    /* Registering Replika */
    const regis = await dbd.is_registered(user_id, guild_id);
    switch (regis) {
        case 0:
            const res_register = await _register_replika(params);
            if (res_register == 0) {
                await dm_channel.send('Registration successful! You can go back to the server.');
                return 0;
            }
            else {
                await dm_channel.send('There was an error registering your Replika. Please try again.');
                return 3;
            }
        case 1:
            await dm_channel.send('Replika already registered in this server, no need to register it again.');
            return 0;
        case 2:
            const qrow = new MessageActionRow().addComponents (
                new MessageButton()
                    .setCustomId('yes')
                    .setLabel('Yes')
                    .setStyle('PRIMARY'),
                new MessageButton()
                    .setCustomId('no')
                    .setLabel('No')
                    .setStyle('DANGER'),
            );
            await dm_channel.send({
                content: 'Replika already registered in another server. Would you like to remove it from there and add it here?.',
                components: [qrow],
            });
    
            let qinter;
            try {
                qinter = await dm_channel.awaitMessageComponent({ ComponentType: 'BUTTON', time: 20000 });
            }
            catch (error) {
                await dm_channel.send('Interaction timed out.');
                return 2;
            }
            if (qinter.customId == 'yes') {
                await qinter.reply('Trying to unregister Replika.');
                if (active.has(user_id)) {
                    await dm_channel.send('Replika is active in another server. Disconnect it first.');
                    return 3;
                }
                let res_delete = await db.delete_replika(user_id);
                if (res_delete == 0) {
                    await dm_channel.send('Replika unregistered successfully. Trying to register in this server.');
                }
                else {
                    await dm_channel.send('There was an error deleting this Replika. Please try again later.');
                    return 3;
                }
                const res_register = await _register_replika(params);
                if (res_register == 0) {
                    await dm_channel.send('Registration successful! You can go back to the server.');
                    return 0;
                }
                else {
                    await dm_channel.send('There was an error registering your Replika. Please try again.');
                    return 3;
                }
            }
            else {
                await qinter.reply('Registration canceled.');
                return 1;
            }
        case 3:
            await dm_channel.send('There was an error registering your Replika. Please try again.');
            return 3;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('Register a new Replika.'),

    async execute(interaction) {
        const guild_id = interaction.guild.id;
        const channel_id = interaction.channel.id;

        if (registering.has(guild_id)) {
            await interaction.reply('Registration already in progress for this server.');
            return;
        }
        if (channels[channel_id]) {
            await interaction.reply('Channel is in use by another Replika. Please disconnect it first.');
            return;
        }
        registering.add(guild_id);

        const res = await prompt_login(interaction);

        switch (res) {
            case 0:
                await interaction.editReply('Registration successful! You can now activate your Replika with the `/connect` command.');
                break;
            case 1:
                await interaction.editReply('Registration canceled.');
                break;
            case 2:
                await interaction.editReply('Registration time exceeded.');
                break;
            case 3:
                await interaction.editReply('Registration failed.');
                break;
        }
        registering.delete(guild_id);
    },
};
