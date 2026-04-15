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

    const serverMatch = argsString.match(/-serverconfig\s+(\S+)/);
    const seasonMatch = argsString.match(/-seasondefinition\s+(\S+)/);

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
            name: 'serverconfig',
            description: 'Nouvelle valeur pour -serverconfig',
            type: 'String',
            required: false
        },
        {
            name: 'seasondefinition',
            description: 'Nouvelle valeur pour -seasondefinition',
            type: 'String',
            required: false
        }
    ],

    async run(bot, interaction, args) {
        try {
            if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
                return await interaction.reply({
                    content: '❌ Vous n\'avez pas les permissions nécessaires pour utiliser cette commande.',
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
                const parsed = parseAcevoArgs(acevoArgs);

                return await interaction.editReply({
                    content:
                        `📋 **État du serveur Assetto**\n\n` +
                        `**Container :** \`${CONTAINER_NAME}\`\n` +
                        `**Service Compose :** \`${SERVICE_NAME}\`\n` +
                        `**Status :** \`${state.Status}\`\n` +
                        `**Running :** ${state.Running ? 'Oui' : 'Non'}\n` +
                        `**StartedAt :** \`${state.StartedAt}\`\n` +
                        `**serverconfig :** ${parsed.serverconfig ? `\`${parsed.serverconfig.slice(0, 80)}${parsed.serverconfig.length > 80 ? '…' : ''}\`` : '`absent`'}\n` +
                        `**seasondefinition :** ${parsed.seasondefinition ? `\`${parsed.seasondefinition.slice(0, 80)}${parsed.seasondefinition.length > 80 ? '…' : ''}\`` : '`absent`'}`
                });
            }

            if (action === 'restart') {
                await container.restart();
                return await interaction.editReply({
                    content: '✅ Le container Assetto Corsa a été redémarré avec succès.'
                });
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
                    return await interaction.editReply({
                        content: '📭 Aucun log disponible.'
                    });
                }

                if (content.length <= 1800) {
                    return await interaction.editReply({
                        content: `📋 **${lines} dernières lignes :**\n\`\`\`\n${content}\n\`\`\``
                    });
                }

                const attachment = new AttachmentBuilder(
                    Buffer.from(content, 'utf8'),
                    { name: `acevo-logs-${Date.now()}.txt` }
                );

                return await interaction.editReply({
                    content: `📄 Logs trop longs pour Discord, envoi en fichier (${lines} lignes).`,
                    files: [attachment]
                });
            }

            if (action === 'update') {
                const newServerConfig = interaction.options.getString('serverconfig');
                const newSeasonDefinition = interaction.options.getString('seasondefinition');

                if (!newServerConfig && !newSeasonDefinition) {
                    return await interaction.editReply({
                        content: '❌ Vous devez fournir au moins `serverconfig` ou `seasondefinition`.'
                    });
                }

                const envData = readEnvFile(ENV_FILE);
                const currentArgs = envData.env.ACEVO_ARGS || '';
                const parsed = parseAcevoArgs(currentArgs);

                const finalServerConfig = newServerConfig || parsed.serverconfig;
                const finalSeasonDefinition = newSeasonDefinition || parsed.seasondefinition;

                if (!finalServerConfig || !finalSeasonDefinition) {
                    return await interaction.editReply({
                        content: '❌ Impossible de reconstruire `ACEVO_ARGS` correctement. Vérifiez le contenu actuel du `.env`.'
                    });
                }

                envData.env.ACEVO_ARGS = buildAcevoArgs(finalServerConfig, finalSeasonDefinition);
                writeEnvFile(ENV_FILE, envData.env);

                const cmd = `docker compose -f "${COMPOSE_FILE}" up -d --no-deps --force-recreate ${SERVICE_NAME}`;
                const result = await execAsync(cmd, { cwd: COMPOSE_DIR });

                let summary = '✅ **Configuration mise à jour et service recréé.**\n\n';
                if (newServerConfig) {
                    summary += `- \`serverconfig\` mis à jour\n`;
                }
                if (newSeasonDefinition) {
                    summary += `- \`seasondefinition\` mis à jour\n`;
                }

                const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
                if (output) {
                    const shortOutput = output.length > 1200 ? `${output.slice(0, 1200)}\n...` : output;
                    summary += `\n\`\`\`\n${shortOutput}\n\`\`\``;
                }

                return await interaction.editReply({
                    content: summary
                });
            }

            return await interaction.editReply({
                content: '❌ Action inconnue.'
            });

        } catch (error) {
            console.error('Erreur aceservers:', error);

            const details = [
                error.message,
                error.stderr,
                error.stdout
            ].filter(Boolean).join('\n');

            const shortDetails = details.length > 1500 ? `${details.slice(0, 1500)}\n...` : details;

            if (interaction.deferred) {
                return await interaction.editReply({
                    content: `❌ Une erreur est survenue.\n\`\`\`\n${shortDetails || 'Erreur inconnue'}\n\`\`\``
                });
            }

            return await interaction.reply({
                content: `❌ Une erreur est survenue.\n\`\`\`\n${shortDetails || 'Erreur inconnue'}\n\`\`\``,
                ephemeral: true
            });
        }
    }
};
