const { parentPort } = require('worker_threads');
const Discord = require('discord.js');

parentPort.on('message', async (data) => {
    try {
        const { botToken, guildId, channelName, parentCategoryId, permissionOverwrites, userChannelId } = data;
        
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

                const tempChannel = await guild.channels.create({
                    name: channelName,
                    type: Discord.ChannelType.GuildVoice,
                    parent: parentCategoryId,
                    permissionOverwrites: permissionOverwrites.map(overwrite => ({
                        id: overwrite.id,
                        allow: overwrite.allow,
                        deny: overwrite.deny
                    }))
                });

                // Déplacer l'utilisateur vers le nouveau salon
                const user = await guild.members.fetch(userChannelId);
                if (user.voice.channel) {
                    await user.voice.setChannel(tempChannel);
                }

                parentPort.postMessage({ 
                    success: true, 
                    channelId: tempChannel.id,
                    channelName: tempChannel.name
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
