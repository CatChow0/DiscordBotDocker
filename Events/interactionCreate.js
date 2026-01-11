const Discord = require('discord.js')

module.exports = async (bot, interaction) => {

    if (interaction.type === Discord.InteractionType.ApplicationCommand) {

        let command = require(`../Commandes/${interaction.commandName}`)
        
        // Vérifier si la commande utilise execute() ou run()
        if (command.execute) {
            await command.execute(interaction)
        } else if (command.run) {
            await command.run(bot, interaction, interaction.options)
        }
    }
}