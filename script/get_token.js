const red_client = require('../src/redis/client.js');
const crypto = require('crypto');
const prompt = require('prompt');

const schema = {
    properties: {
        user_id: {
            description: 'Enter your user ID',
            type: 'string',
            required: true
        },
    }
}

async function main() {
    const { user_id } = await prompt.get(schema);
    const token = crypto.randomBytes(8).toString("hex");
    await red_client.set(`token:${token}`, user_id, {EX: 600,});
    console.log(`Your token is ${token}`);
    await red_client.quit();
}

main().catch(err => console.log(err));