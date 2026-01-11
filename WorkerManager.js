const { Worker } = require('worker_threads');
const path = require('path');

class WorkerManager {
    constructor() {
        this.workers = {
            channelCreation: null,
            channelDeletion: null,
            nickname: null
        };
    }

    // Créer un salon temporaire dans un thread séparé
    async createTempChannel(botToken, guildId, channelName, parentCategoryId, permissionOverwrites, userChannelId) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(path.join(__dirname, 'Workers', 'channelCreationWorker.js'));
            
            worker.postMessage({
                botToken,
                guildId,
                channelName,
                parentCategoryId,
                permissionOverwrites,
                userChannelId
            });

            worker.on('message', (result) => {
                worker.terminate();
                if (result.success) {
                    resolve(result);
                } else {
                    reject(new Error(result.error));
                }
            });

            worker.on('error', (error) => {
                worker.terminate();
                reject(error);
            });

            // Timeout après 30 secondes
            setTimeout(() => {
                worker.terminate();
                reject(new Error('Worker timeout'));
            }, 30000);
        });
    }

    // Supprimer un salon dans un thread séparé
    async deleteChannel(botToken, guildId, channelId) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(path.join(__dirname, 'Workers', 'channelDeletionWorker.js'));
            
            worker.postMessage({
                botToken,
                guildId,
                channelId
            });

            worker.on('message', (result) => {
                worker.terminate();
                if (result.success) {
                    resolve(result);
                } else {
                    reject(new Error(result.error));
                }
            });

            worker.on('error', (error) => {
                worker.terminate();
                reject(error);
            });

            // Timeout après 15 secondes
            setTimeout(() => {
                worker.terminate();
                reject(new Error('Worker timeout'));
            }, 15000);
        });
    }

    // Changer un pseudo dans un thread séparé
    async changeNickname(botToken, guildId, userId, nickname) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(path.join(__dirname, 'Workers', 'nicknameWorker.js'));
            let isResolved = false;
            
            worker.postMessage({
                botToken,
                guildId,
                userId,
                nickname
            });

            worker.on('message', (result) => {
                if (!isResolved) {
                    isResolved = true;
                    worker.terminate();
                    if (result.success) {
                        resolve(result);
                    } else {
                        reject(new Error(result.error));
                    }
                }
            });

            worker.on('error', (error) => {
                if (!isResolved) {
                    isResolved = true;
                    worker.terminate();
                    reject(error);
                }
            });

            // Timeout après 20 secondes (augmenté)
            setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    worker.terminate();
                    reject(new Error(`Worker timeout for user ${userId} with nickname ${nickname}`));
                }
            }, 20000);
        });
    }
}

module.exports = WorkerManager;
