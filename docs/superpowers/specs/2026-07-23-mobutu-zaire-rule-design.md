# Design — Règle spéciale ZAÏR pour MOBUTU_USER_ID

Date : 2026-07-23

## Objectif

Quand un user précis (`MOBUTU_USER_ID`) crée un salon temporaire (en rejoignant
le salon déclencheur `tempVoiceChannelId`), forcer :

- le nom du salon créé à **« ZAÏR »** (au lieu d'un pays ou d'une commune
  aléatoire) ;
- le nickname de `MOBUTU_USER_ID` à **« MOBUTU »** ;
- le nickname de tout autre user rejoignant ce salon ZAÏR à
  **« ENFANT DU ZAÏR »** (au lieu d'une personnalité de pays aléatoire).

La règle prime sur la logique `PAYS_ROLE_ID` / commune existante : elle se
déclenche sur l'ID de l'user, indépendamment de ses rôles (pas besoin de
`PAYS_ROLE_ID`).

## Rappel du comportement existant (PAYS_ROLE_ID)

- **Création** : quand un user rejoint `tempVoiceChannelId`, ses rôles décident
  du nom du salon créé. Avec `PAYS_ROLE_ID` → nom d'un pays aléatoire (tiré de
  `countries.json`) + le salon est marqué « pays » dans `channelCountryStore`
  (avec le pays et sa liste de personnalités). Sans `PAYS_ROLE_ID` → nom de
  commune française aléatoire, salon non marqué « pays ».
- **Renommage** (`applyNicknameOnJoin`) : dans un salon marqué « pays », tout
  user qui le rejoint (créateur inclus, peu importe ses rôles) est renommé en
  une personnalité aléatoire du pays (`pick(countryData.personalities)`). Dans
  un salon « commune », le rename suit les rôles chieng/pokemon de l'user.
- **Restauration** : à la sortie d'un salon temporaire, l'ancien nickname est
  restauré via `nicknameStore.popOriginal` (logique existante dans
  `voiceStateUpdate.js`).

## Architecture

On réutilise l'infrastructure « pays » existante (`channelCountryStore` +
chemin pays d'`applyNicknameOnJoin`) en y branchant un « pays » ZAÏR
synthétique, défini comme constante dans `voiceStateUpdate.js` (et **non** dans
`countries.json`, pour ne pas polluer le pool pays normal — sinon « ZAÏR »
pourrait sortir au hasard pour un user `PAYS_ROLE_ID` normal).

### Fichiers impactés

- `config.js` — ajout de `mobutuUserId: process.env.MOBUTU_USER_ID`.
- `docker-compose.yml` — ajout de `- MOBUTU_USER_ID=${MOBUTU_USER_ID}` dans le
  bloc `environment` du service `discord-bot`.
- `Events/voiceStateUpdate.js` —
  - nouvelle constante `ZAIRE_COUNTRY_DATA` ;
  - branchement dans le bloc de création (priorité avant le check pays/commune) ;
  - branchement dans `applyNicknameOnJoin` (forcer « MOBUTU » pour l'user
    spécial dans un salon ZAÏR).

Aucune autre dépendance. `countries.json` **inchangé**.

## Comportement détaillé

### Constante

En haut de `Events/voiceStateUpdate.js` (à côté des autres données de
génération) :

```js
const ZAIRE_COUNTRY_DATA = { country: "ZAÏR", personalities: ["ENFANT DU ZAÏR"] };
```

### Bloc de création (dans `if (newState.channelId === tempVoiceChannelId)`)

Avant le check `paysRoleId` existant, ajouter une branche prioritaire :

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

Le reste du bloc création est inchangé : `channelCountryStore.set(channelId,
countryData)` va donc stocker `{ country: "ZAÏR", personalities:
["ENFANT DU ZAÏR"] }` pour ce salon. Le rename du créateur se produit ensuite
via le chemin existant `channelChanged` → `applyNicknameOnJoin` quand l'user
est déplacé dans le nouveau salon (comportement identique au chemin pays
actuel).

### `applyNicknameOnJoin` — chemin pays

Dans la branche `if (countryData)` existante, remplacer le calcul du
`newNickname` :

```js
const newNickname =
    (countryData.country === "ZAÏR" && config.mobutuUserId && state.member.id === config.mobutuUserId)
        ? "MOBUTU"
        : generateNicknameForCountry(countryData);
```

- `MOBUTU_USER_ID` dans un salon ZAÏR → « MOBUTU ».
- Tout autre user dans un salon ZAÏR → `generateNicknameForCountry(countryData)`
  = `pick(["ENFANT DU ZAÏR"])` = toujours « ENFANT DU ZAÏR ».
- Salons pays normaux (France, etc.) → inchangé (le guard `country === "ZAÏR"`
  est faux).

`nicknameStore.setOriginal` est déjà appelé avant dans cette branche, donc
l'ancien nickname est sauvegardé et sera restauré à la sortie (logique
existante).

## Edge cases

- `MOBUTU_USER_ID` unset → `config.mobutuUserId` est falsy → la branche
  création prioritaire ne se déclenche pas, le guard dans
  `applyNicknameOnJoin` ne se déclenche pas. Logique normale, pas de crash.
- `MOBUTU_USER_ID` rejoint un salon pays normal (ex. « France » créé par un
  autre user `PAYS_ROLE_ID`) → `countryData.country === "France"` ≠ « ZAÏR » →
  nickname = personnalité France. La règle spéciale ne s'applique qu'aux
  salons ZAÏR.
- `MOBUTU_USER_ID` n'a pas `PAYS_ROLE_ID` → la règle se déclenche quand même
  (priorité sur les rôles).
- Salon ZAÏR qui se vide → supprimé comme tout salon temporaire ;
  `channelCountryStore.remove(channelId)` nettoie l'entrée ZAÏR (logique
  existante).
- `MOBUTU_USER_ID` quitte le salon ZAÏR → ancien nickname restauré (logique
  existante).
- Autres users quittent le salon ZAÏR → leur ancien nickname restauré (logique
  existante).

## Var d'env partagée

`MOBUTU_USER_ID` est introduite ici pour la règle ZAÏR. Elle sera aussi
réutilisable pour la règle `/mobutu` (autoriser cet user à lancer la commande
sans rôle admin) mise en pause — même user, même var. Hors périmètre de ce
feature (feature séparé à venir).

## Tests

Pas de framework de test. Validation manuelle sur serveur de test :

1. Configurer `MOBUTU_USER_ID` dans le `.env` hôte (ID du compte de test).
2. `MOBUTU_USER_ID` rejoint `tempVoiceChannelId` → salon créé nommé « ZAÏR »,
   son nickname devient « MOBUTU ». Vérifier les logs
   (`Salon temporaire créé: ZAÏR`, `Pseudo pays changé: MOBUTU`).
3. Un autre compte rejoint ce salon ZAÏR → son nickname devient
   « ENFANT DU ZAÏR ». Log `Pseudo pays changé: ENFANT DU ZAÏR`.
4. L'autre compte quitte le salon → son nickname précédent est restauré.
5. `MOBUTU_USER_ID` quitte le salon → son nickname précédent est restauré.
6. Le salon ZAÏR se vide → il est supprimé (log `Salon temporaire supprimé`).
7. Avec `MOBUTU_USER_ID` unset → un user `PAYS_ROLE_ID` normal crée un salon →
   nom de pays aléatoire (pas « ZAÏR »), comportement normal inchangé.
8. `MOBUTU_USER_ID` rejoint un salon pays normal créé par un autre → nickname
   = personnalité de ce pays (pas « MOBUTU »).