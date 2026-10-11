const fs = require("fs");

// Un fichier d'événement exporte soit une fonction (le nom du fichier est le nom de l'événement),
// soit un objet { events: { nomEvenement: handler, ... } }.
module.exports = bot => {
    fs.readdirSync("./Events").filter(f => f.endsWith(".js")).forEach(file => {
        const event = require(`../Events/${file}`);
        const handlers = typeof event === 'function'
            ? { [file.slice(0, -3)]: event }
            : event.events;
        for (const [eventName, handler] of Object.entries(handlers)) {
            bot.on(eventName, handler.bind(null, bot));
        }
        console.log(`Evenement ${file} chargé avec succès !`);
    });
};
