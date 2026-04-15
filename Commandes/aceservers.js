const { PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const Docker = require('dockerode');
const fs = require('fs');
const { exec } = require('child_process');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const CONTAINER_NAME = process.env.AC_CONTAINER_NAME || 'acevo-dedicated';
const COMPOSE_DIR = process.env.AC_COMPOSE_DIR || '/home/shiba/Documents/ace';
const COMPOSE_FILE = process.env.AC_COMPOSE_FILE || '/home/shiba/Documents/ace/docker-compose.yml';
const ENV_FILE = process.env.AC_ENV_FILE || '/home/shiba/Documents/ace/.env';
const SERVICE_NAME = process.env.AC_SERVICE_NAME || 'acevo-dedicated';
const ADMIN_ROLE_ID = process.env.AC_ADMIN_ROLE_ID || '522799905073266698';

function execAsync(command, options = {}) {
    return new Promise((resolve, reject) => {
        exec(command, options, (error, stdout, stderr) => {
            if (error) {
                error.stdout = stdout;
                error.stderr = stderr;
                return reject(error);
            }
            resolve({ stdout, stderr });
        });
    });
}

function readEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Fichier .env introuvable: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const env = {};

    for (const line of lines) {
        if (!line || line.trim().startsWith('#')) continue;
        const index = line.indexOf('=');
        if (index === -1) continue;
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1);
        env[key] = value;
    }

    return { env, lines };
}

function writeEnvFile(filePath, envObject) {
    const lines = Object.entries(envObject).map(([key, value]) => `${key}=${value}`);
    fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function parseAcevoArgs(argsString) {
    const result = {
        serverconfig: null,
        seasondefinition: null
    };

    const serverMatch = argsString.match(/-serverconfig\s+([^\s]+)/);
    const seasonMatch = argsString.match(/-seasondefinition\s+([^\s]+)/);

    if (serverMatch) result.serverconfig = serverMatch[1];
    if (seasonMatch) result.seasondefinition = seasonMatch[1];

    return result;
}

function buildAcevoArgs(serverconfig, seasondefinition) {
    const parts = [];
    if (serverconfig) parts.push(`-serverconfig ${serverconfig}`);
    if (seasondefinition) parts.push(`-seasondefinition ${seasondefinition}`);
    return parts.join(' ');
}

module.exports = {
    name: 'aceservers',
    description: 'Administration du serveur Assetto Corsa EVO',
    permission: PermissionFlagsBits.Administrator,
    dm: false,
    category: 'Administration',
    options: [
        {
            name: 'action',
            description: 'Action à effectuer',
            type: 'String',
            required: true,
            choices: [
                { name: '📊 Status', value: 'status' },
                { name: '🔄 Restart', value: 'restart' },
                { name: '📋 Logs', value: 'logs' },
                { name: '✏️ Update config', value: 'update' }
            ]
        },
        {
            name: 'lines',
            description: 'Nombre de lignes de logs (1-200)',
            type: 'Integer',
            required: false,
            minValue: 1,
            maxValue: 200
        },
        {
            name: 'args',
            description: '-serverconfig ... -seasondefinition ... (copié-collé)',
            type: 'String',
            required: false
        }
    ],

    async run(bot, interaction, args) {
        try {
            if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
                return await interaction.reply({
                    content: '❌ Vous n\'avez pas les permissions nécessaires.',
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            const action = interaction.options.getString('action');
            const container = docker.getContainer(CONTAINER_NAME);

            if (action === 'status') {
                const info = await container.inspect();
                const state = info.State;
                const envData = readEnvFile(ENV_FILE);
                const acevoArgs = envData.env.ACEVO_ARGS || '';

                return await interaction.editReply({
                    content:
                        `📋 **État du serveur Assetto**\n\n` +
                        `**Container :** \`${CONTAINER_NAME}\`\n` +
                        `**Service :** \`${SERVICE_NAME}\`\n` +
                        `**Status :** \`${state.Status}\`\n` +
                        `**Running :** ${state.Running ? 'Oui' : 'Non'}\n` +
                        `**Uptime :** ${state.Running ? Math.round((Date.now() - new Date(state.StartedAt).getTime()) / 60000) + ' min' : 'N/A'}\n` +
                        `**ACEVO_ARGS** : \`${acevoArgs.slice(0, 100)}${acevoArgs.length > 100 ? '…' : ''}\``
                });
            }

            if (action === 'restart') {
                await container.restart();
                return await interaction.editReply('✅ Container redémarré.');
            }

            if (action === 'logs') {
                const lines = interaction.options.getInteger('lines') || 50;
                const logs = await container.logs({
                    stdout: true,
                    stderr: true,
                    tail: lines,
                    timestamps: true
                });

                const content = logs.toString('utf8').trim();

                if (!content) {
                    return await interaction.editReply('📭 Aucun log disponible.');
                }

                if (content.length <= 1800) {
                    return await interaction.editReply(`📋 **${lines} lignes :**\n\`\`\`\n${content}\n\`\`\``);
                }

                const attachment = new AttachmentBuilder(
                    Buffer.from(content, 'utf8'),
                    { name: `acevo-logs-${Date.now()}.txt` }
                );

                return await interaction.editReply({
                    content: `📄 Logs en fichier (${lines} lignes).`,
                    files: [attachment]
                });
            }

            if (action === 'update') {
                const newArgs = interaction.options.getString('args');

                if (!newArgs) {
                    return await interaction.editReply('❌ Fournissez `args` : `-serverconfig ... -seasondefinition ...`');
                }

                const parsed = parseAcevoArgs(newArgs);

                if (!parsed.serverconfig || !parsed.seasondefinition) {
                    return await interaction.editReply('❌ `args` doit contenir `-serverconfig` ET `-seasondefinition`.');
                }

                const envData = readEnvFile(ENV_FILE);
                envData.env.ACEVO_ARGS = buildAcevoArgs(parsed.serverconfig, parsed.seasondefinition);
                writeEnvFile(ENV_FILE, envData.env);

                const cmd = `docker compose -f "${COMPOSE_FILE}" up -d ${SERVICE_NAME}`;
                const result = await execAsync(cmd, { cwd: COMPOSE_DIR, timeout: 120000 });

                const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
                const shortOutput = output.length > 1200 ? `${output.slice(0, 1200)}…` : output;

                return await interaction.editReply({
                    content:
                        `✅ **Config mise à jour et service relancé via Compose !**\n\n` +
                        `📝 **Nouvelle ACEVO_ARGS** : \`${envData.env.ACEVO_ARGS.slice(0, 100)}${envData.env.ACEVO_ARGS.length > 100 ? '…' : ''}\`\n\n` +
                        (shortOutput ? `\`\`\`\n${shortOutput}\n\`\`\`` : '')
                });
            }

            return await interaction.editReply('❌ Action inconnue.');
        } catch (error) {
            console.error('Erreur aceservers:', error);

            const details = [
                error.message,
                error.stdout,
                error.stderr
            ].filter(Boolean).join('\n');

            const shortDetails = details.length > 1500 ? `${details.slice(0, 1500)}…` : details;

            return await interaction.editReply({
                content: `❌ Erreur : \`\`\`\n${shortDetails}\n\`\`\``
            });
        }
    }
};
