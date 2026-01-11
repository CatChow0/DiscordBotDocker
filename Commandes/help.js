const Discord = require("discord.js")

module.exports = {

    name: "help",
    description: "Affiche la liste des commandes disponibles",
    permission: "Aucune",
    dm: true,
    category: "Information",
    options: [
        {
            type: "string",
            name: "commande",
            description: "La liste des commandes",
            required: false
        }
    ],

    async run(bot, message, args) {

        let command;
        if(args.getString("commande")) {
            command = bot.commands.get(args.getString("commande"));
            if(!command) return message.reply("Pas de commande !");
        }

        if(!command) {

            let categories = [];
            bot.commands.forEach(command => {
                if(!categories.includes(command.category)) categories.push(command.category)
            })

            let Embed = new Discord.EmbedBuilder()
            .setColor(bot.color)
            .setTitle(`Commandes de Botonku`)
            .setThumbnail(bot.user.displayAvatarURL({dynamic: true}))
            .setDescription(`Command disponible : \`${bot.commands.size}\`\nCatégories disponibles : \`${categories.length}\``)
            .setTimestamp()
            .setFooter({text : "Commandes de Botonku"})

            await categories.sort().forEach(async cat => {
                let commands = bot.commands.filter(cmd => cmd.category === cat)
                Embed.addFields({name: `${cat}`, value: `${commands.map(cmd => `\`${cmd.name}\` : ${cmd.description}`).join("\n")}`})
            })

            await message.reply({embeds: [Embed]})
        } else {

            let Embed = new Discord.EmbedBuilder()
            .setColor(bot.color)
            .setTitle(`Commandes ${command.name}`)
            .setThumbnail(bot.user.displayAvatarURL({dynamic: true}))
            .setDescription(`Nom : \`${command.name}\`\nDescription : \`${command.description}\`\nPermission requise \`${typeof command.permission !== "bigint" ? command.permission : new Discord.PermissionsBitField(command.permission).toArray(false)}\`\nCommande en DM : \`${command.dm ? "Oui" : "Non"}\`\nCategorie : \`${command.category}\``)
            .setTimestamp()
            .setFooter({text : "Commandes de Botonku"})

            await message.reply({embeds: [Embed]})
        }
    }
}