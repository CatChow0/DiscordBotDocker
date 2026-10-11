const Discord = require("discord.js")

module.exports = {

    name: "clear",
    description: "Efface les messages",
    permission: Discord.PermissionFlagsBits.ManageMessages,
    dm: false,
    category: "Modération",
    options: [
        {
            type: "Integer",
            name: "nombre",
            description: "Le nombre de messages à supprimer (1-100)",
            required: true,
            minValue: 1,
            maxValue: 100
        }, {
            type: "channel",
            name: "salon",
            description: "Le salon où effacer les messages",
            required: false,
        },
    ],

    async run(bot, message, args) {

        let channel = args.getChannel("salon") || message.channel
        if(!channel.isTextBased() || !message.guild.channels.cache.has(channel.id)) return message.reply("Pas de salon !")

        let number = args.getInteger("nombre")

        await message.deferReply({ flags: Discord.MessageFlags.Ephemeral })

        // filterOld = true : ignore les messages de plus de 14 jours au lieu d'échouer
        let messages = await channel.bulkDelete(number, true)

        if(messages.size === 0) return message.editReply("Aucun message supprimable (Discord refuse ceux de plus de 14 jours) !")
        if(messages.size < number) return message.editReply(`J'ai pu supprimer uniquement \`${messages.size}\` message(s) dans le salon ${channel}  (les autres datent de plus de 14 jours, ou le salon en contient moins).`)

        await message.editReply(`J'ai bien supprimé \`${messages.size}\` message(s) dans le salon ${channel} !`)
    }
}
