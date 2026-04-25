const loadSlashCommands = require("../Loader/loadSlashCommands");
const safePlaceManager = require("../safePlaceManager");
const tempChannelStore = require("../tempChannelStore");

module.exports = async bot => {
    await loadSlashCommands(bot);

    for (const [, guild] of bot.guilds.cache) {
        // Recover Safe-Place state from guild channels after restart
        safePlaceManager.recoverFromGuild(guild);

        // Clean up empty temp channels left from before restart
        await tempChannelStore.cleanupEmpty(guild);

        // Check for expired time-based Safe-Places
        await safePlaceManager.checkExpiredSafePlaces(guild);
    }

    // Periodically check for expired time-based Safe-Places (every 5 minutes)
    setInterval(() => {
        for (const [, guild] of bot.guilds.cache) {
            safePlaceManager.checkExpiredSafePlaces(guild).catch(err => {
                console.error('Erreur lors de la vérification des Safe-Places expirés:', err);
            });
        }
    }, 5 * 60 * 1000);

    console.log(`${bot.user.tag} est bien en ligne !`);
};