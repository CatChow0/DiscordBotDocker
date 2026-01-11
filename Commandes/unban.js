const Discord = require('discord.js')

module.exports = {
    
    name: "unban",
    description: "Unban un membre",
    permission: Discord.PermissionFlagsBits.BanMembers,
    dm: false,
    category: "Modération",
    options: [
        {
            type: "user",
            name: "utilisateur",
            description: "l'utilisateur' a débannir",
            required: true,
        }, {
            type: "string",
            name: "raison",
            description: "le raison du débannissement",
            required: false,
        }
    ],

    async run(bot, message, args) {

        try {

            let user = args.getUser("utilisateur")
            if(!user) return message.reply("Pas d'utilisateur !")

            let reason = args.getReason("raison")
            if(!reason) return message.reply("Pas de raison fournie.")

            if(!(await message.guild.ban.fetch()).get(user.id)) return message.reply("Cet utilisateur n'est pas banni !")

            try {await user.send(`Tu as été unban par ${message.user.tag} pour la raison : \`${reason}\``)} catch (err) {}

            await message.reply(`${message.user} a unban ${user.tag} pour la raison : \`${reason}\``)

            await message.guild.unban(user, reason)


        } catch (err) {

            return message.reply("Pas d'utilisatuer")
        }
        

    }
}