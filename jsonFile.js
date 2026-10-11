const fs = require('fs');

// Écrit d'abord dans un fichier temporaire puis le renomme :
// un crash pendant l'écriture ne laisse jamais un JSON tronqué.
function writeJsonAtomic(filePath, data, indent) {
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, indent));
    fs.renameSync(tmpPath, filePath);
}

module.exports = { writeJsonAtomic };
