const fs = require('fs');
const path = require('path');
const os = require('os');

const CANDIDATE_PATHS = [
    path.join(__dirname, 'nicknames.json'),
    path.join(process.cwd(), 'nicknames.json'),
    path.join(os.tmpdir(), 'nicknames.json')
];

let STORE_PATH = CANDIDATE_PATHS[0];
let persistenceEnabled = false;
let store = {};

const key = (guildId, userId) => `${guildId}:${userId}`;

function tryLoad(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            store = content ? JSON.parse(content) : {};
        }
        // Try a small write to check permission
        fs.writeFileSync(filePath, JSON.stringify(store, null, 2));
        STORE_PATH = filePath;
        persistenceEnabled = true;
        return true;
    } catch (err) {
        return false;
    }
}

// Find a writable path among candidates
for (const p of CANDIDATE_PATHS) {
    if (tryLoad(p)) break;
}

if (!persistenceEnabled) {
    console.warn('nicknameStore: aucune persistance possible, fonctionnement en mémoire (permissions manquantes).');
}

function persist() {
    if (!persistenceEnabled) return;
    try {
        fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
    } catch (err) {
        console.error('nicknameStore: erreur écriture fichier, désactivation de la persistance:', err);
        persistenceEnabled = false;
    }
}

module.exports = {
    setOriginal: (guildId, userId, nickname) => {
        const k = key(guildId, userId);
        if (!(k in store)) {
            store[k] = nickname === undefined ? null : nickname;
            try {
                persist();
            } catch (e) {
                // persist handles errors, but guard anyway
            }
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
            try {
                persist();
            } catch (e) {}
        }
        return val;
    },
    // expose for debugging
    _persistenceEnabled: () => persistenceEnabled,
    _storePath: () => STORE_PATH
};
