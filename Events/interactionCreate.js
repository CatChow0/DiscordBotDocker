const Discord = require('discord.js')

module.exports = async (bot, interaction) => {

    if (interaction.type !== Discord.InteractionType.ApplicationCommand) return

    const command = bot.commands.get(interaction.commandName)
    if (!command) return

    try {
        // Vérifier si la commande utilise execute() ou run()
        if (command.execute) {
            await command.execute(interaction)
        } else if (command.run) {
            await command.run(bot, interaction, interaction.options)
        }
    } catch (error) {
        console.error(`Erreur commande /${interaction.commandName}:`, error)
        const payload = { content: '❌ Une erreur est survenue.', flags: Discord.MessageFlags.Ephemeral }
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(payload)
            } else {
                await interaction.reply(payload)
            }
        } catch (replyError) {
            console.error('Impossible de répondre à l\'interaction:', replyError)
        }
    }
}
