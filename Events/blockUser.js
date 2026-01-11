const Discord = require('discord.js');

const blockedUserIds = [
    '360476690021089290', // Ajoutez les IDs des utilisateurs bloqués ici
    '378262266723696651'
];

const restrictedChannelId = '1319704506233127063'; // ID du salon vocal restreint

module.exports = async (bot, oldState, newState) => {
    if (blockedUserIds.includes(newState.member.id)) {
        if (newState.channelId === restrictedChannelId || oldState.channelId === restrictedChannelId) {
            try {
                await newState.member.voice.disconnect('Vous n\'êtes pas autorisé à rejoindre ce salon vocal.');
                console.log(`L'utilisateur ${newState.member.id} a été déconnecté du salon vocal ${restrictedChannelId}.`);
            } catch (error) {
                console.error(`Erreur lors de la déconnexion de l'utilisateur ${newState.member.id} :`, error);
            }
        }
    }
};
