# /mobutu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only `/mobutu` slash command that lists (full, multi-embed) members holding a target role older than N days, then kicks them all after button confirmation.

**Architecture:** New `Commandes/mobutu.js` following the existing command-module pattern (`name`/`description`/`permission`/`options`/`run`). Permission set to `Discord.PermissionFlagsBits.Administrator` so Discord gates visibility by the Administrator permission (no hardcoded role check). Target role comes from env var `MOBUTU_ROLE_ID` (via `config.js`), overridable by an optional `role` command option.

**Tech Stack:** Node.js 20, discord.js v14 (already a dependency), existing `Loader/loadSlashCommands.js` + `Events/interactionCreate.js`.

## Global Constraints

- No test framework exists in this repo. Verification is **manual** against a live Discord test server (each task's "verify" step describes the manual check). Do not invent a test runner.
- Follow the existing command-module shape exactly (plain object export, `run(bot, interaction, args)` where `args === interaction.options`). Do NOT use `SlashCommandBuilder` inside the command file — `loadSlashCommands.js` builds it from `name`/`description`/`permission`/`options`.
- `options[].type` must be capitalized (`'Integer'`, `'Role'`) because `loadSlashCommands.js` does `add${optionType}Option` (capitalize first letter). See `Commandes/kick.js` and `create-safe-place.js` for reference.
- `permission` value must be a `Discord.PermissionFlagsBits` numeric flag, not a string.
- Commit messages end with the trailer:
  ```
  Co-Authored-By: Claude <noreply@anthropic.com>
  ```
- Do not run the bot yourself (no Discord token in this environment); the human runs/deploys.

---

## File Structure

- **Modify** `config.js` — add `mobutuRoleId: process.env.MOBUTU_ROLE_ID`.
- **Modify** `docker-compose.yml` — add `- MOBUTU_ROLE_ID=${MOBUTU_ROLE_ID}` to `environment`.
- **Create** `Commandes/mobutu.js` — the command (collection + multi-embed confirmation list + button collector + batch kick + summary).
- `Loader/loadSlashCommands.js`, `Events/interactionCreate.js`, `main.js` — **unchanged** (already generic).

---

### Task 1: Expose `MOBUTU_ROLE_ID` in config

**Files:**
- Modify: `config.js`

**Interfaces:**
- Produces: `config.mobutuRoleId` (string or `undefined`) consumed by Task 3 (`Commandes/mobutu.js`).

- [ ] **Step 1: Add the field to config.js**

Edit `config.js` to add the `mobutuRoleId` line last (after `paysRoleId`):

```js
module.exports = {
    token: process.env.DISCORD_TOKEN,
    tempVoiceChannelId: process.env.TEMP_VOICE_CHANNEL_ID,
    pokemonRoleId: process.env.POKEMON_ROLE_ID,
    chiengRoleId: process.env.CHIENG_ROLE_ID,
    paysRoleId: process.env.PAYS_ROLE_ID,
    mobutuRoleId: process.env.MOBUTU_ROLE_ID
};
```

- [ ] **Step 2: Verify**

Run: `node -e "console.log(require('./config').mobutuRoleId)"`
Expected: prints `undefined` (env var not set locally) and exits 0 — confirms the field exists and does not crash. Do NOT expect a real ID locally.

- [ ] **Step 3: Commit**

```bash
git add config.js
git commit -m "Config: expose MOBUTU_ROLE_ID

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Inject `MOBUTU_ROLE_ID` into the Docker container

**Files:**
- Modify: `docker-compose.yml` (the `environment:` block of the `discord-bot` service, currently lines 6-18)

**Interfaces:**
- Produces: the `MOBUTU_ROLE_ID` env var inside the container, read by `config.js`.

- [ ] **Step 1: Add the env line**

Edit `docker-compose.yml`. Insert `- MOBUTU_ROLE_ID=${MOBUTU_ROLE_ID}` immediately after the `- PAYS_ROLE_ID=${PAYS_ROLE_ID}` line (currently line 11). The `environment:` block becomes:

```yaml
    environment:
      - NODE_ENV=production
      - DISCORD_TOKEN=${DISCORD_TOKEN}
      - TEMP_VOICE_CHANNEL_ID=${TEMP_VOICE_CHANNEL_ID}
      - POKEMON_ROLE_ID=${POKEMON_ROLE_ID}
      - CHIENG_ROLE_ID=${CHIENG_ROLE_ID}
      - PAYS_ROLE_ID=${PAYS_ROLE_ID}
      - MOBUTU_ROLE_ID=${MOBUTU_ROLE_ID}
      - AC_CONTAINER_NAME=acevo-dedicated
      - AC_COMPOSE_DIR=/home/shiba/Documents/ace
      - AC_COMPOSE_FILE=/home/shiba/Documents/ace/docker-compose.yml
      - AC_ENV_FILE=/home/shiba/Documents/ace/.env
      - AC_SERVICE_NAME=acevo-dedicated
      - AC_ADMIN_ROLE_ID=522799905073266698
      - DATA_DIR=/app/data
```

- [ ] **Step 2: Verify YAML is still valid**

Run: `docker compose -f docker-compose.yml config --quiet` (only if Docker is available locally; otherwise visually re-check indentation matches the surrounding `- VAR` lines exactly — 6 spaces indent).
Expected: exits 0 / no parse error.

- [ ] **Step 3: Document the new required env var**

Edit the host `.env` (out of repo scope — note for operator): add `MOBUTU_ROLE_ID=<role id of the temporary-visitor role>`. No repo file change needed; just inform the operator at handoff.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "Docker: inject MOBUTU_ROLE_ID into discord-bot service

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Create the `/mobutu` command

**Files:**
- Create: `Commandes/mobutu.js`

**Interfaces:**
- Consumes: `config.mobutuRoleId` (Task 1), `interaction.options` (`args`), `discord.js` v14.
- Produces: a command named `mobutu` registered automatically by `Loader/loadCommands.js` + `loadSlashCommands.js` on next bot start.

**Constants used throughout this task:**
- `KICK_REASON = 'Retrait visiteur temporaire - commande /mobutu'`
- `ENTRIES_PER_EMBED = 80` (max lines per embed's 4096-char description; 80 × ~45 chars ≈ 3600 < 4096)
- `MAX_CHUNKS = 9` (so header embed + 9 chunk embeds = 10 = Discord per-message embed cap)
- `COLLECTOR_TIMEOUT_MS = 60_000`

- [ ] **Step 1: Write the full command file**

Create `Commandes/mobutu.js` with exactly this content:

```js
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
```

- [ ] **Step 2: Verify the file loads without syntax errors**

Run: `node -e "const c = require('./Commandes/mobutu.js'); console.log(c.name, c.options.length, typeof c.run)"`
Expected: prints `mobutu 2 function` and exits 0. A SyntaxError here means a typo — fix and rerun.

- [ ] **Step 3: Verify loadSlashCommands would build it**

Run: `node -e "const D=require('discord.js'); const c=require('./Commandes/mobutu.js'); const b=new D.SlashCommandBuilder().setName(c.name).setDescription(c.description).setDefaultMemberPermissions(c.permission); for(const o of c.options){const t=o.type; b[\`add\${t}Option\`](opt=>opt.setName(o.name).setDescription(o.description).setRequired(o.required)); if(o.minValue!==undefined){}} console.log(b.name)"`
Expected: prints `mobutu` and exits 0. This mirrors what `loadSlashCommands.js` does with `type` capitalization (`Integer`, `Role`) and confirms the option types resolve to real builder methods.

- [ ] **Step 4: Commit**

```bash
git add Commandes/mobutu.js
git commit -m "Feat: add /mobutu admin kick-by-role command

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Manual end-to-end verification (operator-run, no commit)

**Files:** none (verification only)

**Prerequisites:** operator has a Discord test server, a bot token with the bot invited, a dummy role (e.g. `@Visiteur`), and `MOBUTU_ROLE_ID` set to that role's ID in the host `.env`. A few test members with varied `joinedAt` (some recent, some old) holding the dummy role.

- [ ] **Step 1: Deploy and register slash commands**

Operator runs: `docker compose up --build -d` then watches logs for `Les slash commandes sont crées avec succès !` (from `loadSlashCommands.js`). The `/mobutu` command should appear for admin accounts.

- [ ] **Step 2: Verify admin-only visibility**

As a non-admin member, open the command picker — `/mobutu` must NOT appear. As an admin, it must appear.

- [ ] **Step 3: Verify the full target list (depuis:0)**

As admin, run `/mobutu depuis:0`. Confirm:
- The reply is ephemeral.
- The header embed shows the correct role name, filter `> 0 jour(s)`, and counts.
- Every member holding the role appears across the chunk embeds as `@tag — joined YYYY-MM-DD (Zj)`.
- Owner of the server (if holding the role) is NOT in the kick list and is counted under "Ignorés".
- The `✅ Confirmer le kick` / `❌ Annuler` buttons are present.

- [ ] **Step 4: Verify the age filter (depuis: large)**

Run `/mobutu depuis:9999`. Expected: "Aucun membre à kicker" message (no one joined >9999 days ago). No buttons shown.

- [ ] **Step 5: Verify cancel + timeout paths**

- Run `/mobutu depuis:0`, click `❌ Annuler` → reply becomes "🚫 Kick annulé.", no kicks occur.
- Run `/mobutu depuis:0`, wait 60s without clicking → reply becomes "⌛ Kick annulé : confirmation expirée (60s).", no kicks occur.

- [ ] **Step 6: Verify the actual kicks**

Run `/mobutu depuis:0`, click `✅ Confirmer le kick` → reply shows "⏳ Kick en cours…" then the synthèse embed. Confirm each listed (kickable) member was actually kicked from the server. Confirm non-kickable/owner members remain and are listed under "Ignorés".

- [ ] **Step 7: Verify `role` option overrides config**

Set `MOBUTU_ROLE_ID` to role A in `.env`. Run `/mobutu depuis:0 role:@RoleB`. Expected: the header embed targets role B, not A.

- [ ] **Step 8: Verify missing-config error**

Unset `MOBUTU_ROLE_ID` in `.env`, restart, run `/mobutu depuis:0` WITHOUT the `role` option. Expected: "❌ Aucun rôle cible : variable MOBUTU_ROLE_ID absente…". (Restore the env var afterward.)

---

## Self-Review

**Spec coverage:**
- Permission Administrator → Task 3 (`permission: Discord.PermissionFlagsBits.Administrator`). ✅
- Rôle cible "les deux" (env default + option override) → Task 1 (config) + Task 3 (option `role` + fallback to `config.mobutuRoleId`) + Task 4 Step 7 (override test) + Step 8 (missing-config test). ✅
- Option `depuis` obligatoire en jours, min 0 → Task 3 (`required: true, minValue: 0`). ✅
- Embed listant tous les ciblés (multi-embed, complète) → Task 3 (header + chunks, MAX_CHUNKS=9, truncation warning) + Task 4 Step 3. ✅
- Bouton confirmation / annulation / timeout 60s → Task 3 (`awaitMessageComponent`, `mobutu_confirm`/`mobutu_cancel`, 60s) + Task 4 Steps 5-6. ✅
- Skip owner + non-kickables, reportés dans synthèse → Task 3 (`ignored` array + summary field) + Task 4 Steps 3/6. ✅
- Aucun DM, raison fixe → Task 3 (`KICK_REASON`, no `.send()` to members). ✅
- config.js + docker-compose.yml → Task 1 + Task 2. ✅
- Liste vide → message informatif sans bouton → Task 3 (early return) + Task 4 Step 4. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code.

**Type consistency:** `config.mobutuRoleId` (Task 1) == consumed name in Task 3. Option types `'Integer'`/`'Role'` match `loadSlashCommands.js`'s `add${type}Option`. Custom IDs `mobutu_confirm`/`mobutu_cancel` consistent within Task 3. Constants referenced in code are defined at top of Task 3 file.

No issues found.