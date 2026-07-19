# Design — Commande `/mobutu`

Date : 2026-07-19

## Objectif

Commande slash `/mobutu` permettant à un administrateur de kicker en masse les
membres portant un rôle donné (les « visiteurs temporaires qui ne partent pas »),
après avoir visualisé la liste complète des ciblés et confirmé l'action.

## Permission d'accès

```js
permission: Discord.PermissionFlagsBits.Administrator
```

`loadSlashCommands.js` applique `setDefaultMemberPermissions(command.permission)`,
donc Discord n'affiche/autorise la commande que pour les membres ayant la permission
**Administrator**. Aucune vérification de rôle codée en dur : plusieurs rôles peuvent
conférer l'admin, seul le flag Discord compte. La commande ne s'affiche pas pour les
non-admins (pas de message « non autorisé »).

## Rôle cible

Double source, cohérente avec le pattern existant (rôles pokemon/chieng/pays via env) :

- **Par défaut** : variable d'environnement `MOBUTU_ROLE_ID` exposée dans `config.js`
  comme `config.mobutuRoleId`.
- **Surcharge** : option de commande `role` (type `role`, optionnelle). Si fournie,
  elle écrase `config.mobutuRoleId` pour cet appel.

Si ni l'option ni la config ne définissent un rôle → reply éphémère d'erreur.

## Options de la commande

| Option   | Type                | Requis | Rôle |
|----------|---------------------|--------|------|
| `depuis` | Integer (min 0)     | oui    | Ne kicker que les membres ayant rejoint le serveur **il y a plus de X jours** (`member.joinedTimestamp < Date.now() - X * 86_400_000`). `depuis:0` = tous les membres du rôle. |
| `role`   | Role                | non    | Surcharge `MOBUTU_ROLE_ID`. |

## Flux d'exécution

1. **Résolution du rôle cible** : `args.getRole("role") ?? config.mobutuRoleId`.
   Aucun → reply éphémere d'erreur, arrêt.
2. **Collecte** : `await guild.members.fetch()` puis filtrer :
   - `member.roles.cache.has(targetRoleId)` ;
   - `member.joinedTimestamp < now - depuis * 86_400_000`.
   Sont **ignorés** (reportés à part dans la synthèse, pas dans la liste de kick) :
   - le propriétaire du serveur ;
   - les membres non kickables (`member.kickable === false`).
3. **Cas vide** : aucun membre ciblé → embed « Personne à kicker » sans bouton, arrêt.
4. **Embed de confirmation** : reply éphémère contenant :
   - la liste **complète** des membres ciblés, découpée en plusieurs embeds
     (jusqu'à 10 par message) ;
   - chaque entrée au format `@usertag — joined YYYY-MM-DD (Zj)` ;
   - chaque embed titré `Cibles — partie X/Y` ;
   - une **ActionRow** unique avec deux boutons `✅ Confirmer` / `❌ Annuler`
     attachés au même message (en bas de la liste).
   Capacité : chunking par **budget de caractères** (~4000 chars/embed, sous
   la limite 4096 de `setDescription`) × max 9 chunks (header + 9 = 10 = limite
   Discord d'embeds par message). Capacité adaptive selon la longueur des pseudos.
   Au-delà de 9 chunks, tronquer la dernière partie avec un avertissement
   « +N non affichés, affinez `depuis` ». (Note : une version initiale fixait
   `ENTRIES_PER_EMBED=80`, abandonnée car des pseudos longs pouvaient dépasser
   la limite 4096.)
5. **Collecteur de boutons** (~60s) :
   - `❌ Annuler` ou timeout → edit du reply : « Kick annulé. »
   - `✅ Confirmer` → étape suivante.
6. **Kick** :
   - edit du reply original : « Kick en cours… » ;
   - boucle `member.kick(reason)` avec `reason = "Retrait visiteur temporaire - commande /mobutu"` ;
   - try/catch par membre : un échec n'arrête pas le lot ; on accumule les échecs.
7. **Synthèse finale** (edit du reply) : embed récapitulant :
   - nombre de kicks réussis ;
   - nombre/identité des échecs (avec raison) ;
   - nombre/identité des ignorés (owner, non-kickables).
   Aucun DM envoyé aux membres kickés.

## Gestion des erreurs / edge cases

- `MOBUTU_ROLE_ID` non configuré **et** pas d'option `role` → erreur éphémère claire.
- Rôle cible inexistant/introuvable sur le serveur → erreur éphémère.
- Liste vide après filtrage → embed informatif, pas de bouton.
- `depuis` négatif : rejeté par la validation `minValue: 0` de l'option Integer.
- Liste > ~1200 users : tronquer + avertissement (signal que `depuis` est trop large).
- Timeout du collecteur de boutons → équivalent à Annuler.
- Bot lui-même ciblé : `member.kickable === false` → ignoré et reporté.

## Config & Docker

- `config.js` : ajouter `mobutuRoleId: process.env.MOBUTU_ROLE_ID`.
- `docker-compose.yml` : ajouter `- MOBUTU_ROLE_ID=${MOBUTU_ROLE_ID}` dans `environment`.

## Fichiers impactés

- `Commandes/mobutu.js` (nouveau) — la commande.
- `config.js` — ajout de `mobutuRoleId`.
- `docker-compose.yml` — ajout de la variable `MOBUTU_ROLE_ID`.
- `Loader/loadSlashCommands.js` — inchangé (gère déjà `permission` + options).
- `Events/interactionCreate.js` — inchangé (appelle déjà `run(bot, interaction, options)`).

## Tests

Pas de framework de test dans le repo. Validation manuelle sur serveur de test :

1. Rôle dummy + quelques membres aux `joinedAt` variés (récents / anciens).
2. `/mobutu depuis:0` → tous les membres du rôle apparaissent dans la liste.
3. `/mobutu depuis:30` → seuls les membres joints il y a >30j apparaissent.
4. Vérifier que la liste **complète** est visible (multi-embeds) pour un lot > 25.
5. Confirmer → vérifier les kicks + la synthèse (réussis/échoués/ignorés).
6. Non-admin → commande invisible.
7. Owner du serveur dans le rôle → ignoré et reporté dans la synthèse.