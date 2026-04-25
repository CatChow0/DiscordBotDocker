const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const safePlaceManager = require('../safePlaceManager');

module.exports = {
    name: 'list-safe-places',
    description: 'Lister tous vos salons sécurisés actifs',
    permission: PermissionFlagsBits.ManageChannels,
    dm: false,
    category: 'Modération',

    async run(bot, interaction, args) {
        try {
            const requiredRoleId = "522799905073266698";
            if (!interaction.member.roles.cache.has(requiredRoleId)) {
                return await interaction.reply({
                    content: '❌ Vous n\'avez pas les permissions nécessaires pour utiliser cette commande.',
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            // Combine results from safePlaceManager (in-memory/persisted) and topic-based discovery
            const userSafePlaces = new Map();

            // 1. From safePlaceManager (covers voice channels that don't have topics)
            const managerPlaces = safePlaceManager.getSafePlacesByCreator(interaction.user.id);
            for (const sp of managerPlaces) {
                const channel = interaction.guild.channels.cache.get(sp.channelId);
                if (channel) {
                    userSafePlaces.set(sp.channelId, {
                        channel,
                        mode: sp.mode,
                        type: sp.type,
                        destructionTime: sp.destructionTime
                    });
                } else {
                    // Channel no longer exists, clean up
                    safePlaceManager.removeSafePlace(sp.channelId);
                }
            }

            // 2. From channel topics (covers text channels and any that survived restart via topic)
            interaction.guild.channels.cache.forEach(channel => {
                if (!channel.topic || !channel.topic.startsWith('SAFE_PLACE|')) return;
                if (userSafePlaces.has(channel.id)) return; // Already tracked by manager

                const [, creatorId, mode, timeOrEmpty, channelType] = channel.topic.split('|');
                if (creatorId === interaction.user.id) {
                    userSafePlaces.set(channel.id, {
                        channel,
                        mode,
                        type: channelType || 'text',
                        destructionTime: mode === 'time' ? parseInt(timeOrEmpty) : null
                    });
                }
            });

            if (userSafePlaces.size === 0) {
                return await interaction.editReply({
                    content: '📭 Vous n\'avez aucun salon sécurisé actif.'
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🔒 Vos Salons Sécurisés')
                .setColor('#00ff00')
                .setFooter({ text: `${userSafePlaces.size} salon(s) actif(s)` })
                .setTimestamp();

            let description = '';

            for (const [, data] of userSafePlaces) {
                let destructionInfo = '';
                if (data.mode === 'time' && data.destructionTime) {
                    const remainingTime = Math.max(0, data.destructionTime - Date.now());
                    const remainingHours = Math.ceil(remainingTime / (60 * 60 * 1000));
                    destructionInfo = `⏰ ${remainingHours}h restantes`;
                } else if (data.mode === 'empty') {
                    destructionInfo = '🔄 Suppression à la sortie';
                } else if (data.mode === 'manual') {
                    destructionInfo = '🛠️ Suppression manuelle';
                }

                const typeIcon = data.type === 'voice' ? '🔊' : '📝';
                const memberCount = data.channel.isVoiceBased() ? ` (${data.channel.members.size} membres)` : '';

                description += `${typeIcon} ${data.channel} ${memberCount}\n`;
                description += `└ ${destructionInfo}\n\n`;
            }

            embed.setDescription(description);

            await interaction.editReply({
                embeds: [embed]
            });

        } catch (error) {
            console.error('Erreur lors de la liste des salons sécurisés:', error);

            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ Une erreur est survenue lors de la récupération de la liste.'
                });
            } else {
                await interaction.reply({
                    content: '❌ Une erreur est survenue lors de la récupération de la liste.',
                    ephemeral: true
                });
            }
        }
    }
};