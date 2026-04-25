const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'safeplaces.json');

class SafePlaceManager {
    constructor() {
        /** @type {Map<string, {creatorId: string, mode: string, type: string, destructionTime: number|null, hasHadUsers: boolean, createdAt: number}>} */
        this.safePlaces = new Map();
        // Ensure data directory exists
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        this._load();
    }

    _load() {
        try {
            if (fs.existsSync(STORE_PATH)) {
                const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
                if (data && typeof data === 'object') {
                    for (const [channelId, entry] of Object.entries(data)) {
                        this.safePlaces.set(channelId, entry);
                    }
                    console.log(`SafePlaceManager: ${this.safePlaces.size} salon(s) restauré(s) depuis le disque`);
                }
            }
        } catch (err) {
            console.error('SafePlaceManager: erreur chargement fichier:', err);
        }
    }

    _persist() {
        try {
            const data = Object.fromEntries(this.safePlaces);
            fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
        } catch (err) {
            console.error('SafePlaceManager: erreur sauvegarde fichier:', err);
        }
    }

    addSafePlace(channelId, creatorId, mode, type, destructionTime = null) {
        this.safePlaces.set(channelId, {
            creatorId,
            mode,
            type,
            destructionTime,
            hasHadUsers: false,
            createdAt: Date.now()
        });
        this._persist();
        console.log(`Safe-Place ajouté: ${channelId} (${type}, ${mode})`);
    }

    isSafePlace(channelId) {
        return this.safePlaces.has(channelId);
    }

    getSafePlace(channelId) {
        return this.safePlaces.get(channelId);
    }

    markAsUsed(channelId) {
        const safePlace = this.safePlaces.get(channelId);
        if (safePlace) {
            safePlace.hasHadUsers = true;
            this._persist();
            console.log(`Safe-Place ${channelId} marqué comme utilisé`);
        }
    }

    removeSafePlace(channelId) {
        const removed = this.safePlaces.delete(channelId);
        if (removed) {
            this._persist();
            console.log(`Safe-Place supprimé: ${channelId}`);
        }
        return removed;
    }

    getSafePlacesByCreator(creatorId) {
        const result = [];
        for (const [channelId, data] of this.safePlaces.entries()) {
            if (data.creatorId === creatorId) {
                result.push({ channelId, ...data });
            }
        }
        return result;
    }

    getAllSafePlaces() {
        const result = [];
        for (const [channelId, data] of this.safePlaces.entries()) {
            result.push({ channelId, ...data });
        }
        return result;
    }

    // Check and clean up expired time-based Safe-Places
    async checkExpiredSafePlaces(guild) {
        const now = Date.now();
        const toDelete = [];

        for (const [channelId, data] of this.safePlaces.entries()) {
            if (data.mode === 'time' && data.destructionTime && now >= data.destructionTime) {
                toDelete.push(channelId);
            }
        }

        for (const channelId of toDelete) {
            try {
                const channel = guild.channels.cache.get(channelId);
                if (channel) {
                    await channel.delete();
                    console.log(`Safe-Place expiré supprimé: ${channelId}`);
                }
                this.removeSafePlace(channelId);
            } catch (error) {
                console.error(`Erreur lors de la suppression du Safe-Place ${channelId}:`, error);
                this.removeSafePlace(channelId);
            }
        }
    }

    // Recover Safe-Place state from existing guild channels (after restart)
    recoverFromGuild(guild) {
        let recovered = 0;
        guild.channels.cache.forEach(channel => {
            // Text channels store info in their topic
            if (channel.topic && channel.topic.startsWith('SAFE_PLACE|')) {
                const [, creatorId, mode, timeOrEmpty, channelType] = channel.topic.split('|');

                if (!this.safePlaces.has(channel.id)) {
                    const destructionTime = mode === 'time' ? parseInt(timeOrEmpty) : null;
                    this.safePlaces.set(channel.id, {
                        creatorId,
                        mode,
                        type: channelType || 'text',
                        destructionTime,
                        hasHadUsers: true, // Assume it's been used since it still exists
                        createdAt: Date.now()
                    });
                    recovered++;
                }
            }

            // Voice channels: check if channel name starts with 🔒-safe-place-
            // (the naming pattern from create-safe-place.js)
            if (channel.isVoiceBased() && channel.name.startsWith('🔒-safe-place-')) {
                if (!this.safePlaces.has(channel.id)) {
                    // Can't determine creator or mode for voice-only, but mark as 'empty' mode
                    // so it gets cleaned up when empty
                    this.safePlaces.set(channel.id, {
                        creatorId: 'unknown',
                        mode: 'empty',
                        type: 'voice',
                        destructionTime: null,
                        hasHadUsers: channel.members.size > 0,
                        createdAt: channel.createdTimestamp || Date.now()
                    });
                    recovered++;
                }
            }
        });

        if (recovered > 0) {
            this._persist();
            console.log(`SafePlaceManager: ${recovered} salon(s) récupéré(s) depuis le serveur`);
        }
        return recovered;
    }
}

module.exports = new SafePlaceManager();