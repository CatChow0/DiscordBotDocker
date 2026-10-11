const Discord = require('discord.js');
const { GatewayIntentBits, Partials } = Discord;
const bot = new Discord.Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions
    ],
    // Nécessaire pour recevoir les réactions sur des messages hors cache (rôle par réaction)
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});
const loadCommands = require("./Loader/loadCommands");
const loadEvents = require("./Loader/loadEvents");
const config = require('./config');
const express = require('express');

process.on('unhandledRejection', err => console.error('Promesse rejetée non gérée:', err));

bot.commands = new Discord.Collection();
bot.color = "#FF0000";

loadCommands(bot);
loadEvents(bot);
bot.login(config.token);

// Serveur Express pour Jenkins CI
const app = express();
app.use(express.json());

app.post('/ci-notify', async (req, res) => {
    if (!config.ciSecret || req.get('X-CI-Secret') !== config.ciSecret) {
        return res.status(401).json({ error: 'unauthorized' });
    }

    const { userId, status, urls = [] } = req.body || {};
    if (typeof userId !== 'string' || !Array.isArray(urls) || !urls.every(u => typeof u === 'string' && /^https?:\/\//.test(u))) {
        return res.status(400).json({ error: 'invalid payload' });
    }

    try {
        const user = await bot.users.fetch(userId);
        if (status === 'success') {
            const embed = new Discord.EmbedBuilder()
                .setColor('#43B581')
                .setTitle('✅ Build Jenkins terminé avec succès !')
                .setDescription('Les artefacts sont disponibles en téléchargement :')
                .addFields(...urls.slice(0, 25).map(url => {
                    const fileName = url.split('/').pop();
                    return { name: fileName, value: `[Télécharger](${url})`, inline: false };
                }))
                .setTimestamp();
            await user.send({ embeds: [embed] });
        } else {
            const embed = new Discord.EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Build Jenkins échoué')
                .setDescription('Le build Jenkins a échoué. Aucun artefact disponible.')
                .setTimestamp();
            await user.send({ embeds: [embed] });
        }
        res.status(200).json({ ok: true });
    } catch (err) {
        console.error('Erreur envoi MP:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(2500, () => console.log('Serveur HTTP pour Jenkins CI prêt sur le port 2500'));
