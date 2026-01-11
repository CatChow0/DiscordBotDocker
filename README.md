# 🤖 Discord Bot - Guide de Déploiement

Bienvenue ! Ce guide explique comment déployer le bot Discord de 3 façons différentes.

## 📋 Table des matières

1. [Déploiement Local (Windows/Mac/Linux)](#déploiement-local)
2. [Déploiement Docker Local](#déploiement-docker-local)
3. [Déploiement Portainer (Serveur)](#déploiement-portainer)

---

## 🚀 Déploiement Local

Déployer directement sur votre machine sans Docker.

### Prérequis

- **Node.js** 20+ ([télécharger](https://nodejs.org/))
- **npm** (installé avec Node.js)
- Un token Discord Bot valide
- L'ID du canal vocal temporaire utiliser comme salle d'attente

### Étapes

#### 1. Cloner le repo

```bash
git clone https://github.com/votre-user/discord-bot.git
cd discord-bot
```

#### 2. Installer les dépendances

```bash
npm install
```

#### 3. Configurer les secrets

Ouvrez `config.js` et remplissez :

```javascript
module.exports = {
    token: "votre_token_discord_ici",
    tempVoiceChannelId: "votre_channel_id_ici"
};
```

> ⚠️ **IMPORTANT** : Ne commitez JAMAIS ce fichier avec vos vrais token !

#### 4. Lancer le bot

```bash
npm start
# ou
node src/main.js
```

Vous devriez voir dans la console :
```
✅ Bot connecté à Discord
```

#### 5. Arrêter le bot

Appuyez sur **Ctrl + C**

### 📝 Alternatives de configuration

Si vous préférez utiliser les variables d'environnement (recommandé) :

**Windows PowerShell :**
```powershell
$env:DISCORD_TOKEN = "votre_token"
$env:TEMP_VOICE_CHANNEL_ID = "votre_channel_id"
npm start
```

**Linux/Mac :**
```bash
export DISCORD_TOKEN="votre_token"
export TEMP_VOICE_CHANNEL_ID="votre_channel_id"
npm start
```

---

## 🐳 Déploiement Docker Local

Déployer avec Docker sur votre machine (Windows/Mac/Linux).

### Prérequis

- **Docker Desktop** ([télécharger](https://www.docker.com/products/docker-desktop))
- Git et le repo cloné
- Token Discord et Channel ID

### Étapes

#### 1. Cloner le repo

```bash
git clone https://github.com/votre-user/discord-bot.git
cd discord-bot
```

#### 2. Modifier config.js pour les variables d'env

```javascript
module.exports = {
    token: process.env.DISCORD_TOKEN,
    tempVoiceChannelId: process.env.TEMP_VOICE_CHANNEL_ID
};
```

#### 3. Créer fichier .env (optionnel, pour test local)

```bash
# .env
DISCORD_TOKEN=votre_token_ici
TEMP_VOICE_CHANNEL_ID=votre_channel_id_ici
NODE_ENV=production
```

> ⚠️ N'oubliez pas `.env` dans `.gitignore`

#### 4. Lancer avec Docker Compose

```bash
# Démarrer le bot
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Arrêter le bot
docker-compose down
```

#### 5. Vérifier que ça marche

```bash
# Lister les containers
docker ps

# Voir les logs
docker logs -f discord-bot

# Redémarrer
docker restart discord-bot
```

### 📊 Commandes Docker utiles

```bash
# Voir tous les containers
docker ps -a

# Voir les images
docker images | grep discord

# Supprimer le container
docker rm discord-bot

# Supprimer l'image
docker rmi discord-bot:latest

# Nettoyer les resources inutilisées
docker system prune
```

---

## ☁️ Déploiement Portainer (Serveur Linux)

Déployer automatiquement sur votre serveur Linux via Portainer.

### Prérequis

- **Portainer** installé sur votre serveur ([guide d'install](https://docs.portainer.io/))
- **Accès à Portainer** (http://votre-serveur:9000)
- **GitHub repo** avec votre code
- Token Discord et Channel ID (secrets)

### Étapes

#### 1. Modifier config.js

```javascript
module.exports = {
    token: process.env.DISCORD_TOKEN,
    tempVoiceChannelId: process.env.TEMP_VOICE_CHANNEL_ID
};
```

#### 2. Mettre à jour docker-compose.yml

```yaml
services:
  discord-bot:
    build: .
    container_name: discord-bot
    restart: unless-stopped
    environment:
      - DISCORD_TOKEN=${DISCORD_TOKEN}
      - TEMP_VOICE_CHANNEL_ID=${TEMP_VOICE_CHANNEL_ID}
      - NODE_ENV=production
```

#### 3. Pousser sur GitHub

```bash
git add .
git commit -m "Setup environment variables"
git push origin main
```

#### 4. Créer une Stack dans Portainer

1. Allez sur **http://votre-serveur:9000**
2. Connectez-vous
3. **Stacks** (menu de gauche) → **+ Add Stack**
4. Remplissez :
   - **Name** : `discord-bot`
   - **Build method** : `Git repository`
   - **Repository URL** : `https://github.com/votre-user/discord-bot.git`
   - **Repository ref** : `main`
   - **Compose path** : `docker-compose.yml`

5. **Scroll down** vers **Environment variables**

#### 5. Ajouter les variables d'environnement

Cliquez **+ Add variable** pour chaque secret :

**Variable 1 :**
- Name: `DISCORD_TOKEN`
- Value: `votre_token_discord_ici`

**Variable 2 :**
- Name: `TEMP_VOICE_CHANNEL_ID`
- Value: `votre_channel_id_ici`

**Variable 3 :**
- Name: `NODE_ENV`
- Value: `production`

#### 6. Déployer

Cliquez **Deploy the Stack**

⏳ Portainer va :
- Clone GitHub
- Injecter les variables d'env
- Builder l'image Docker
- Lancer le container

**Attendez 2-3 minutes...**

#### 7. Vérifier l'état

- Allez dans **Containers**
- Le container `discord-bot` doit être en status **Running** ✅
- Cliquez dessus → **Logs** pour voir les logs du bot

### 🔄 Mettre à jour le bot

1. **Stacks** → `discord-bot`
2. Bouton **Redeploy** (en haut)
3. Cochez **Re-build image**
4. Cliquez **Redeploy**

### 🔐 Changer les secrets dans Portainer

Sans refaire tout le déploiement :

1. **Stacks** → `discord-bot` → **Edit**
2. Modifiez les variables d'env
3. Cliquez **Update the Stack**

Le container redémarrera avec les nouvelles variables.

### 📊 Monitoring

**Voir les logs en temps réel :**

1. **Containers** → `discord-bot`
2. Onglet **Logs** (auto-refresh)

**Via CLI sur le serveur :**

```bash
docker logs -f discord-bot
docker ps | grep discord-bot
docker stats discord-bot
```

---

## 📊 Comparaison des approches

|      Approche     | Setup  |    Facilité   |       Auto-update       |    Idéal pour   |
|-------------------|--------|---------------|-------------------------|-----------------|
|     **Local**     | 5 min  | ⭐⭐⭐⭐⭐ |            ❌           |  Développement  |
|  **Docker Local** | 10 min | ⭐⭐⭐⭐    |            ❌           | Test avant prod |
|   **Portainer**   | 20 min | ⭐⭐⭐⭐    | ✅ possible via Webhook |    Production   |

---

## ⚠️ Problèmes courants

### Le bot ne démarre pas

**Vérifiez les logs :**

```bash
# Local
npm start

# Docker
docker logs -f discord-bot

# Portainer
Dans l'interface → Containers → discord-bot → Logs
```

**Erreurs courantes :**

- ❌ `DISCORD_TOKEN is not defined` → Token manquant ou vide
- ❌ `Cannot find module` → Dépendances manquantes (`npm install`)
- ❌ `Invalid channel ID` → Channel ID incorrect

### Docker Desktop ne démarre pas (Windows)

1. Ouvrez **Docker Desktop** depuis le menu Démarrer
2. Attendez que l'icône Docker en bas à droite montre "Docker is running"
3. Relancez votre commande

---

## 🔒 Sécurité

### ✅ Bonnes pratiques

- ✅ Ne commitez JAMAIS `config.js` avec vos vrais tokens
- ✅ Utilisez les variables d'environnement pour les tokens
- ✅ Gardez votre token Discord confidentiel
- ✅ Utilisez `.gitignore` pour `.env`

### ❌ À ne pas faire

- ❌ Token Discord en dur dans le code
- ❌ Token dans GitHub Issues/Discussions
- ❌ Pousser `.env` sur GitHub
- ❌ Partager votre token

---

## 📚 Ressources utiles

- [Discord.js Documentation](https://discord.js.org/)
- [Docker Documentation](https://docs.docker.com/)
- [Portainer Documentation](https://docs.portainer.io/)
- [Node.js Documentation](https://nodejs.org/docs/)

---

## 💬 Support

Si vous avez des questions ou des problèmes :

1. Vérifiez les logs (voir section "Problèmes courants")
2. Consultez la documentation officielle des outils utilisés
3. Vérifiez que les prérequis sont installés

---

**Dernière mise à jour :** 11 janvier 2026
