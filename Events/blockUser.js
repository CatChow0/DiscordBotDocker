const config = require('../config');

async function onVoiceStateUpdate(bot, oldState, newState) {
    if (!newState.member || !config.blockedUserIds.includes(newState.member.id)) return;
    if (newState.channelId !== config.restrictedVoiceChannelId) return;

    try {
        await newState.member.voice.disconnect('Vous n\'êtes pas autorisé à rejoindre ce salon vocal.');
        console.log(`L'utilisateur ${newState.member.id} a été déconnecté du salon vocal ${config.restrictedVoiceChannelId}.`);
    } catch (error) {
        console.error(`Erreur lors de la déconnexion de l'utilisateur ${newState.member.id} :`, error);
    }
}

module.exports = { events: { voiceStateUpdate: onVoiceStateUpdate } };
