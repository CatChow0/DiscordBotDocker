const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'channelCountries.json');

class ChannelCountryStore {
    constructor() {
        /** @type {Map<string, {country: string, personalities: string[]}>} channelId -> country data */
        this.channels = new Map();
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        this._load();
    }

    _load() {
        try {
            if (fs.existsSync(STORE_PATH)) {
                const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
                if (typeof data === 'object' && data !== null) {
                    for (const [channelId, value] of Object.entries(data)) {
                        this.channels.set(channelId, value);
                    }
                    console.log(`ChannelCountryStore: ${this.channels.size} salon(s) pays restauré(s)`);
                }
            }
        } catch (err) {
            console.error('ChannelCountryStore: erreur chargement:', err);
        }
    }

    _persist() {
        try {
            const obj = Object.fromEntries(this.channels);
            fs.writeFileSync(STORE_PATH, JSON.stringify(obj, null, 2));
        } catch (err) {
            console.error('ChannelCountryStore: erreur sauvegarde:', err);
        }
    }

    set(channelId, countryData) {
        this.channels.set(channelId, countryData);
        this._persist();
    }

    get(channelId) {
        return this.channels.get(channelId);
    }

    has(channelId) {
        return this.channels.has(channelId);
    }

    remove(channelId) {
        const existed = this.channels.delete(channelId);
        if (existed) this._persist();
        return existed;
    }

    cleanupMissing(guild) {
        let removed = 0;
        for (const channelId of this.channels.keys()) {
            const channel = guild.channels.cache.get(channelId);
            if (!channel) {
                this.channels.delete(channelId);
                removed++;
            }
        }
        if (removed > 0) {
            this._persist();
            console.log(`ChannelCountryStore: ${removed} entrée(s) orpheline(s) nettoyée(s)`);
        }
        return removed;
    }
}

module.exports = new ChannelCountryStore();
