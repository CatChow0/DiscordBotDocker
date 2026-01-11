const { parentPort } = require('worker_threads');
const Discord = require('discord.js');

parentPort.on('message', async (data) => {
    try {
        const { botToken, guildId, channelId } = data;
        
        // Créer un client temporaire pour ce worker
        const intents = new Discord.IntentsBitField(3276799);
        const tempBot = new Discord.Client({ intents });
        
        await tempBot.login(botToken);
        
        tempBot.on('ready', async () => {
            try {
                const guild = tempBot.guilds.cache.get(guildId);
                if (!guild) {
                    parentPort.postMessage({ success: false, error: 'Guild not found' });
                    return;
                }

                const channel = guild.channels.cache.get(channelId);
                if (!channel) {
                    parentPort.postMessage({ success: false, error: 'Channel not found' });
                    return;
                }

                await channel.delete();
                
                parentPort.postMessage({ 
                    success: true, 
                    message: `Channel ${channelId} deleted successfully`
                });
                
                await tempBot.destroy();
            } catch (error) {
                parentPort.postMessage({ success: false, error: error.message });
                await tempBot.destroy();
            }
        });
        
    } catch (error) {
        parentPort.postMessage({ success: false, error: error.message });
    }
});
