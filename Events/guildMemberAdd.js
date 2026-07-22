const config = require('../config');

module.exports = async (bot, member) => {
    const mobutuRoleId = config.mobutuRoleId;

    if (!mobutuRoleId) {
        console.warn('MOBUTU_ROLE_ID non configuré — auto-assign du rôle ignoré.');
        return;
    }

    const role = member.guild.roles.cache.get(mobutuRoleId);
    if (!role) {
        console.warn(`Rôle MOBUTU ${mobutuRoleId} introuvable sur ${member.guild.name}.`);
        return;
    }

    try {
        await member.roles.add(role, 'Auto-assign MOBUTU (cible /mobutu par défaut)');
        console.log(`Rôle MOBUTU ajouté à ${member.user.tag} (${member.guild.name}).`);
    } catch (err) {
        console.error(`Impossible d'auto-assigner le rôle MOBUTU à ${member.user.tag}:`, err);
    }
};