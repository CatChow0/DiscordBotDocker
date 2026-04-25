// File d'attente asynchrone pour les opérations sur les salons Discord.
// Remplace les worker threads qui créaient un nouveau client Discord à chaque opération.
// Utilise le client principal du bot et sérialise les opérations pour éviter les rate limits.

class ChannelQueue {
    constructor() {
        /** @type {{ action: string, args: object, resolve: Function, reject: Function }[]} */
        this._queue = [];
        this._processing = false;
    }

    _processNext() {
        if (this._processing || this._queue.length === 0) return;
        this._processing = true;

        const { action, args, resolve, reject } = this._queue.shift();

        // Small delay between operations to respect rate limits
        const run = async () => {
            try {
                const result = await this._execute(action, args);
                resolve(result);
            } catch (error) {
                reject(error);
            } finally {
                this._processing = false;
                if (this._queue.length > 0) {
                    setTimeout(() => this._processNext(), 250);
                }
            }
        };

        run();
    }

    async _execute(action, args) {
        switch (action) {
            case 'create': {
                const { guild, channelName, parentCategoryId, permissionOverwrites, memberId } = args;
                const channel = await guild.channels.create({
                    name: channelName,
                    type: 2, // GuildVoice
                    parent: parentCategoryId,
                    permissionOverwrites
                });
                const member = await guild.members.fetch(memberId);
                if (member.voice.channel) {
                    await member.voice.setChannel(channel);
                }
                return { channelId: channel.id, channelName: channel.name };
            }
            case 'delete': {
                const { guild, channelId } = args;
                const channel = guild.channels.cache.get(channelId);
                if (channel) {
                    await channel.delete();
                }
                return { message: `Channel ${channelId} deleted successfully` };
            }
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }

    enqueue(action, args) {
        return new Promise((resolve, reject) => {
            this._queue.push({ action, args, resolve, reject });
            this._processNext();
        });
    }
}

module.exports = new ChannelQueue();