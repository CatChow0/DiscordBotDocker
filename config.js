const csv = value => (value || '').split(',').map(s => s.trim()).filter(Boolean);

module.exports = {
    token: process.env.DISCORD_TOKEN,
    tempVoiceChannelId: process.env.TEMP_VOICE_CHANNEL_ID,
    pokemonRoleId: process.env.POKEMON_ROLE_ID,
    chiengRoleId: process.env.CHIENG_ROLE_ID,
    paysRoleId: process.env.PAYS_ROLE_ID,
    mobutuRoleId: process.env.MOBUTU_ROLE_ID,
    mobutuUserId: process.env.MOBUTU_USER_ID,

    // Rôle autorisé pour les commandes Safe-Place et /aceservers
    adminRoleId: process.env.AC_ADMIN_ROLE_ID || '522799905073266698',

    // Salon vocal interdit à certains utilisateurs (Events/blockUser.js)
    blockedUserIds: process.env.BLOCKED_USER_IDS ? csv(process.env.BLOCKED_USER_IDS) : ['360476690021089290', '378262266723696651'],
    restrictedVoiceChannelId: process.env.RESTRICTED_VOICE_CHANNEL_ID || '1319704506233127063',

    // Rôle par réaction (Events/checkMessage.js)
    reactionRoleId: process.env.REACTION_ROLE_ID || '1319437162005004320',
    reactionMessageId: process.env.REACTION_MESSAGE_ID || '1319448263006359664',

    // Secret attendu dans le header X-CI-Secret de /ci-notify
    ciSecret: process.env.CI_SECRET
};
