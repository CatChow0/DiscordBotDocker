const { Events } = require('discord.js');

const ROLE_ID = '1319437162005004320';
const MESSAGE_ID = '1319448263006359664'; // Remplacez par l'ID de votre message
const TOGGLE_EMOJI = '✅'; // Emoji utilisé pour basculer le rôle

module.exports = async (bot, reaction, user) => {
    if (reaction.message.id === MESSAGE_ID && reaction.emoji.name === TOGGLE_EMOJI) {
        const guild = reaction.message.guild;
        const member = guild.members.cache.get(user.id);
        const role = guild.roles.cache.get(ROLE_ID);

        if (member && role) {
            if (reaction.message.reactions.cache.get(TOGGLE_EMOJI).users.cache.has(user.id)) {
                if (!member.roles.cache.has(ROLE_ID)) {
                    await member.roles.add(role);
                    console.log(`Role ${ROLE_ID} added to user ${user.id}`);
                }
            } else {
                if (member.roles.cache.has(ROLE_ID)) {
                    await member.roles.remove(role);
                    console.log(`Role ${ROLE_ID} removed from user ${user.id}`);
                }
            }
        }
    }
};