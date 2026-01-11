const Discord = require('discord.js');
const intents = new Discord.IntentsBitField(3276799);
const bot = new Discord.Client({ intents });
const loadCommands = require("./Loader/loadCommands");
const loadEvents = require("./Loader/loadEvents");
const config = require('./config');
const express = require('express');
const bodyParser = require('body-parser');

bot.commands = new Discord.Collection();
bot.color = "#FF0000";

bot.login(config.token);
loadCommands(bot);
loadEvents(bot);

// Serveur Express pour Jenkins CI
const app = express();
app.use(bodyParser.json());

app.post('/ci-notify', async (req, res) => {
    const { userId, status, urls } = req.body;
    try {
        const user = await bot.users.fetch(userId);
        if (status === 'success') {
            const embed = new Discord.EmbedBuilder()
                .setColor('#43B581')
                .setTitle('✅ Build Jenkins terminé avec succès !')
                .setDescription('Les artefacts sont disponibles en téléchargement :')
                .addFields(...urls.map(url => {
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
