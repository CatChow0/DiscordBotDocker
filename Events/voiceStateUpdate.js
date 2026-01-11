const Discord = require('discord.js');
const config = require('../config');
const pokedex = require('../pokedex.json');
const communes = require('../france.json');
const WorkerManager = require('../WorkerManager');
const safePlaceManager = require('../safePlaceManager');

module.exports = async (bot, oldState, newState) => {
    const workerManager = new WorkerManager();
    const tempVoiceChannelId = config.tempVoiceChannelId;
    const specificUserId = "360476690021089290";
    const nicknameUserId = "461162487270604800";
    const specificRoleId = "1426612733322985583";
    const chiengId = "635966333590437908";
    const pokemonRoleId = "1387810347636752498"; // Remplacez par l'ID du rôle pour les pseudos Pokemon

    // Fonction pour récupérer les noms des communes françaises
    const getCommuneNames = () => {
        return communes.map(commune => {
            // Convertir le nom en format "Title Case" (première lettre de chaque mot en majuscule)
            const formattedName = commune.Nom_commune
                .toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            
            // Ajouter le code postal au format "Nom - CODEPOSTAL"
            return `${formattedName} - ${commune.Code_postal}`;
        });
    };

    // Listes pour générer des pseudos Pokemon
    const prefixesPokemon = [
        "Gros",
        "Petit",
        "Grand",
        "Sale",
        "Majestueux",
        "Féroce",
        "Brillant",
        "Mystérieux",
        "Légendaire",
        "Exeptionnel",
        "Magnifique",
        "L'unique",
        "Éblouissant"
    ];

    // Fonction pour récupérer tous les noms français des Pokemon depuis le pokedex
    const getPokemonNames = () => {
        return pokedex
            .filter(pokemon => pokemon.name && pokemon.name.fr && pokemon.pokedex_id > 0) // Exclure MissingNo. et les Pokemon sans nom
            .map(pokemon => pokemon.name.fr);
    };

    const suffixesPokemon = [
        "de merde",
        "de ta mère",
        "montagneux"
    ];

    // Listes pour générer des pseudos pour chieng
    const prefixesChieng = [
        "Gros",
        "Petit",
        "Grand",
        "Sale"
    ];

    const objectsChieng = [
        "labrador",
        "chien",
        "levrier",
        "bouledogue",
        "caniche",
        "chihuahua",
        "berger allemand",
        "rottweiler",
        "husky",
        "beagle",
        "bichon",
        "teckel",
        "carlin",
        "shih tzu",
        "boxer",
        "dogue",
        "basset",
        "terrier",
        "saint bernard",
        "doberman",
        "pinscher",
        "chow chow",
        "akita",
        "samoyede",
        "shiba inu",
        "spitz",
        "loup",
        "chien-loup",
        "chien de prairie",
        "chien de traineau",
        "chien de garde",
        "chien de berger",
        "chien de chasse",
        "chien de compagnie",
        "chien de travail",
        "chien de sauvetage",
        "chien de police",
        "chien de secours",
        "chien de thérapie",
        "chien de guide",
        "chieng",
        "chien de la casse",
        "chien goulag",
        "chien de la rue",
        "chien goulue",
    ];


    // Listes pour générer des pseudos
    const prefixesMasculin = [
        "Gros",
        "Petit",
        "Grand",
        "Sale",
        "Fils de",
        "Enfant de"
    ];

    const prefixesFeminin = [
        "Grosse",
        "Petite",
        "Sale",
        "Fille de",
        "Enfant de"
    ];

    const objectsMasculin = [
        "soumis",
        "chien",
        "rat",
        "salaud",
        "enculé",
        "connard"
    ];

    const objectsFeminin = [
        "soumise",
        "chienne",
        "rat",
        "salope",
        "enculée",
        "connasse",
        "pute",
        "serpillère",
    ];

    const suffixesMasculin = [
        "de merde",
        "a foutre",
        "de ta mère",
        "noir"
    ];

    const suffixesFeminin = [
        "de merde",
        "a foutre",
        "de ta mère",
        "noire"
    ];

    // Fonction pour obtenir un nom aléatoire de la liste chieng
    const getRandomNameChieng = (list) => {
        return list[Math.floor(Math.random() * list.length)];
    };

    // Fonction pour obtenir un nom aléatoire de la liste
    const getRandomName = (list) => {
        return list[Math.floor(Math.random() * list.length)];
    };

    // Fonction pour générer un pseudo en combinant un préfix et un objet des list chieng
    const generateNicknameChieng = () => {
        const prefix = getRandomNameChieng(prefixesChieng);
        const object = getRandomNameChieng(objectsChieng);

        return `${prefix} ${object}`.trim().replace(/\s+/g, ' ');
    };

    // Fonction pour générer un pseudo Pokemon
    const generateNicknamePokemon = () => {
        const usePrefix = Math.random() > 0.3;
        const useSuffix = Math.random() > 0.3;
        
        const prefix = usePrefix ? getRandomName(prefixesPokemon) : '';
        const pokemon = getRandomName(getPokemonNames());
        const suffix = useSuffix ? getRandomName(suffixesPokemon) : '';

        return `${prefix} ${pokemon} ${suffix}`.trim().replace(/\s+/g, ' ');
    };

    // Fonction pour générer un pseudo en combinant un préfixe, un objet et un suffixe en fonction du genre
    const generateNicknameMasculin = () => {
        const usePrefix = Math.random() > 0.5;
        const useObject = Math.random() > 0.35;
        const useSuffix = Math.random() > 0.5;
    
        const prefix = usePrefix || !useObject ? getRandomName(prefixesMasculin) : '';
        const object = useObject ? getRandomName(objectsMasculin) : '';
        const suffix = useSuffix || !useObject ? getRandomName(suffixesMasculin) : '';
    
        return `${prefix} ${object} ${suffix}`.trim().replace(/\s+/g, ' ');
    };
    
    const generateNicknameFeminin = () => {
        const usePrefix = Math.random() > 0.5;
        const useObject = Math.random() > 0.35;
        const useSuffix = Math.random() > 0.5;
    
        const prefix = usePrefix || !useObject ? getRandomName(prefixesFeminin) : '';
        const object = useObject ? getRandomName(objectsFeminin) : '';
        const suffix = useSuffix || !useObject ? getRandomName(suffixesFeminin) : '';
    
        return `${prefix} ${object} ${suffix}`.trim().replace(/\s+/g, ' ');
    };

    const generateNickname = () => {
        return Math.random() < 0.5 ? generateNicknameMasculin() : generateNicknameFeminin();
    };

    // Fonction pour vérifier si le nom du salon correspond à un nom de commune française
    const isTempChannel = (channelName) => {
        const communeNames = getCommuneNames();
        return communeNames.includes(channelName);
    };

    // Fonction pour vérifier si c'est un salon sécurisé
    const isSafePlaceChannel = (channel) => {
        return channel && channel.topic && channel.topic.startsWith('SAFE_PLACE|');
    };

    // Fonction pour gérer la destruction des salons sécurisés vocaux (ancienne logique - pour compatibilité)
    const handleSafePlaceDestruction = async (channel) => {
        // Cette fonction ne traite que les salons textuels avec topic
        if (!channel.topic || !channel.topic.startsWith('SAFE_PLACE|')) return false;

        const [prefix, creatorId, destructionType, , channelType] = channel.topic.split('|');
        
        // Seuls les salons vocaux avec destruction "empty" sont concernés (mais les vocaux n'ont pas de topic)
        if (channelType === 'voice' && destructionType === 'empty' && channel.members.size === 0) {
            try {
                // Vérifier s'il y a eu au moins une personne (on peut ajouter une logique de tracking)
                await channel.delete();
                console.log(`Salon sécurisé vocal ${channel.name} supprimé automatiquement (vide)`);
                return true;
            } catch (error) {
                console.error('Erreur lors de la suppression du salon sécurisé:', error);
            }
        }
        return false;
    };

    if (newState.channelId === tempVoiceChannelId) {
        let channelName;
        const communeNames = getCommuneNames();
        
        if (newState.member.id === specificUserId) {
            // Pour l'utilisateur spécifique, choisir une commune spécifique (par exemple la dernière)
            channelName = "kinshasa - RDC";
        } else {
            // Pour les autres, choisir une commune aléatoire
            channelName = getRandomName(communeNames);
        }

        const parentCategory = newState.channel.parent;
        const permissionOverwrites = parentCategory.permissionOverwrites.cache.map(overwrite => ({
            id: overwrite.id,
            allow: overwrite.allow.toArray(),
            deny: overwrite.deny.toArray()
        }));

        // Créer le salon dans un thread séparé
        try {
            const result = await workerManager.createTempChannel(
                config.token,
                newState.guild.id,
                channelName,
                parentCategory.id,
                permissionOverwrites,
                newState.member.id
            );
            
            console.log(`Salon temporaire créé: ${result.channelName}`);
        } catch (error) {
            console.error('Erreur lors de la création du salon:', error);
            
            // Fallback: création normale si le worker échoue
            const tempChannel = await newState.guild.channels.create({
                name: channelName,
                type: Discord.ChannelType.GuildVoice,
                parent: parentCategory,
                permissionOverwrites: permissionOverwrites.map(overwrite => ({
                    id: overwrite.id,
                    allow: overwrite.allow,
                    deny: overwrite.deny
                }))
            });
            await newState.setChannel(tempChannel);
        }

        // Gérer les changements de pseudo de manière asynchrone mais avec le bot principal
        const nicknamePromises = [];

        if (newState.member.id === chiengId) {
            const newNickname = generateNicknameChieng();
            nicknamePromises.push(
                newState.member.setNickname(newNickname)
                    .then(() => console.log(`Pseudo chieng changé: ${newNickname}`))
                    .catch(error => console.error('Erreur changement pseudo chieng:', error))
            );
        }

        if (newState.member.roles.cache.has(pokemonRoleId)) {
            const newNickname = generateNicknamePokemon();
            nicknamePromises.push(
                newState.member.setNickname(newNickname)
                    .then(() => console.log(`Pseudo Pokemon changé: ${newNickname}`))
                    .catch(error => console.error('Erreur changement pseudo Pokemon:', error))
            );
        }

        if (newState.member.roles.cache.has(specificRoleId)) {
            const newNickname = generateNickname();
            nicknamePromises.push(
                newState.member.setNickname(newNickname)
                    .then(() => console.log(`Pseudo général changé: ${newNickname}`))
                    .catch(error => console.error('Erreur changement pseudo général:', error))
            );
        }

        // Exécuter tous les changements de pseudo en parallèle
        if (nicknamePromises.length > 0) {
            Promise.allSettled(nicknamePromises);
        }

    } else if (newState.channel && isTempChannel(newState.channel.name)) {
        // Gérer les changements de pseudo de manière asynchrone pour les salons existants
        const nicknamePromises = [];

        if (newState.member.id === chiengId) {
            const newNickname = generateNicknameChieng();
            nicknamePromises.push(
                newState.member.setNickname(newNickname)
                    .then(() => console.log(`Pseudo chieng changé: ${newNickname}`))
                    .catch(error => console.error('Erreur changement pseudo chieng:', error))
            );
        }

        if (newState.member.roles.cache.has(pokemonRoleId)) {
            const newNickname = generateNicknamePokemon();
            nicknamePromises.push(
                newState.member.setNickname(newNickname)
                    .then(() => console.log(`Pseudo Pokemon changé: ${newNickname}`))
                    .catch(error => console.error('Erreur changement pseudo Pokemon:', error))
            );
        }

        if (newState.member.roles.cache.has(specificRoleId)) {
            const newNickname = generateNickname();
            nicknamePromises.push(
                newState.member.setNickname(newNickname)
                    .then(() => console.log(`Pseudo général changé: ${newNickname}`))
                    .catch(error => console.error('Erreur changement pseudo général:', error))
            );
        }

        // Exécuter tous les changements de pseudo en parallèle
        if (nicknamePromises.length > 0) {
            Promise.allSettled(nicknamePromises);
        }
    }

    // Gérer les Safe-Places vocaux
    // Si quelqu'un rejoint un Safe-Place vocal, le marquer comme utilisé
    if (newState.channel && safePlaceManager.isSafePlace(newState.channel.id)) {
        const safePlace = safePlaceManager.getSafePlace(newState.channel.id);
        if (safePlace.type === 'voice' && !safePlace.hasHadUsers) {
            safePlaceManager.markAsUsed(newState.channel.id);
        }
    }

    // Supprimer le salon vide dans un thread séparé
    if (oldState.channel && isTempChannel(oldState.channel.name) && oldState.channel.members.size === 0) {
        workerManager.deleteChannel(config.token, oldState.guild.id, oldState.channel.id)
            .then(result => console.log(`Salon supprimé: ${result.message}`))
            .catch(error => {
                console.error('Erreur lors de la suppression du salon:', error);
                // Fallback: suppression normale si le worker échoue
                try {
                    oldState.channel.delete();
                } catch (fallbackError) {
                    console.error('Erreur fallback suppression:', fallbackError);
                }
            });
    }

    // Gérer la destruction des Safe-Places vocaux vides
    if (oldState.channel && oldState.channel.members.size === 0 && safePlaceManager.isSafePlace(oldState.channel.id)) {
        const safePlace = safePlaceManager.getSafePlace(oldState.channel.id);
        if (safePlace && safePlace.type === 'voice' && safePlace.mode === 'empty' && safePlace.hasHadUsers) {
            try {
                const channelName = oldState.channel.name; // Sauvegarder le nom avant suppression
                const channelId = oldState.channel.id; // Sauvegarder l'ID avant suppression
                
                safePlaceManager.removeSafePlace(oldState.channel.id);
                await oldState.channel.delete();
                console.log(`Safe-Place vocal "${channelName}" (ID: ${channelId}) supprimé automatiquement (vide après utilisation)`);
            } catch (error) {
                console.error('Erreur lors de la suppression du Safe-Place vocal:', error);
                safePlaceManager.removeSafePlace(oldState.channel.id); // Nettoyer quand même
            }
        }
    }
};

