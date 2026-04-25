const config = require('../config');
const pokedex = require('../pokedex.json');
const communes = require('../france.json');
const channelQueue = require('../channelQueue');
const safePlaceManager = require('../safePlaceManager');
const nicknameStore = require('../nicknameStore');
const tempChannelStore = require('../tempChannelStore');

// Pre-built Sets for O(1) lookups
const communeNameSet = new Set(
    communes.map(commune => {
        const formattedName = commune.Nom_commune
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        return `${formattedName} - ${commune.Code_postal}`;
    })
);

const pokemonNames = pokedex
    .filter(p => p.name && p.name.fr && p.pokedex_id > 0)
    .map(p => p.name.fr);

// Nickname generation data
const prefixes = [
    "Gros", "Petit", "Grand", "Sale", "Majestueux", "Féroce",
    "Brillant", "Mystérieux", "Légendaire", "Exceptionnel", "Magnifique",
    "L'unique", "Éblouissant"
];

const suffixes = ["montagneux"];

const objectsChieng = [
    "labrador", "chien", "levrier", "bouledogue", "caniche", "chihuahua",
    "berger allemand", "rottweiler", "husky", "beagle", "bichon", "teckel",
    "carlin", "shih tzu", "boxer", "dogue", "basset", "terrier",
    "saint bernard", "doberman", "pinscher", "chow chow", "akita",
    "samoyede", "shiba inu", "spitz", "loup", "chien-loup",
    "chien de prairie", "chien de traineau", "chien de garde",
    "chien de berger", "chien de chasse", "chien de compagnie",
    "chien de travail", "chien de sauvetage", "chien de police",
    "chien de secours", "chien de thérapie", "chien de guide",
    "chieng", "chien de la casse", "chien des goulag",
    "chien de la rue", "chien goulue"
];

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateNicknameChieng() {
    return `${pick(prefixes)} ${pick(objectsChieng)}`.trim();
}

function generateNicknamePokemon() {
    const usePrefix = Math.random() > 0.3;
    const useSuffix = Math.random() > 0.3;
    const parts = [];
    if (usePrefix) parts.push(pick(prefixes));
    parts.push(pick(pokemonNames));
    if (useSuffix) parts.push(pick(suffixes));
    return parts.join(' ');
}

module.exports = async (bot, oldState, newState) => {
    const tempVoiceChannelId = config.tempVoiceChannelId;
    const pokemonRoleId = config.pokemonRoleId;
    const chiengRoleId = config.chiengRoleId;

    // Did the user actually change channel? (not just mute/deafen)
    const channelChanged = newState.channelId !== oldState.channelId;

    // --- Temporary channel creation ---
    if (newState.channelId === tempVoiceChannelId) {
        const channelName = pick([...communeNameSet]);

        const parentCategory = newState.channel.parent;
        const permissionOverwrites = parentCategory.permissionOverwrites.cache.map(overwrite => ({
            id: overwrite.id,
            allow: overwrite.allow.toArray(),
            deny: overwrite.deny.toArray()
        }));

        try {
            const result = await channelQueue.enqueue('create', {
                guild: newState.guild,
                channelName,
                parentCategoryId: parentCategory.id,
                permissionOverwrites,
                memberId: newState.member.id
            });
            // Track the created channel
            tempChannelStore.add(result.channelId);
            console.log(`Salon temporaire créé: ${result.channelName}`);
        } catch (error) {
            console.error('Erreur lors de la création du salon:', error);

            const tempChannel = await newState.guild.channels.create({
                name: channelName,
                type: 2,
                parent: parentCategory,
                permissionOverwrites: permissionOverwrites.map(overwrite => ({
                    id: overwrite.id,
                    allow: overwrite.allow,
                    deny: overwrite.deny
                }))
            });
            tempChannelStore.add(tempChannel.id);
            await newState.setChannel(tempChannel);
        }

        // Apply nickname on channel join
        await applyNicknameOnJoin(newState, chiengRoleId, pokemonRoleId);
    }

    // --- Only process nickname and channel tracking on actual channel changes ---
    if (channelChanged) {
        // Apply nickname when moving into an existing temp channel
        if (newState.channel && tempChannelStore.has(newState.channel.id)) {
            await applyNicknameOnJoin(newState, chiengRoleId, pokemonRoleId);
        }

        // Restore original nickname when leaving a temp channel
        if (oldState.channel && tempChannelStore.has(oldState.channel.id) &&
            (!newState.channel || !tempChannelStore.has(newState.channel.id))) {
            try {
                const original = nicknameStore.popOriginal(oldState.guild.id, oldState.member.id);
                if (original !== undefined) {
                    await oldState.member.setNickname(original)
                        .then(() => console.log(`Pseudo restauré pour ${oldState.member.id}: ${original}`))
                        .catch(err => console.error('Erreur restauration pseudo:', err));
                }
            } catch (err) {
                console.error('Erreur lors de la restauration du pseudo original:', err);
            }
        }
    }

    // --- Safe-Place voice: mark as used ---
    if (newState.channel && safePlaceManager.isSafePlace(newState.channel.id)) {
        const safePlace = safePlaceManager.getSafePlace(newState.channel.id);
        if (safePlace.type === 'voice' && !safePlace.hasHadUsers) {
            safePlaceManager.markAsUsed(newState.channel.id);
        }
    }

    // --- Empty temp channel deletion ---
    if (oldState.channel && tempChannelStore.has(oldState.channel.id) && oldState.channel.members.size === 0) {
        tempChannelStore.remove(oldState.channel.id);
        try {
            await channelQueue.enqueue('delete', {
                guild: oldState.guild,
                channelId: oldState.channel.id
            });
            console.log(`Salon temporaire supprimé: ${oldState.channel.name}`);
        } catch (error) {
            console.error('Erreur lors de la suppression du salon:', error);
            try {
                await oldState.channel.delete();
            } catch (fallbackError) {
                console.error('Erreur fallback suppression:', fallbackError);
            }
        }
    }

    // --- Safe-Place voice channel empty deletion ---
    if (oldState.channel && oldState.channel.members.size === 0 && safePlaceManager.isSafePlace(oldState.channel.id)) {
        const safePlace = safePlaceManager.getSafePlace(oldState.channel.id);
        if (safePlace && safePlace.type === 'voice' && safePlace.mode === 'empty' && safePlace.hasHadUsers) {
            const channelName = oldState.channel.name;
            const channelId = oldState.channel.id;

            safePlaceManager.removeSafePlace(channelId);
            try {
                await oldState.channel.delete();
                console.log(`Safe-Place vocal "${channelName}" (ID: ${channelId}) supprimé automatiquement (vide après utilisation)`);
            } catch (error) {
                console.error('Erreur lors de la suppression du Safe-Place vocal:', error);
            }
        }
    }
};

async function applyNicknameOnJoin(state, chiengRoleId, pokemonRoleId) {
    const promises = [];

    if (state.member.roles.cache.has(chiengRoleId)) {
        try {
            nicknameStore.setOriginal(state.guild.id, state.member.id, state.member.nickname ?? null);
        } catch (err) {
            console.error('Erreur sauvegarde pseudo original:', err);
        }
        const newNickname = generateNicknameChieng();
        promises.push(
            state.member.setNickname(newNickname)
                .then(() => console.log(`Pseudo chieng changé: ${newNickname}`))
                .catch(error => console.error('Erreur changement pseudo chieng:', error))
        );
    }

    if (state.member.roles.cache.has(pokemonRoleId)) {
        try {
            nicknameStore.setOriginal(state.guild.id, state.member.id, state.member.nickname ?? null);
        } catch (err) {
            console.error('Erreur sauvegarde pseudo original:', err);
        }
        const newNickname = generateNicknamePokemon();
        promises.push(
            state.member.setNickname(newNickname)
                .then(() => console.log(`Pseudo Pokemon changé: ${newNickname}`))
                .catch(error => console.error('Erreur changement pseudo Pokemon:', error))
        );
    }

    if (promises.length > 0) {
        await Promise.allSettled(promises);
    }
}