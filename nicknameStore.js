const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'nicknames.json');
let store = {};

try {
    if (fs.existsSync(FILE)) {
        const content = fs.readFileSync(FILE, 'utf8');
        store = content ? JSON.parse(content) : {};
    }
} catch (err) {
    console.error('nicknameStore: erreur lecture fichier:', err);
    store = {};
}

const key = (guildId, userId) => `${guildId}:${userId}`;

function persist() {
    try {
        fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
    } catch (err) {
        console.error('nicknameStore: erreur écriture fichier:', err);
    }
}

module.exports = {
    setOriginal: (guildId, userId, nickname) => {
        const k = key(guildId, userId);
        if (!(k in store)) {
            store[k] = nickname === undefined ? null : nickname;
            persist();
        }
    },
    getOriginal: (guildId, userId) => {
        return store[key(guildId, userId)];
    },
    popOriginal: (guildId, userId) => {
        const k = key(guildId, userId);
        const val = store[k];
        if (k in store) {
            delete store[k];
            persist();
        }
        return val;
    }
};
