// Gestionnaire des salons Safe-Place
class SafePlaceManager {
    constructor() {
        this.safePlaces = new Map(); // channelId -> {creatorId, mode, type, destructionTime?, hasHadUsers?}
    }

    // Ajouter un salon Safe-Place
    addSafePlace(channelId, creatorId, mode, type, destructionTime = null) {
        this.safePlaces.set(channelId, {
            creatorId,
            mode,
            type,
            destructionTime,
            hasHadUsers: false,
            createdAt: Date.now()
        });
        console.log(`Safe-Place ajouté: ${channelId} (${type}, ${mode})`);
    }

    // Vérifier si un salon est un Safe-Place
    isSafePlace(channelId) {
        return this.safePlaces.has(channelId);
    }

    // Obtenir les informations d'un Safe-Place
    getSafePlace(channelId) {
        return this.safePlaces.get(channelId);
    }

    // Marquer qu'un salon vocal a eu des utilisateurs
    markAsUsed(channelId) {
        const safePlace = this.safePlaces.get(channelId);
        if (safePlace) {
            safePlace.hasHadUsers = true;
            console.log(`Safe-Place ${channelId} marqué comme utilisé`);
        }
    }

    // Supprimer un Safe-Place de la liste
    removeSafePlace(channelId) {
        const removed = this.safePlaces.delete(channelId);
        if (removed) {
            console.log(`Safe-Place supprimé: ${channelId}`);
        }
        return removed;
    }

    // Obtenir tous les Safe-Places d'un créateur
    getSafePlacesByCreator(creatorId) {
        const result = [];
        for (const [channelId, data] of this.safePlaces.entries()) {
            if (data.creatorId === creatorId) {
                result.push({ channelId, ...data });
            }
        }
        return result;
    }

    // Obtenir tous les Safe-Places
    getAllSafePlaces() {
        const result = [];
        for (const [channelId, data] of this.safePlaces.entries()) {
            result.push({ channelId, ...data });
        }
        return result;
    }

    // Vérifier les salons à supprimer automatiquement
    checkExpiredSafePlaces(guild) {
        const now = Date.now();
        const toDelete = [];

        for (const [channelId, data] of this.safePlaces.entries()) {
            // Vérifier les salons avec destruction temporisée
            if (data.mode === 'time' && data.destructionTime && now >= data.destructionTime) {
                toDelete.push(channelId);
            }
        }

        // Supprimer les salons expirés
        toDelete.forEach(async (channelId) => {
            try {
                const channel = guild.channels.cache.get(channelId);
                if (channel) {
                    await channel.delete();
                    console.log(`Safe-Place expiré supprimé: ${channelId}`);
                }
                this.removeSafePlace(channelId);
            } catch (error) {
                console.error(`Erreur lors de la suppression du Safe-Place ${channelId}:`, error);
                this.removeSafePlace(channelId); // Nettoyer quand même la liste
            }
        });
    }
}

module.exports = new SafePlaceManager();
