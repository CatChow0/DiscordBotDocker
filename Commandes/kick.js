const Discord = require('discord.js')

module.exports = {

    name: "kick",
    description: "kick un membre",
    permission: Discord.PermissionFlagsBits.KickMembers,
    dm: false,
    category: "Modération",
    options: [
        {
            type: "user",
            name: "membre",
            description: "le membre a kick",
            required: true,
        }, {
            type: "string",
            name: "raison",
            description: "le raison du kick",
            required: false,
        }
    ],

    async run(bot, message, args) {

        let user = args.getUser("membre");
        if (!user) return message.reply("Pas de membre a kick !")
        let member = message.guild.members.cache.get(user.id)
        if(!member) return message.reply("Pas de membre a kick")

        let reason = args.getString("raison") || "Pas de raison fournie."

        if(message.user.id === user.id) return message.reply("Essaie pas de te kick !")
        if(message.guild.ownerId === user.id) return message.reply("Ne kick pas le propriétaire du serveur")
        if(!member.kickable) return message.reply("Je ne peux pas kick ce membre !")
        if(message.member.roles.highest.comparePositionTo(member.roles.highest) <= 0) return message.reply("Tu ne peux pas kick ce membre !")

        // Le MP doit partir avant le kick : après, le bot ne partage plus de serveur avec l'utilisateur
        try {await user.send(`Tu as été kick du serveur ${message.guild.name} par ${message.user.tag} pour la raison : \`${reason}\``)} catch(err) {}

        await member.kick(reason)

        await message.reply(`${message.user} a kick ${user.tag} pour la raison : \`${reason}\` `)
    }
}
