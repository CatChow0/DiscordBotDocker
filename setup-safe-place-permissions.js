// Script pour configurer les permissions des commandes slash Safe-Place
// À exécuter une fois après le déploiement des commandes

const { REST, Routes } = require('@discordjs/rest');
const config = require('./config');

async function setupSafePlacePermissions() {
    const rest = new REST({ version: '10' }).setToken(config.token);
    
    try {
        console.log('Configuration des permissions pour les commandes Safe-Place...');
        
        // ID du rôle autorisé
        const allowedRoleId = "522799905073266698";
        
        // Récupérer les commandes du serveur
        const commands = await rest.get(Routes.applicationGuildCommands(config.clientId, config.guildId));
        
        // Trouver les commandes Safe-Place
        const safePlaceCommands = commands.filter(cmd => 
            ['create-safe-place', 'close', 'list-safe-places'].includes(cmd.name)
        );
        
        for (const command of safePlaceCommands) {
            const permissions = [
                {
                    id: allowedRoleId,
                    type: 1, // Role
                    permission: true
                }
            ];
            
            await rest.put(
                Routes.applicationCommandPermissions(config.clientId, config.guildId, command.id),
                { body: { permissions } }
            );
            
            console.log(`✅ Permissions configurées pour /${command.name}`);
        }
        
        console.log('🎉 Configuration terminée ! Seul le rôle spécifié peut utiliser les commandes Safe-Place.');
        
    } catch (error) {
        console.error('❌ Erreur lors de la configuration des permissions:', error);
    }
}

// Décommenter la ligne suivante pour exécuter le script
// setupSafePlacePermissions();

module.exports = { setupSafePlacePermissions };
