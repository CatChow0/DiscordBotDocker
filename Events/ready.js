const loadSlashCommands = require("../Loader/loadSlashCommands");
const safePlaceManager = require("../safePlaceManager");
const tempChannelStore = require("../tempChannelStore");
const channelCountryStore = require("../channelCountryStore");
const nicknameStore = require("../nicknameStore");

// Restore nicknames of members who left a temp channel while the bot was offline
async function restoreNicknames(guild) {
    for (const { userId, nickname } of nicknameStore.listForGuild(guild.id)) {
        const voiceChannelId = guild.voiceStates.cache.get(userId)?.channelId;
        if (voiceChannelId && tempChannelStore.has(voiceChannelId)) continue; // still in a temp channel

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
            nicknameStore.popOriginal(guild.id, userId); // left the server
            continue;
        }
        try {
            await member.setNickname(nickname);
            nicknameStore.popOriginal(guild.id, userId);
            console.log(`Pseudo restauré au démarrage pour ${userId}: ${nickname}`);
        } catch (err) {
            console.error(`Erreur restauration pseudo au démarrage pour ${userId}:`, err);
        }
    }
}

module.exports = async bot => {
    // A failure here must not prevent the restart recovery below
    try {
        await loadSlashCommands(bot);
    } catch (err) {
        console.error('Erreur enregistrement des slash commandes:', err);
    }

    // Recover Safe-Place state from guild channels after restart
    for (const [, guild] of bot.guilds.cache) {
        safePlaceManager.recoverFromGuild(guild);
    }

    // The stores below hold channels of every guild: clean them once, across the whole client
    // (a per-guild pass would drop channels belonging to the other guilds)
    await tempChannelStore.cleanupEmpty(bot);
    channelCountryStore.cleanupMissing(bot);
    await safePlaceManager.checkExpiredSafePlaces(bot);

    // Must run after cleanupEmpty, so deleted temp channels are no longer tracked
    for (const [, guild] of bot.guilds.cache) {
        await restoreNicknames(guild);
    }

    // Periodically check for expired time-based Safe-Places (every 5 minutes)
    setInterval(() => {
        safePlaceManager.checkExpiredSafePlaces(bot).catch(err => {
            console.error('Erreur lors de la vérification des Safe-Places expirés:', err);
        });
    }, 5 * 60 * 1000);

    console.log(`${bot.user.tag} est bien en ligne !`);
};