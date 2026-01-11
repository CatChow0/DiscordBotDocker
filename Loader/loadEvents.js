const fs = require("fs");

module.exports = async bot => {
    fs.readdirSync("./Events").filter(f => f.endsWith(".js")).forEach(async file => {
        let event = require(`../Events/${file}`);
        let eventName = file.split(".js")[0];
        if (eventName === 'messageReactionHandler') {
            bot.on('messageReactionAdd', event.bind(null, bot));
            bot.on('messageReactionRemove', event.bind(null, bot));
        } else {
            bot.on(eventName, event.bind(null, bot));
        }
        console.log(`Evenement ${file} chargé avec succès !`);
    });
};