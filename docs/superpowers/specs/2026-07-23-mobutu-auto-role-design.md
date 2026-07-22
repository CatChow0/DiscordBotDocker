# Design — Auto-assign du rôle MOBUTU à l'arrivée

Date : 2026-07-23

## Objectif

Ajouter automatiquement le rôle `MOBUTU_ROLE_ID` à tout nouveau membre qui rejoint
le serveur, afin que chaque membre soit par défaut ciblable par la commande
`/mobutu` (kick des visiteurs temporaires). Aucun admin n'a besoin d'intervenir
pour poser le rôle ; il est posé par le bot à l'arrivée.

## Périmètre

- **Auto-assign sur nouveau membre uniquement** (event `guildMemberAdd`).
- **Pas de backfill** des membres déjà présents (l'operator peut les passer via
  `/mobutu ...` ou un futur fill si besoin — hors périmètre ici).
- **Aucun enforcement de l'auto-retrait** : le rôle MOBUTU est positionné en haut
  de la hiérarchie Discord, donc un membre ne peut pas se le retirer lui-même via
  l'UI (un membre ne peut retirer que des rôles situés sous son propre rôle le
  plus haut). La défense est native Discord, le bot ne ré-ajoute pas le rôle sur
  retrait.
- **Aucune nouvelle commande**, aucun `guildMemberUpdate`, aucun store persistant.

## Architecture

Nouveau fichier `Events/guildMemberAdd.js`, chargé automatiquement par
`Loader/loadEvents.js` (qui bind `bot` en premier argument et utilise le nom de
fichier comme nom d'event : `bot.on('guildMemberAdd', handler.bind(null, bot))`).
Le handler reçoit donc `(bot, member)`.

Aucune autre dépendance ou fichier modifié. Réutilise `config.mobutuRoleId`
(déjà exposé par `config.js` via `process.env.MOBUTU_ROLE_ID`).

## Comportement détaillé

```
guildMemberAdd(bot, member):
  mobutuRoleId = config.mobutuRoleId
  if !mobutuRoleId:
    console.warn("MOBUTU_ROLE_ID non configuré — auto-assign ignoré")
    return
  role = member.guild.roles.cache.get(mobutuRoleId)
  if !role:
    console.warn(`Rôle MOBUTU ${mobutuRoleId} introuvable sur ${member.guild.name}`)
    return
  try:
    await member.roles.add(role, "Auto-assign MOBUTU (cible /mobutu par défaut)")
    console.log(`Rôle MOBUTU ajouté à ${member.user.tag} (${member.guild.name})`)
  catch err:
    console.error(`Impossible d'auto-assigner le rôle MOBUTU à ${member.user.tag}:`, err)
```

- Aucune réponse dans un salon (pas de message de bienvenue — hors périmètre).
- Aucun crash possible : tous les cas d'erreur sont attrapés et loggés.

## Prérequis opérateur (configuration Discord, pas du code)

1. `MOBUTU_ROLE_ID` défini dans le `.env` hôte (déjà requis par `/mobutu`).
2. Le rôle MOBUTU est positionné **au-dessus des rôles des membres** (déjà fait par
   l'operator) pour bloquer l'auto-retrait via l'UI.
3. Le rôle le plus haut du **bot** est positionné **au-dessus** du rôle MOBUTU, et
   le bot a la permission **Gérer les rôles** — sinon `member.roles.add` renvoie
   403 et l'auto-assign échoue (loggé, pas de crash).
4. Intent `GUILD_MEMBERS` activé — déjà le cas (`main.js` : `intents = 3276799`,
   bit 1 set).

## Edge cases

- `MOBUTU_ROLE_ID` unset → warn + skip.
- Rôle introuvable sur le serveur (ID stale) → warn + skip.
- Bot / webhook / autre bot qui rejoint → reçoit aussi le rôle (comportement par
  défaut « tout le monde » ; acceptable — `/mobutu` skip les non-kickables et le
  propriétaire de toute façon).
- Échec `roles.add` (403 hiérarchie, rate limit, etc.) → log error + continue.
- Membre qui rejoint puis quitte rapidement → pas de souci, l'event est idempotent
  côté bot (un seul `add` par event).

## Fichiers impactés

- `Events/guildMemberAdd.js` (nouveau) — le handler.
- `config.js` — inchangé (`mobutuRoleId` déjà présent).
- `Loader/loadEvents.js` — inchangé (charge déjà tout `Events/*.js`).
- `main.js` — inchangé (intents déjà OK).

## Tests

Pas de framework de test. Validation manuelle sur serveur de test :

1. Inviter un compte de test dans le serveur.
2. Vérifier que le compte reçoit le rôle MOBUTU en ~1s.
3. Vérifier le log `Rôle MOBUTU ajouté à ...`.
4. Avec `MOBUTU_ROLE_ID` unset → redémarrer, inviter un compte → warn loggé,
   aucun crash, le compte n'a pas le rôle.
5. (Optionnel) Positionner le rôle MOBUTU au-dessus du rôle du bot → inviter un
   compte → log d'erreur 403 loggé, aucun crash. (Puis restaurer la hiérarchie.)