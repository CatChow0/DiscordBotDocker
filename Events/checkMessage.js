const config = require('../config');

const TOGGLE_EMOJI = '✅'; // Emoji utilisé pour basculer le rôle

async function resolve(reaction, user) {
    // Les réactions sur des messages anciens arrivent en "partial"
    if (reaction.partial) await reaction.fetch();
    if (user.bot) return null;
    if (reaction.message.id !== config.reactionMessageId || reaction.emoji.name !== TOGGLE_EMOJI) return null;

    const guild = reaction.message.guild;
    if (!guild) return null;
    const member = await guild.members.fetch(user.id).catch(() => null);
    const role = guild.roles.cache.get(config.reactionRoleId);
    return member && role ? { member, role } : null;
}

async function onAdd(bot, reaction, user) {
    try {
        const target = await resolve(reaction, user);
        if (target && !target.member.roles.cache.has(target.role.id)) {
            await target.member.roles.add(target.role);
            console.log(`Role ${target.role.id} added to user ${user.id}`);
        }
    } catch (err) {
        console.error('Erreur rôle par réaction (ajout):', err);
    }
}

async function onRemove(bot, reaction, user) {
    try {
        const target = await resolve(reaction, user);
        if (target && target.member.roles.cache.has(target.role.id)) {
            await target.member.roles.remove(target.role);
            console.log(`Role ${target.role.id} removed from user ${user.id}`);
        }
    } catch (err) {
        console.error('Erreur rôle par réaction (retrait):', err);
    }
}

module.exports = { events: { messageReactionAdd: onAdd, messageReactionRemove: onRemove } };
