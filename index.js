const { red_client } = require('./src/redis.js');

red_client.connect()
.then( () => {
    require('./src/sources/discord/main.js')
})
.catch(err => console.log(err))