const Discord = require('discord.js');
const config = require('../config');

const KICK_REASON = 'Retrait visiteur temporaire - commande /mobutu';
const ENTRIES_PER_EMBED = 80;
const MAX_CHUNKS = 9; // header + MAX_CHUNKS = 10 = Discord per-message embed cap
const COLLECTOR_TIMEOUT_MS = 60_000;

function formatJoinDate(timestamp) {
    if (timestamp === null) return 'inconnue';
    const d = new Date(timestamp);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

module.exports = {
    name: 'mobutu',
    description: 'Kick en masse les membres portant un rôle (visiteurs temporaires), après confirmation',
    permission: Discord.PermissionFlagsBits.Administrator,
    dm: false,
    category: 'Modération',
    options: [
        {
            type: 'Integer',
            name: 'depuis',
            description: 'Ne kicker que les membres joints il y a plus de X jours (0 = tous)',
            required: true,
            minValue: 0
        },
        {
            type: 'Role',
            name: 'role',
            description: 'Rôle cible (surcharge MOBUTU_ROLE_ID)',
            required: false
        }
    ],

    async run(bot, interaction, args) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const guild = interaction.guild;
            const depuis = args.getInteger('depuis');
            const roleOption = args.getRole('role');
            const targetRoleId = roleOption ? roleOption.id : config.mobutuRoleId;

            if (!targetRoleId) {
                return await interaction.editReply({
                    content: '❌ Aucun rôle cible : variable MOBUTU_ROLE_ID absente et option `role` non fournie.'
                });
            }

            const targetRole = guild.roles.cache.get(targetRoleId);
            if (!targetRole) {
                return await interaction.editReply({
                    content: '❌ Le rôle cible est introuvable sur ce serveur.'
                });
            }

            const ownerId = guild.ownerId;
            const cutoff = Date.now() - depuis * 86_400_000;

            await guild.members.fetch(); // populate member cache (GUILD_MEMBERS intent is enabled)
            const toKick = [];
            const ignored = [];

            for (const member of guild.members.cache.values()) {
                if (!member.roles.cache.has(targetRoleId)) continue;
                if (member.id === ownerId || !member.kickable) {
                    ignored.push(member);
                    continue;
                }
                // skip members joined less than `depuis` days ago
                if (member.joinedTimestamp !== null && member.joinedTimestamp >= cutoff) continue;
                toKick.push(member);
            }

            if (toKick.length === 0) {
                return await interaction.editReply({
                    content: `ℹ️ Aucun membre à kicker pour le rôle **${targetRole.name}** avec le filtre > ${depuis} jour(s).\n` +
                             `Membres ignorés (owner / non-kickables) : ${ignored.length}.`
                });
            }

            // --- Build the full multi-embed target list ---
            const now = Date.now();
            const entries = toKick.map(m => {
                const days = m.joinedTimestamp !== null
                    ? Math.floor((now - m.joinedTimestamp) / 86_400_000)
                    : '?';
                return `@${m.user.tag} — joined ${formatJoinDate(m.joinedTimestamp)} (${days}j)`;
            });

            const chunks = [];
            let truncated = 0;
            for (let i = 0; i < entries.length; i += ENTRIES_PER_EMBED) {
                if (chunks.length >= MAX_CHUNKS) {
                    truncated = entries.length - i;
                    break;
                }
                chunks.push(entries.slice(i, i + ENTRIES_PER_EMBED));
            }

            const chunkEmbeds = chunks.map((chunk, i) => {
                const e = new Discord.EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(`Cibles — partie ${i + 1}/${chunks.length}`);
                let body = chunk.join('\n');
                if (i === chunks.length - 1 && truncated > 0) {
                    body += `\n\n⚠️ +${truncated} non affichés — affinez \`depuis\` pour réduire la liste.`;
                }
                e.setDescription(body);
                return e;
            });

            const headerEmbed = new Discord.EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(`🪓 /mobutu — ${toKick.length} membre(s) à kicker`)
                .setDescription(
                    `Rôle cible : **${targetRole.name}**\n` +
                    `Filtre : joints il y a plus de **${depuis}** jour(s)\n` +
                    `Ignorés (owner / non-kickables) : ${ignored.length}\n\n` +
                    `Vérifie la liste complète ci-dessous, puis confirme.`
                );
            const embeds = [headerEmbed, ...chunkEmbeds];

            const row = new Discord.ActionRowBuilder().addComponents(
                new Discord.ButtonBuilder()
                    .setCustomId('mobutu_confirm')
                    .setLabel('✅ Confirmer le kick')
                    .setStyle(Discord.ButtonStyle.Danger),
                new Discord.ButtonBuilder()
                    .setCustomId('mobutu_cancel')
                    .setLabel('❌ Annuler')
                    .setStyle(Discord.ButtonStyle.Secondary)
            );

            const filter = i => i.user.id === interaction.user.id;
            const response = await interaction.editReply({ embeds, components: [row] });

            let componentInteraction;
            try {
                componentInteraction = await response.awaitMessageComponent({ filter, time: COLLECTOR_TIMEOUT_MS });
            } catch (err) {
                return await interaction.editReply({
                    embeds: [], components: [],
                    content: '⌛ Kick annulé : confirmation expirée (60s).'
                });
            }

            if (componentInteraction.customId === 'mobutu_cancel') {
                await componentInteraction.update({ embeds: [], components: [], content: '🚫 Kick annulé.' });
                return;
            }

            // --- Confirmed: perform the kicks ---
            await componentInteraction.update({ embeds: [], components: [], content: '⏳ Kick en cours…' });

            const succeeded = [];
            const failed = [];
            for (const member of toKick) {
                try {
                    await member.kick(KICK_REASON);
                    succeeded.push(member);
                } catch (err) {
                    failed.push({ member, reason: err.message });
                }
            }

            const summary = new Discord.EmbedBuilder()
                .setColor('#43B581')
                .setTitle('🪓 /mobutu — synthèse')
                .addFields(
                    { name: '✅ Kicks réussis', value: `${succeeded.length}`, inline: true },
                    { name: '❌ Échecs', value: `${failed.length}`, inline: true },
                    { name: '⏭️ Ignorés', value: `${ignored.length}`, inline: true }
                );

            if (failed.length > 0) {
                let detail = failed.map(f => `@${f.member.user.tag} — ${f.reason}`).slice(0, 15).join('\n');
                if (failed.length > 15) detail += `\n… et ${failed.length - 15} autre(s).`;
                summary.addFields({ name: 'Détail des échecs', value: detail });
            }
            if (ignored.length > 0) {
                const igDetail = ignored.map(m => `@${m.user.tag}`).slice(0, 15).join('\n') || '—';
                summary.addFields({ name: 'Ignorés (owner / non-kickables)', value: igDetail });
            }

            await interaction.editReply({ embeds: [summary], components: [], content: null });
        } catch (error) {
            console.error('Erreur commande /mobutu:', error);
            if (interaction.deferred) {
                await interaction.editReply({ content: '❌ Une erreur est survenue lors de la commande /mobutu.' });
            } else {
                await interaction.reply({ content: '❌ Une erreur est survenue lors de la commande /mobutu.', ephemeral: true });
            }
        }
    }
};