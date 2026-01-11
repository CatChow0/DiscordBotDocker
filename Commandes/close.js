const { PermissionFlagsBits } = require('discord.js');
const safePlaceManager = require('../safePlaceManager');

module.exports = {
    name: 'close',
    description: 'Fermer un salon sécurisé créé avec /create-safe-place',
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

            const channel = interaction.channel;

            // Vérifier si c'est un salon Safe-Place
            let isSafePlace = false;
            let creatorId = null;
            let mode = null;
            let channelType = null;

            // Vérifier d'abord dans le gestionnaire Safe-Place
            if (safePlaceManager.isSafePlace(channel.id)) {
                const safePlace = safePlaceManager.getSafePlace(channel.id);
                isSafePlace = true;
                creatorId = safePlace.creatorId;
                mode = safePlace.mode;
                channelType = safePlace.type;
            } 
            // Si pas trouvé, vérifier dans le topic (pour les anciens salons textuels)
            else if (channel.topic && channel.topic.startsWith('SAFE_PLACE|')) {
                const topicParts = channel.topic.split('|');
                isSafePlace = true;
                creatorId = topicParts[1];
                mode = topicParts[2];
                channelType = topicParts[4];
            }

            if (!isSafePlace) {
                return await interaction.editReply({
                    content: '❌ Cette commande ne peut être utilisée que dans un salon Safe-Place.'
                });
            }
            // Vérifier si le mode permet la fermeture manuelle
            if (mode === 'empty') {
                return await interaction.editReply({
                    content: '❌ Ce salon vocal est configuré pour se fermer automatiquement quand il est vide. Vous ne pouvez pas le fermer manuellement.'
                });
            }

            // Vérifier si l'utilisateur peut fermer le salon
            const canClose = interaction.user.id === creatorId || 
                           interaction.member.permissions.has('ManageChannels') ||
                           interaction.member.roles.cache.has(requiredRoleId);
                           interaction.member.permissions.has('ManageChannels');

            if (!canClose) {
                return await interaction.editReply({
                    content: '❌ Seul le créateur du salon ou un administrateur peut le fermer.'
                });
            }

            // Confirmer la fermeture
            await interaction.editReply({
                content: '✅ Fermeture du salon dans 5 secondes...'
            });

            // Message d'adieu dans le salon
            try {
                await channel.send({
                    content: `👋 **Salon fermé par ${interaction.user}**\n\nSuppression du salon dans 5 secondes...`
                });
            } catch (error) {
                console.log('Impossible d\'envoyer le message d\'adieu');
            }

            // Supprimer le salon après 5 secondes
            setTimeout(async () => {
                try {
                    // Supprimer du gestionnaire Safe-Place
                    safePlaceManager.removeSafePlace(channel.id);
                    await channel.delete();
                    console.log(`Salon sécurisé ${channel.name} fermé manuellement par ${interaction.user.tag}`);
                } catch (error) {
                    console.error('Erreur lors de la suppression du salon:', error);
                }
            }, 5000);

        } catch (error) {
            console.error('Erreur lors de la fermeture du salon:', error);
            
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ Une erreur est survenue lors de la fermeture du salon.'
                });
            } else {
                await interaction.reply({
                    content: '❌ Une erreur est survenue lors de la fermeture du salon.',
                    ephemeral: true
                });
            }
        }
    }
};
