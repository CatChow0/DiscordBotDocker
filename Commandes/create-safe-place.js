const { ChannelType, PermissionFlagsBits } = require('discord.js');
const safePlaceManager = require('../safePlaceManager');

module.exports = {
    name: 'create-safe-place',
    description: 'Créer un salon temporaire sécurisé',
    permission: PermissionFlagsBits.ManageChannels,
    dm: false,
    category: 'Modération',
    options: [
        {
            name: 'type',
            description: 'Type de salon à créer',
            type: 'String',
            required: true,
            choices: [
                { name: 'Salon Vocal', value: 'voice' },
                { name: 'Salon Textuel', value: 'text' }
            ]
        },
        {
            name: 'access',
            description: 'Qui peut voir ce salon (mention @role ou @user)',
            type: 'String',
            required: true
        },
        {
            name: 'autodestruction',
            description: 'Mode de destruction automatique',
            type: 'String',
            required: true,
            choices: [
                { name: 'Après vidage du salon (vocal uniquement)', value: 'empty' },
                { name: 'Temps limité (1-24h)', value: 'time' },
                { name: 'Commande manuelle /close (text uniquement)', value: 'manual' }
            ]
        },
        {
            name: 'duree',
            description: 'Durée en heures pour la destruction automatique (1-24h)',
            type: 'Integer',
            required: false,
            minValue: 1,
            maxValue: 24
        },
        {
            name: 'nom',
            description: 'Nom personnalisé pour le salon (optionnel)',
            type: 'String',
            required: false
        }
    ],

    async run(bot, interaction, args) {
        try {
            // Vérifier si l'utilisateur a le rôle requis
            const requiredRoleId = "522799905073266698";
            if (!interaction.member.roles.cache.has(requiredRoleId)) {
                return await interaction.reply({
                    content: '❌ Vous n\'avez pas les permissions nécessaires pour utiliser cette commande.',
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            const type = interaction.options.getString('type');
            const accessString = interaction.options.getString('access');
            const autodestruction = interaction.options.getString('autodestruction');
            const duree = interaction.options.getInteger('duree');
            const nomPersonnalise = interaction.options.getString('nom');

            // Vérifications de cohérence
            if (autodestruction === 'empty' && type !== 'voice') {
                return await interaction.editReply({
                    content: '❌ La destruction "après vidage" n\'est disponible que pour les salons vocaux.'
                });
            }

            if (autodestruction === 'manual' && type !== 'text') {
                return await interaction.editReply({
                    content: '❌ La destruction "commande manuelle" n\'est disponible que pour les salons textuels.'
                });
            }

            if (autodestruction === 'time' && !duree) {
                return await interaction.editReply({
                    content: '❌ Vous devez spécifier une durée en heures pour la destruction temporisée.'
                });
            }

            // Parser les accès (rôles et utilisateurs)
            const allowedRoles = [];
            const allowedUsers = [];
            
            const mentions = accessString.match(/<[@&]!?(\d+)>/g);
            if (!mentions) {
                return await interaction.editReply({
                    content: '❌ Format invalide. Utilisez @role ou @user pour spécifier les accès.'
                });
            }

            for (const mention of mentions) {
                const id = mention.match(/\d+/)[0];
                if (mention.startsWith('<@&')) {
                    // C'est un rôle
                    const role = interaction.guild.roles.cache.get(id);
                    if (role) {
                        allowedRoles.push(role);
                    }
                } else if (mention.startsWith('<@')) {
                    // C'est un utilisateur
                    try {
                        const user = await interaction.guild.members.fetch(id);
                        if (user) {
                            allowedUsers.push(user);
                        }
                    } catch (error) {
                        console.log(`Utilisateur ${id} non trouvé`);
                    }
                }
            }

            if (allowedRoles.length === 0 && allowedUsers.length === 0) {
                return await interaction.editReply({
                    content: '❌ Aucun rôle ou utilisateur valide trouvé.'
                });
            }

            // Créer le nom du salon
            const channelName = nomPersonnalise || `${type === 'voice' ? '🔒' : '📝'}-safe-place-${interaction.user.username}`;

            // Configurer les permissions
            const permissionOverwrites = [
                {
                    id: interaction.guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: interaction.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.Connect,
                        PermissionFlagsBits.Speak,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                }
            ];

            // Ajouter les permissions pour les rôles autorisés
            for (const role of allowedRoles) {
                permissionOverwrites.push({
                    id: role.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.Connect,
                        PermissionFlagsBits.Speak,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                });
            }

            // Ajouter les permissions pour les utilisateurs autorisés
            for (const user of allowedUsers) {
                permissionOverwrites.push({
                    id: user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.Connect,
                        PermissionFlagsBits.Speak,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                });
            }

            // Créer le salon
            const channelTypeEnum = type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
            const channel = await interaction.guild.channels.create({
                name: channelName,
                type: channelTypeEnum,
                parent: interaction.channel.parent,
                permissionOverwrites: permissionOverwrites
            });

            // Programmer la destruction automatique
            let destructionInfo = '';
            if (autodestruction === 'time') {
                const destructionTime = Date.now() + (duree * 60 * 60 * 1000);

                // Enregistrer dans le gestionnaire Safe-Place (persisté sur disque)
                safePlaceManager.addSafePlace(channel.id, interaction.user.id, 'time', type, destructionTime);

                // Pour les salons textuels, utiliser aussi le topic
                if (type === 'text') {
                    await channel.setTopic(`SAFE_PLACE|${interaction.user.id}|time|${destructionTime}|${type}`);
                }

                // Schedule deletion; safePlaceManager persistence ensures this survives restarts
                // via checkExpiredSafePlaces() called periodically
                setTimeout(async () => {
                    try {
                        const channelToDelete = interaction.guild.channels.cache.get(channel.id);
                        if (channelToDelete) {
                            await channelToDelete.delete();
                            console.log(`Salon temporaire ${channelName} supprimé automatiquement après ${duree}h`);
                        }
                        safePlaceManager.removeSafePlace(channel.id);
                    } catch (error) {
                        console.error('Erreur lors de la suppression automatique:', error);
                        safePlaceManager.removeSafePlace(channel.id);
                    }
                }, duree * 60 * 60 * 1000);

                destructionInfo = `⏰ Le salon sera supprimé automatiquement dans ${duree} heure(s).`;
            } else if (autodestruction === 'empty') {
                // Enregistrer dans le gestionnaire Safe-Place (persisté sur disque)
                safePlaceManager.addSafePlace(channel.id, interaction.user.id, 'empty', type);
                destructionInfo = '🔄 Le salon sera supprimé quand il sera vide (après avoir eu au moins une personne).';
            } else if (autodestruction === 'manual') {
                // Enregistrer dans le gestionnaire Safe-Place (persisté sur disque)
                safePlaceManager.addSafePlace(channel.id, interaction.user.id, 'manual', type);

                // Pour les salons textuels, utiliser aussi le topic
                if (type === 'text') {
                    await channel.setTopic(`SAFE_PLACE|${interaction.user.id}|manual|0|text`);
                }
                destructionInfo = '🛠️ Utilisez `/close` dans le salon pour le supprimer.';
            }

            // Message de confirmation
            const accessList = [
                ...allowedRoles.map(role => `@${role.name}`),
                ...allowedUsers.map(user => `@${user.displayName}`)
            ].join(', ');

            await interaction.editReply({
                content: `✅ **Salon sécurisé créé avec succès !**\n\n` +
                        `📍 **Salon :** ${channel}\n` +
                        `🔒 **Accès autorisé à :** ${accessList}\n` +
                        `${destructionInfo}\n\n` +
                        `Le salon est maintenant disponible et seules les personnes autorisées peuvent le voir.`
            });

            // Message dans le salon créé
            if (type === 'text') {
                try {
                    await channel.send({
                        content: `🎉 **Bienvenue dans votre salon sécurisé !**\n\n` +
                                `Créé par : ${interaction.user}\n` +
                                `${destructionInfo}\n\n` +
                                `Ce salon est privé et seules les personnes autorisées peuvent y accéder.`
                    });
                } catch (error) {
                    console.error('Erreur lors de l\'envoi du message de bienvenue:', error);
                }
            }

        } catch (error) {
            console.error('Erreur lors de la création du salon sécurisé:', error);
            
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ Une erreur est survenue lors de la création du salon. Veuillez réessayer.'
                });
            } else {
                await interaction.reply({
                    content: '❌ Une erreur est survenue lors de la création du salon. Veuillez réessayer.',
                    ephemeral: true
                });
            }
        }
    }
};
