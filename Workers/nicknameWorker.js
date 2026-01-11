const { parentPort } = require('worker_threads');
const Discord = require('discord.js');

parentPort.on('message', async (data) => {
    let tempBot = null;
    
    try {
        const { botToken, guildId, userId, nickname } = data;
        
        // Créer un client temporaire pour ce worker avec moins d'intents
        const intents = new Discord.IntentsBitField([
            Discord.GatewayIntentBits.Guilds,
            Discord.GatewayIntentBits.GuildMembers
        ]);
        tempBot = new Discord.Client({ intents });
        
        // Timeout pour la connexion
        const loginTimeout = setTimeout(() => {
            if (tempBot) {
                tempBot.destroy();
                parentPort.postMessage({ success: false, error: 'Login timeout' });
            }
        }, 15000);
        
        await tempBot.login(botToken);
        clearTimeout(loginTimeout);
        
        tempBot.once('ready', async () => {
            try {
                const guild = tempBot.guilds.cache.get(guildId);
                if (!guild) {
                    parentPort.postMessage({ success: false, error: 'Guild not found' });
                    return;
                }

                const member = await guild.members.fetch(userId).catch(() => null);
                if (!member) {
                    parentPort.postMessage({ success: false, error: 'Member not found' });
                    return;
                }

                // Vérifier si le pseudo est différent pour éviter les appels inutiles
                if (member.nickname === nickname) {
                    parentPort.postMessage({ 
                        success: true, 
                        message: `Nickname already set to ${nickname} for user ${userId}`
                    });
                    return;
                }

                await member.setNickname(nickname);
                
                parentPort.postMessage({ 
                    success: true, 
                    message: `Nickname changed to ${nickname} for user ${userId}`
                });
                
            } catch (error) {
                parentPort.postMessage({ success: false, error: error.message });
            } finally {
                if (tempBot) {
                    tempBot.destroy();
                }
            }
        });
        
    } catch (error) {
        parentPort.postMessage({ success: false, error: error.message });
        if (tempBot) {
            tempBot.destroy();
        }
    }
});
