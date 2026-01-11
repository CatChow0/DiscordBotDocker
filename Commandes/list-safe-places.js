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
            // Vérifier si l'utilisateur a le rôle requis
            const requiredRoleId = "522799905073266698";
            if (!interaction.member.roles.cache.has(requiredRoleId)) {
                return await interaction.reply({
                    content: '❌ Vous n\'avez pas les permissions nécessaires pour utiliser cette commande.',
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            // Rechercher tous les salons sécurisés de l'utilisateur
            const userSafePlaces = interaction.guild.channels.cache.filter(channel => {
                if (!channel.topic || !channel.topic.startsWith('SAFE_PLACE|')) return false;
                
                const [prefix, creatorId] = channel.topic.split('|');
                return creatorId === interaction.user.id;
            });

            if (userSafePlaces.size === 0) {
                return await interaction.editReply({
                    content: '📭 Vous n\'avez aucun salon sécurisé actif.'
                });
            }

            // Créer l'embed avec la liste des salons
            const embed = new EmbedBuilder()
                .setTitle('🔒 Vos Salons Sécurisés')
                .setColor('#00ff00')
                .setFooter({ text: `${userSafePlaces.size} salon(s) actif(s)` })
                .setTimestamp();

            let description = '';
            
            userSafePlaces.forEach(channel => {
                const [prefix, creatorId, destructionType, timeOrEmpty, channelType] = channel.topic.split('|');
                
                let destructionInfo = '';
                if (destructionType === 'time') {
                    const destructionTime = parseInt(timeOrEmpty);
                    const remainingTime = Math.max(0, destructionTime - Date.now());
                    const remainingHours = Math.ceil(remainingTime / (60 * 60 * 1000));
                    destructionInfo = `⏰ ${remainingHours}h restantes`;
                } else if (destructionType === 'empty') {
                    destructionInfo = '🔄 Suppression à la sortie';
                } else if (destructionType === 'manual') {
                    destructionInfo = '🛠️ Suppression manuelle';
                }

                const typeIcon = channelType === 'voice' ? '🔊' : '📝';
                const memberCount = channel.type === 2 ? ` (${channel.members.size} membres)` : '';
                
                description += `${typeIcon} ${channel} ${memberCount}\n`;
                description += `└ ${destructionInfo}\n\n`;
            });

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
