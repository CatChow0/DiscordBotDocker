# Auto-assign MOBUTU role on join — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-add the `MOBUTU_ROLE_ID` role to every new member on join so they are targetable by `/mobutu` by default.

**Architecture:** New `Events/guildMemberAdd.js` event handler, auto-loaded by `Loader/loadEvents.js` (binds `bot` as first arg, uses filename as event name). Reads the existing `config.mobutuRoleId`. No enforcement (Discord role hierarchy blocks self-removal), no backfill, no new command, no persistence.

**Tech Stack:** Node.js 20, discord.js v14 (already a dependency, currently 14.27.0), existing `config.js` + `Loader/loadEvents.js`.

## Global Constraints

- No test framework exists in this repo. Verification is **manual** (operator invites a test account and checks logs). Do not invent a test runner.
- Follow the existing event-module shape: `module.exports = async (bot, ...eventArgs) => {...}`. `loadEvents.js` does `bot.on(fileName, handler.bind(null, bot))`, so for `guildMemberAdd.js` the handler receives `(bot, member)`. Reference: `Events/voiceStateUpdate.js` exports `(bot, oldState, newState)`.
- Intent `GUILD_MEMBERS` is already enabled in `main.js` (`intents = 3276799`, bit 1 set) — do not change intents.
- Reuse the existing `config.mobutuRoleId` (from `config.js`, env var `MOBUTU_ROLE_ID`). Do NOT add a new env var.
- Commit messages end with the trailer:
  ```
  Co-Authored-By: Claude <noreply@anthropic.com>
  ```
- Do not run the bot yourself (no Discord token in this environment); the human runs/deploys.

---

## File Structure

- **Create** `Events/guildMemberAdd.js` — the handler (one responsibility: auto-add the MOBUTU role on join, with safe error handling).
- `config.js`, `Loader/loadEvents.js`, `main.js` — **unchanged** (already generic / already expose what's needed).

---

### Task 1: Create `Events/guildMemberAdd.js`

**Files:**
- Create: `Events/guildMemberAdd.js`

**Interfaces:**
- Consumes: `config.mobutuRoleId` (string or `undefined`), `member.guild.roles.cache`, `member.roles.add(role, reason)`.
- Produces: an event handler auto-registered by `Loader/loadEvents.js` on bot startup as `bot.on('guildMemberAdd', handler.bind(null, bot))`.

- [ ] **Step 1: Write the handler file**

Create `Events/guildMemberAdd.js` with exactly this content:

```js
const config = require('../config');

module.exports = async (bot, member) => {
    const mobutuRoleId = config.mobutuRoleId;

    if (!mobutuRoleId) {
        console.warn('MOBUTU_ROLE_ID non configuré — auto-assign du rôle ignoré.');
        return;
    }

    const role = member.guild.roles.cache.get(mobutuRoleId);
    if (!role) {
        console.warn(`Rôle MOBUTU ${mobutuRoleId} introuvable sur ${member.guild.name}.`);
        return;
    }

    try {
        await member.roles.add(role, 'Auto-assign MOBUTU (cible /mobutu par défaut)');
        console.log(`Rôle MOBUTU ajouté à ${member.user.tag} (${member.guild.name}).`);
    } catch (err) {
        console.error(`Impossible d'auto-assigner le rôle MOBUTU à ${member.user.tag}:`, err);
    }
};
```

- [ ] **Step 2: Verify the file loads without syntax errors and exports a function**

Run: `node -e "const h = require('./Events/guildMemberAdd.js'); console.log(typeof h)"`
Expected: prints `function` and exits 0. A SyntaxError means a typo — fix and rerun.

- [ ] **Step 3: Verify it handles the missing-config / missing-role path without crashing**

Run:
```
node -e "const h = require('./Events/guildMemberAdd.js'); const fakeMember = { guild: { name: 'test', roles: { cache: { get: () => null } } }, user: { tag: 't#0001' }, roles: { add: async () => { throw new Error('should not be called') } } }; h(null, fakeMember).then(() => console.log('ok'))"
```
Expected (if `config.mobutuRoleId` is unset locally): prints `MOBUTU_ROLE_ID non configuré — auto-assign du rôle ignoré.` then `ok`, exits 0. If the env var happens to be set, it instead prints `Rôle MOBUTU <id> introuvable sur test.` then `ok`, exits 0. Either way no throw — confirms both early-return branches are safe and `roles.add` is never called when the role isn't resolved.

- [ ] **Step 4: Verify the happy path calls `roles.add` with the right role + reason**

Run:
```
node -e "const h = require('./Events/guildMemberAdd.js'); const fakeRole = { id: 'r1' }; let added = null; const fakeMember = { guild: { name: 'test', roles: { cache: { get: (id) => id === 'r1' ? fakeRole : null } } }, user: { tag: 't#0001' }, roles: { add: async (role, reason) => { added = { role, reason }; } } }; (async () => { await h(null, fakeMember); console.log('added:', JSON.stringify(added)); })()"
```
Expected (if `config.mobutuRoleId` is unset locally): prints `MOBUTU_ROLE_ID non configuré...` and `added: null` — because locally the env var is unset, the handler returns early. To exercise the happy path, set the var inline:
```
MOBUTU_ROLE_ID=r1 node -e "const h = require('./Events/guildMemberAdd.js'); const fakeRole = { id: 'r1' }; let added = null; const fakeMember = { guild: { name: 'test', roles: { cache: { get: (id) => id === 'r1' ? fakeRole : null } } }, user: { tag: 't#0001' }, roles: { add: async (role, reason) => { added = { role, reason }; } } }; (async () => { await h(null, fakeMember); console.log('added:', JSON.stringify(added)); })()"
```
Expected: prints `Rôle MOBUTU ajouté à t#0001 (test).` and `added: {"role":{"id":"r1"},"reason":"Auto-assign MOBUTU (cible /mobutu par défaut)"}` — confirms the role is resolved from `config.mobutuRoleId` and `roles.add` is called with the role object and the exact reason string.

- [ ] **Step 5: Commit**

```bash
git add Events/guildMemberAdd.js
git commit -m "Feat: auto-assign MOBUTU role on member join

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Manual end-to-end verification (operator-run, no commit)

**Files:** none (verification only)

**Prerequisites:** operator has a Discord test server, the bot invited with **Manage Roles** permission, `MOBUTU_ROLE_ID` set in the host `.env` to the target role's ID, the MOBUTU role positioned **above** member roles and **below** the bot's highest role.

- [ ] **Step 1: Deploy and confirm the event loads**

Operator runs: `docker compose up --build -d`, then checks logs for `Evenement guildMemberAdd.js chargé avec succès !`.

- [ ] **Step 2: Verify auto-assign on a real join**

Invite a fresh test account into the server. Within ~1s, confirm:
- The test account has the MOBUTU role (check its roles in the member list).
- The bot log shows `Rôle MOBUTU ajouté à <tag> (<server>).`.

- [ ] **Step 3: Verify missing-config safety**

Unset `MOBUTU_ROLE_ID` in the host `.env`, restart the bot (`docker compose up -d`), invite another test account. Confirm:
- The account does NOT receive the role.
- The bot log shows `MOBUTU_ROLE_ID non configuré — auto-assign du rôle ignoré.`.
- No crash, bot stays online.
Restore `MOBUTU_ROLE_ID` afterward.

- [ ] **Step 4: Verify hierarchy-error safety (optional)**

Temporarily move the MOBUTU role **above** the bot's highest role in Discord (so the bot can't assign it). Invite a test account. Confirm:
- The bot log shows `Impossible d'auto-assigner le rôle MOBUTU à <tag>: <DiscordAPIError 403 ...>`.
- No crash, bot stays online.
Restore the role hierarchy afterward.

---

## Self-Review

**Spec coverage:**
- Auto-assign on new member join via `guildMemberAdd` → Task 1 (handler) + Task 2 Step 2 (live test). ✅
- Reuse `config.mobutuRoleId`, no new env var → Task 1 uses `config.mobutuRoleId` only; no config.js change. ✅
- `MOBUTU_ROLE_ID` unset → warn + skip, no crash → Task 1 Step 3 (missing-config branch) + Task 2 Step 3 (live). ✅
- Role introuvable → warn + skip → Task 1 Step 3 (missing-role branch). ✅
- `roles.add` failure (403) → log error, no crash → Task 1 try/catch + Task 2 Step 4 (live). ✅
- No backfill, no enforcement, no new command → confirmed absent from plan. ✅
- No welcome message → handler does not send anything. ✅
- Operator prereqs (role hierarchy + Manage Roles + intent) → stated in Global Constraints / Task 2 prerequisites. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code and exact commands.

**Type consistency:** Handler signature `(bot, member)` matches `loadEvents.js`'s `bot.on(eventName, handler.bind(null, bot))` binding (same pattern as `voiceStateUpdate.js`'s `(bot, oldState, newState)`). `config.mobutuRoleId` matches the existing `config.js` field. `member.roles.add(role, reason)` and `member.guild.roles.cache.get(id)` are discord.js v14 APIs consistent with existing usage in the repo.

No issues found.