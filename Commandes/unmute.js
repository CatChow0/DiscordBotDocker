const Discord = require("discord.js")

module.exports = {
    name : "unmute",
    description: "Unmute un membre",
    permission: Discord.PermissionFlagsBits.ModerateMembers,
    dm: false,
    category: "Modération",
    options: [
        {
            type: "user",
            name: "membre",
            description: "Le membre a unmute",
            required: true,
        }, {
            type: "string",
            name: "raison",
            description: "Le raison du unmute",
            required: false,
        }
    ],

    async run(bot, message, args) {

        let user = args.getUser("membre");
        if(!user) return message.reply("Pas de membre !")
        let member = message.guild.members.cache.get(user.id)
        if(!member ) return message.reply("Pas de membre !")

        let reason = args.getString("raison") || "Pas de raison fournie."

        if(!member.moderatable) return message.reply("Je ne peux pas unmute ce membre !")
        if(message.member.roles.highest.comparePositionTo(member.roles.highest) <= 0) return message.reply("Vous ne pouvez pas unmute ce membre !")
        if(!member.isCommunicationDisabled()) return message.reply("Ce membre n'est pas mute !")

        await member.timeout(null, reason)

        await message.reply(`${message.user} a unmute ${user.tag} pour la raison : \`${reason}\``)

        try {await user.send(`Vous avez été unmute par ${message.user.tag} pour la raison : \`${reason}\``)} catch (err) {}
    }
}
