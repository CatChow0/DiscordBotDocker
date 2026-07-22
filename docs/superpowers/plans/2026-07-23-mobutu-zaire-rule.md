# ZAÏR special rule for MOBUTU_USER_ID — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `MOBUTU_USER_ID` creates a temp voice channel, force the channel name to "ZAÏR", force their own nickname to "MOBUTU", and nickname any other joiner "ENFANT DU ZAÏR".

**Architecture:** Reuse the existing "pays" channel infrastructure (`channelCountryStore` + the country branch of `applyNicknameOnJoin`) by introducing a synthetic ZAÏR country as a constant in `voiceStateUpdate.js` (not in `countries.json`, to keep the normal country pool clean). A new `config.mobutuUserId` gates the rule; the rule takes priority over the `PAYS_ROLE_ID`/commune branch in the creation block, and the country branch of `applyNicknameOnJoin` forces "MOBUTU" for the special user in a ZAÏR channel.

**Tech Stack:** Node.js 20, discord.js v14 (14.27.0), existing `config.js` + `Events/voiceStateUpdate.js` + `channelCountryStore`.

## Global Constraints

- No test framework exists in this repo. Verification is **manual** (operator runs the bot on a test server) plus `node -e` load/syntax checks. Do not invent a test runner.
- `MOBUTU_USER_ID` value is a Discord user ID string. `config.mobutuUserId` is `string | undefined`.
- The ZAÏR country data MUST be a constant in `Events/voiceStateUpdate.js`, NOT added to `countries.json` (else "ZAÏR" could be picked randomly for a normal `PAYS_ROLE_ID` user).
- Exact strings (copy verbatim): channel name `"ZAÏR"`, special-user nickname `"MOBUTU"`, other-joiner personality `"ENFANT DU ZAÏR"`, constant name `ZAIRE_COUNTRY_DATA` with `{ country: "ZAÏR", personalities: ["ENFANT DU ZAÏR"] }`.
- `config` is already required at the top of `Events/voiceStateUpdate.js` (`const config = require('../config');`).
- Commit messages end with the trailer:
  ```
  Co-Authored-By: Claude <noreply@anthropic.com>
  ```
- Do not run the bot (no Discord token in this environment); the human runs/deploys.

---

## File Structure

- **Modify** `config.js` — add `mobutuUserId: process.env.MOBUTU_USER_ID`.
- **Modify** `docker-compose.yml` — add `- MOBUTU_USER_ID=${MOBUTU_USER_ID}` to the `environment:` block.
- **Modify** `Events/voiceStateUpdate.js` — add `ZAIRE_COUNTRY_DATA` constant; add a priority branch in the creation block; force "MOBUTU" in `applyNicknameOnJoin`'s country branch.
- `countries.json` — **unchanged**.

---

### Task 1: Expose `MOBUTU_USER_ID` in config

**Files:**
- Modify: `config.js`

**Interfaces:**
- Produces: `config.mobutuUserId` (string or `undefined`), consumed by Task 3 (`Events/voiceStateUpdate.js`).

- [ ] **Step 1: Add the field to config.js**

Edit `config.js` to add `mobutuUserId` as the last field (after `mobutuRoleId`):

```js
module.exports = {
    token: process.env.DISCORD_TOKEN,
    tempVoiceChannelId: process.env.TEMP_VOICE_CHANNEL_ID,
    pokemonRoleId: process.env.POKEMON_ROLE_ID,
    chiengRoleId: process.env.CHIENG_ROLE_ID,
    paysRoleId: process.env.PAYS_ROLE_ID,
    mobutuRoleId: process.env.MOBUTU_ROLE_ID,
    mobutuUserId: process.env.MOBUTU_USER_ID
};
```

- [ ] **Step 2: Verify**

Run: `node -e "console.log(require('./config').mobutuUserId)"`
Expected: prints `undefined` (env var unset locally) and exits 0 — confirms the field exists and loads without error.

- [ ] **Step 3: Commit**

```bash
git add config.js
git commit -m "Config: expose MOBUTU_USER_ID

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Inject `MOBUTU_USER_ID` into the Docker container

**Files:**
- Modify: `docker-compose.yml` (the `environment:` block of the `discord-bot` service)

**Interfaces:**
- Produces: the `MOBUTU_USER_ID` env var inside the container, read by `config.js`.

- [ ] **Step 1: Add the env line**

Edit `docker-compose.yml`. Insert `- MOBUTU_USER_ID=${MOBUTU_USER_ID}` immediately after the `- MOBUTU_ROLE_ID=${MOBUTU_ROLE_ID}` line. The role/user ID lines should read (6-space indent before each `-`):

```yaml
      - PAYS_ROLE_ID=${PAYS_ROLE_ID}
      - MOBUTU_ROLE_ID=${MOBUTU_ROLE_ID}
      - MOBUTU_USER_ID=${MOBUTU_USER_ID}
      - AC_CONTAINER_NAME=acevo-dedicated
```

- [ ] **Step 2: Verify YAML is still valid**

Run: `docker compose -f docker-compose.yml config --quiet` (only if Docker is available locally; otherwise visually confirm the new line's 6-space indentation matches the surrounding `- VAR` lines exactly).
Expected: exits 0 / no parse error.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "Docker: inject MOBUTU_USER_ID into discord-bot service

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Wire the ZAÏR rule into `Events/voiceStateUpdate.js`

**Files:**
- Modify: `Events/voiceStateUpdate.js`

**Interfaces:**
- Consumes: `config.mobutuUserId` (Task 1), `channelCountryStore` (existing), `generateNicknameForCountry` (existing), `pick` (existing), `countries` (existing).
- Produces: modified creation logic + modified `applyNicknameOnJoin` country branch. No new exports.

This task has three edits (A: constant, B: creation branch, C: applyNicknameOnJoin guard). Do all three, then verify, then commit once.

- [ ] **Step 1 (Edit A): Add the `ZAIRE_COUNTRY_DATA` constant**

In `Events/voiceStateUpdate.js`, immediately after the `const pokemonNames = ...` block (which ends at line 25 with `);`), add:

```js

// Synthetic "pays" for the MOBUTU_USER_ID special rule (kept out of countries.json
// so it is never picked randomly for a normal PAYS_ROLE_ID user).
const ZAIRE_COUNTRY_DATA = { country: "ZAÏR", personalities: ["ENFANT DU ZAÏR"] };
```

- [ ] **Step 2 (Edit B): Add the priority branch in the creation block**

Find this block (inside `if (newState.channelId === tempVoiceChannelId)`):

```js
        if (newState.member.roles.cache.has(paysRoleId)) {
            countryData = pick(countries);
            channelName = countryData.country;
        } else {
            channelName = pick([...communeNameSet]);
        }
```

Replace it with (the new `if` branch takes priority over pays/commune):

```js
        if (config.mobutuUserId && newState.member.id === config.mobutuUserId) {
            countryData = ZAIRE_COUNTRY_DATA;
            channelName = "ZAÏR";
        } else if (newState.member.roles.cache.has(paysRoleId)) {
            countryData = pick(countries);
            channelName = countryData.country;
        } else {
            channelName = pick([...communeNameSet]);
        }
```

The rest of the creation block is unchanged — `channelCountryStore.set(result.channelId, { country: countryData.country, personalities: countryData.personalities })` will store the ZAÏR data when `countryData` is set (same as for a normal country).

- [ ] **Step 3 (Edit C): Force "MOBUTU" for the special user in `applyNicknameOnJoin`**

In `applyNicknameOnJoin`, find this line (inside the `if (countryData)` branch):

```js
        const newNickname = generateNicknameForCountry(countryData);
```

Replace it with:

```js
        const newNickname =
            (countryData.country === "ZAÏR" && config.mobutuUserId && state.member.id === config.mobutuUserId)
                ? "MOBUTU"
                : generateNicknameForCountry(countryData);
```

- `MOBUTU_USER_ID` in a ZAÏR channel → "MOBUTU".
- Any other user in a ZAÏR channel → `generateNicknameForCountry(countryData)` = `pick(["ENFANT DU ZAÏR"])` = always "ENFANT DU ZAÏR".
- Normal pays channels (France, etc.) → `countryData.country !== "ZAÏR"` → unchanged behavior.

`nicknameStore.setOriginal(...)` is already called just above this line in the same branch, so the original nickname is saved and restored on leave (existing logic, unchanged).

- [ ] **Step 4: Verify the file loads without syntax errors**

Run: `node -e "const h = require('./Events/voiceStateUpdate.js'); console.log(typeof h)"`
Expected: prints `function` and exits 0. A SyntaxError means a typo in one of the three edits — fix and rerun.

- [ ] **Step 5: Verify the ZAÏR nickname-resolution logic in isolation**

The ternary logic is embedded in a non-exported function, so test it inline by replicating exactly the condition from Edit C:

```
node -e "const config={mobutuUserId:'u1'}; const ZAIRE={country:'ZAÏR',personalities:['ENFANT DU ZAÏR']}; const FRANCE={country:'France',personalities:['Macron']}; const pick=a=>a[0]; const gen=d=>pick(d.personalities); const resolve=(d,uid)=>(d.country==='ZAÏR'&&config.mobutuUserId&&uid===config.mobutuUserId)?'MOBUTU':gen(d); console.log(resolve(ZAIRE,'u1'),resolve(ZAIRE,'other'),resolve(FRANCE,'u1'),resolve(FRANCE,'other'))"
```
Expected: `MOBUTU ENFANT DU ZAÏR Macron Macron` — i.e. special user in ZAÏR → "MOBUTU"; other in ZAÏR → "ENFANT DU ZAÏR"; special user in a normal pays channel → normal personality (not "MOBUTU"); other in normal pays channel → normal personality. This replicates the Edit C condition verbatim and confirms the four cases.

- [ ] **Step 6: Verify the creation-branch condition in isolation**

```
node -e "const config={mobutuUserId:'u1'}; const pick=a=>a[0]; const countries=[{country:'France',personalities:[]}]; const communeNameSet=['Paris - 75001']; const decide=(memberId,hasPays)=>{let countryData=null,channelName;if(config.mobutuUserId&&memberId===config.mobutuUserId){countryData={country:'ZAÏR',personalities:['ENFANT DU ZAÏR']};channelName='ZAÏR';}else if(hasPays){countryData=pick(countries);channelName=countryData.country;}else{channelName=pick([...communeNameSet]);}return{countryData,channelName};}; console.log(JSON.stringify(decide('u1',false)),JSON.stringify(decide('other',true)),JSON.stringify(decide('other',false)))"
```
Expected: `{"countryData":{"country":"ZAÏR","personalities":["ENFANT DU ZAÏR"]},"channelName":"ZAÏR"} {"countryData":{"country":"France","personalities":[]},"channelName":"France"} {"countryData":null,"channelName":"Paris - 75001"}` — i.e. special user (even without PAYS_ROLE_ID) → ZAÏR; normal pays user → France; normal non-pays user → commune. This replicates the Edit B branches verbatim.

- [ ] **Step 7: Commit**

```bash
git add Events/voiceStateUpdate.js
git commit -m "Feat: ZAIR special rule for MOBUTU_USER_ID temp channel

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Manual end-to-end verification (operator-run, no commit)

**Files:** none (verification only)

**Prerequisites:** operator has a Discord test server, the bot invited, `MOBUTU_USER_ID` set in the host `.env` to a test account's ID, and a second test account available. The `tempVoiceChannelId` trigger channel exists. Bot has `Manage Nicknames` permission (it already renames users via the pays/chieng/pokemon flows, so this is already in place).

- [ ] **Step 1: Deploy and confirm load**

Operator runs: `docker compose up --build -d`, checks logs for `Evenement voiceStateUpdate.js chargé avec succès !` and no startup error.

- [ ] **Step 2: Verify ZAÏR channel creation + MOBUTU nickname**

With the `MOBUTU_USER_ID` account, join the `tempVoiceChannelId` trigger channel. Confirm:
- A new temp voice channel named **ZAÏR** is created.
- The `MOBUTU_USER_ID` account's nickname becomes **MOBUTU**.
- Bot logs: `Salon temporaire créé: ZAÏR` and `Pseudo pays changé: MOBUTU`.

- [ ] **Step 3: Verify other-joiner gets ENFANT DU ZAÏR**

With a second account, join the ZAÏR channel. Confirm:
- The second account's nickname becomes **ENFANT DU ZAÏR**.
- Bot log: `Pseudo pays changé: ENFANT DU ZAÏR`.

- [ ] **Step 4: Verify nickname restoration on leave**

Have the second account leave the ZAÏR channel. Confirm its nickname reverts to what it was before joining. Then have `MOBUTU_USER_ID` leave. Confirm its nickname reverts too.

- [ ] **Step 5: Verify the channel is deleted when empty**

Once both accounts have left the ZAÏR channel, confirm the channel is deleted (bot log: `Salon temporaire supprimé: ZAÏR`).

- [ ] **Step 6: Verify the rule does not leak into normal pays behavior**

Unset `MOBUTU_USER_ID` in the host `.env`, restart the bot. With a normal `PAYS_ROLE_ID` account, join the trigger channel. Confirm the created channel is named after a **normal country** (France, Italie, etc. — never "ZAÏR") and that joiner nicknames are normal personalities. Restore `MOBUTU_USER_ID` afterward.

- [ ] **Step 7: Verify MOBUTU_USER_ID in a normal pays channel is NOT forced to MOBUTU**

With `MOBUTU_USER_ID` set, have a different `PAYS_ROLE_ID` account create a temp channel (→ named after a normal country, e.g. France). Then have the `MOBUTU_USER_ID` account join that France channel. Confirm the `MOBUTU_USER_ID` account gets a **France personality** (e.g. "Emmanuel Macron"), NOT "MOBUTU" — the special rule only applies to ZAÏR channels.

---

## Self-Review

**Spec coverage:**
- Channel name forced to "ZAÏR" on creation by `MOBUTU_USER_ID` → Task 3 Edit B + Task 4 Step 2. ✅
- `MOBUTU_USER_ID` nickname "MOBUTU" → Task 3 Edit C + Task 4 Step 2. ✅
- Other joiners "ENFANT DU ZAÏR" → `ZAIRE_COUNTRY_DATA.personalities = ["ENFANT DU ZAÏR"]` consumed by existing `generateNicknameForCountry` path; Task 4 Step 3. ✅
- Rule priority over pays/commune, independent of roles → Task 3 Edit B (priority `if` branch, no role check). ✅
- `config.mobutuUserId` + `MOBUTU_USER_ID` env var → Task 1 + Task 2. ✅
- ZAÏR data as a constant in voiceStateUpdate.js, NOT in countries.json → Task 3 Edit A + Global Constraints. ✅
- Normal pays behavior unchanged (ZAÏR not in random pool) → Task 4 Step 6. ✅
- `MOBUTU_USER_ID` in a normal pays channel → normal personality (guard `country === "ZAÏR"`) → Task 3 Edit C + Task 4 Step 7. ✅
- `MOBUTU_USER_ID` unset → rule inactive, no crash → guards `config.mobutuUserId &&` in both edits + Task 4 Step 6. ✅
- Nickname restore on leave → existing logic, unchanged (spec notes this). ✅
- ZAÏR channel deleted when empty → existing logic, unchanged. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code and exact commands.

**Type consistency:** `config.mobutuUserId` (Task 1) matches usage in Task 3 (`config.mobutuUserId`). `ZAIRE_COUNTRY_DATA` shape `{ country, personalities }` matches `channelCountryStore.set(...)` usage and `generateNicknameForCountry(countryData)` (which does `pick(countryData.personalities)`). Edit B sets `countryData = ZAIRE_COUNTRY_DATA` so the existing `channelCountryStore.set(result.channelId, { country: countryData.country, personalities: countryData.personalities })` stores the ZAÏR data. Edit C reads `countryData.country === "ZAÏR"` — consistent with the stored country string "ZAÏR".

No issues found.