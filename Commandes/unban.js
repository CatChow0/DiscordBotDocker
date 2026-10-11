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
            description: "l'utilisateur a débannir",
            required: true,
        }, {
            type: "string",
            name: "raison",
            description: "le raison du débannissement",
            required: false,
        }
    ],

    async run(bot, message, args) {

        let user = args.getUser("utilisateur")
        if(!user) return message.reply("Pas d'utilisateur !")

        let reason = args.getString("raison") || "Pas de raison fournie."

        if(!(await message.guild.bans.fetch(user.id).catch(() => null))) return message.reply("Cet utilisateur n'est pas banni !")

        await message.guild.bans.remove(user, reason)

        await message.reply(`${message.user} a unban ${user.tag} pour la raison : \`${reason}\``)

        try {await user.send(`Tu as été unban de ${message.guild.name} par ${message.user.tag} pour la raison : \`${reason}\``)} catch (err) {}
    }
}
