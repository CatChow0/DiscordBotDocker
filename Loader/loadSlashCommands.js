const Discord = require("discord.js")
const {REST} = require("@discordjs/rest")
const {Routes} = require("discord.js")

module.exports = async bot => {

    let commands = [];

    bot.commands.forEach(async command => {
    
        // Si la commande a déjà son SlashCommandBuilder, l'utiliser directement
        if (command.isSlashCommand && command.data) {
            commands.push(command.data);
            return;
        }
        
        let slashcommand = new Discord.SlashCommandBuilder()
        .setName(command.name)
        .setDescription(command.description)
        .setDMPermission(command.dm)
        .setDefaultMemberPermissions(command.permission === "Aucune" ? null : command.permission)

        if (command.options?.length >= 1) {
            for(let i = 0; i < command.options.length; i++) {
                const optionType = command.options[i].type.slice(0, 1).toUpperCase() + command.options[i].type.slice(1, command.options[i].type.length);
                slashcommand[`add${optionType}Option`](option => {
                    option.setName(command.options[i].name)
                          .setDescription(command.options[i].description)
                          .setRequired(command.options[i].required);
                    
                    // Ajouter les choices si elles existent
                    if (command.options[i].choices && command.options[i].choices.length > 0) {
                        option.addChoices(...command.options[i].choices);
                    }
                    
                    // Ajouter les contraintes pour les entiers
                    if (command.options[i].type === 'Integer') {
                        if (command.options[i].minValue !== undefined) {
                            option.setMinValue(command.options[i].minValue);
                        }
                        if (command.options[i].maxValue !== undefined) {
                            option.setMaxValue(command.options[i].maxValue);
                        }
                    }
                    
                    return option;
                });
            }
        }

        await commands.push(slashcommand)
    })

    const rest = new REST({version: "10"}).setToken(bot.token)

    await rest.put(Routes.applicationCommands(bot.user.id), {body: commands})
    console.log("Les slash commandes sont crées avec succès !")
}