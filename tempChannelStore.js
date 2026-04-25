const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'tempchannels.json');

class TempChannelStore {
    constructor() {
        /** @type {Set<string>} channel IDs created by the bot */
        this.channels = new Set();
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        this._load();
    }

    _load() {
        try {
            if (fs.existsSync(STORE_PATH)) {
                const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
                if (Array.isArray(data)) {
                    data.forEach(id => this.channels.add(id));
                    console.log(`TempChannelStore: ${this.channels.size} salon(s) temporaire(s) restauré(s)`);
                }
            }
        } catch (err) {
            console.error('TempChannelStore: erreur chargement:', err);
        }
    }

    _persist() {
        try {
            fs.writeFileSync(STORE_PATH, JSON.stringify([...this.channels]));
        } catch (err) {
            console.error('TempChannelStore: erreur sauvegarde:', err);
        }
    }

    add(channelId) {
        this.channels.add(channelId);
        this._persist();
    }

    has(channelId) {
        return this.channels.has(channelId);
    }

    remove(channelId) {
        const existed = this.channels.delete(channelId);
        if (existed) this._persist();
        return existed;
    }

    // On startup, clean up empty temp channels and return count of deleted
    async cleanupEmpty(guild) {
        let deleted = 0;
        for (const channelId of [...this.channels]) {
            const channel = guild.channels.cache.get(channelId);
            if (!channel) {
                // Channel no longer exists
                this.channels.delete(channelId);
                continue;
            }
            if (channel.isVoiceBased() && channel.members.size === 0) {
                try {
                    await channel.delete();
                    deleted++;
                } catch (err) {
                    console.error(`TempChannelStore: erreur suppression ${channelId}:`, err);
                }
                this.channels.delete(channelId);
            }
        }
        this._persist();
        if (deleted > 0) {
            console.log(`TempChannelStore: ${deleted} salon(s) temporaire(s) vide(s) supprimé(s) au démarrage`);
        }
        return deleted;
    }
}

module.exports = new TempChannelStore();