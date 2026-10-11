const Discord = require('discord.js')

module.exports = {

    name: "ban",
    description: "ban un membre",
    permission: Discord.PermissionFlagsBits.BanMembers,
    dm: false,
    category: "Modération",
    options: [
        {
            type: "user",
            name: "membre",
            description: "le membre a bannir",
            required: true,
        }, {
            type: "string",
            name: "raison",
            description: "le raison du bannissement",
            required: false,
        }
    ],

    async run(bot, message, args) {

        let user = args.getUser("membre")
        if (!user) return message.reply("Pas de membre a bannir !")
        let member = await message.guild.members.fetch(user.id).catch(() => null)

        let reason = args.getString("raison") || "Pas de raison fournie."

        if(message.user.id === user.id) return message.reply("Essaie pas de te bannir !")
        if(message.guild.ownerId === user.id) return message.reply("Ne ban pas le propriétaire du serveur")
        if(member && !member.bannable) return message.reply("Je ne peux pas bannir ce membre !")
        if(member && message.member.roles.highest.comparePositionTo(member.roles.highest) <= 0) return message.reply("Tu ne peux pas bannir ce membre !")
        if(await message.guild.bans.fetch(user.id).catch(() => null)) return message.reply("Ce membre est déjà ban !")

        // Le MP doit partir avant le ban : après, le bot ne partage plus de serveur avec l'utilisateur
        try {await user.send(`Tu as été banni du serveur ${message.guild.name} par ${message.user.tag} pour la raison : \`${reason}\``)} catch(err) {}

        await message.guild.bans.create(user.id, {reason: reason})

        await message.reply(`${message.user} a banni ${user.tag} pour la raison : \`${reason}\` `)
    }
}
