/**
 * Discord Bot Core Functionality
 * Implements all missing Discord bot features
 */

const { Client, GatewayIntentBits, Events, PermissionFlagsBits, SlashCommandBuilder, Routes, REST } = require('discord.js');
const axios = require('axios');
const crypto = require('crypto');
const {
  DEFAULT_SETTINGS,
  normalizeServerSettings,
  calculateLevelFromXP,
  getXPForLevel
} = require('./lib/bot-config');
const { invokeAIProvider } = require('./lib/ai-providers');

class DissidentBot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
      ]
    });
    
    this.pool = null;
    this.commandStats = new Map();
    this.messageCache = new Map();
    this.xpCooldowns = new Map();
    this.hubApiBaseUrl = (process.env.HUB_API_BASE_URL || process.env.CENTRAL_HUB_API_BASE_URL || '').replace(/\/$/, '');
    this.internalApiKey = process.env.BOT_INTERNAL_API_KEY || process.env.WEBHOOK_SECRET || '';
    this.webhookSecret = process.env.WEBHOOK_SECRET || '';
    this.ticketChannelPrefix = (process.env.TICKET_CHANNEL_PREFIX || 'ticket-').toLowerCase();
    
    this.init();
  }
  
  init() {
    // Event: Bot ready
    this.client.once(Events.ClientReady, async (readyClient) => {
      console.log(`✅ Discord bot logged in as ${readyClient.user.tag}`);
      
      // Register slash commands
      await this.registerSlashCommands();

      // Sync all current guilds to the hub so they appear in the dashboard
      await this.syncAllGuilds();
    });
    
    // Event: Guild create (bot joins server)
    this.client.on(Events.GuildCreate, async (guild) => {
      console.log(`📥 Joined guild: ${guild.name} (${guild.id})`);
      await this.initializeGuild(guild);
      await this.emitHubEvent('guild_join', {
        guild_id: guild.id,
        name: guild.name,
        icon: guild.icon,
        owner_id: guild.ownerId,
        member_count: guild.memberCount,
        channel_count: guild.channels.cache.size
      });
    });

    this.client.on(Events.GuildDelete, async (guild) => {
      await this.emitHubEvent('guild_leave', {
        guild_id: guild.id,
        name: guild.name
      });
    });
    
    // Event: Interaction create (slash commands)
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      await this.handleSlashCommand(interaction);
    });
    
    // Event: Message create (for auto-mod)
    this.client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;

      if (this.isTicketChannel(message.channel)) {
        await this.emitHubEvent('ticket_message', {
          guild_id: message.guild?.id,
          channel_id: message.channel.id,
          author_id: message.author.id,
          author_name: message.author.tag,
          content: message.content || '',
          is_staff: Boolean(message.member?.permissions?.has(PermissionFlagsBits.ManageMessages))
        });
      }

      await this.handleAutoMod(message);
      await this.handleXP(message);
    });

    this.client.on(Events.ChannelCreate, async (channel) => {
      if (!this.isTicketChannel(channel)) return;

      await this.emitHubEvent('ticket_open', {
        guild_id: channel.guild?.id,
        channel_id: channel.id,
        opener_id: this.getTicketOpenerId(channel),
        opener_name: null,
        subject: channel.topic || `Ticket ${channel.name}`,
        priority: 'normal'
      });
    });

    this.client.on(Events.ChannelDelete, async (channel) => {
      if (!this.isTicketChannel(channel)) return;

      await this.emitHubEvent('ticket_close', {
        guild_id: channel.guild?.id,
        channel_id: channel.id,
        closed_by: this.client.user?.tag || 'bot',
        reason: 'Ticket channel deleted'
      });
    });
    
    // Event: Guild member add (welcome message)
    this.client.on(Events.GuildMemberAdd, async (member) => {
      await this.handleWelcome(member);
    });
    
    // Event: Message update (edit logging)
    this.client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
      await this.logMessageEdit(oldMessage, newMessage);
    });
    
    // Event: Message delete
    this.client.on(Events.MessageDelete, async (message) => {
      await this.logMessageDelete(message);
    });
  }
  
  // Sync all current guilds to the hub on startup
  async syncAllGuilds() {
    if (!this.hubApiBaseUrl || !this.webhookSecret) {
      console.warn('⚠️  HUB_API_BASE_URL or WEBHOOK_SECRET not set — skipping guild sync');
      return;
    }
    const guilds = this.client.guilds.cache.values();
    let synced = 0;
    for (const guild of guilds) {
      try {
        // Fetch full guild details (member counts require a full fetch)
        const fullGuild = await guild.fetch().catch(() => guild);
        await this.emitHubEvent('guild_join', {
          guild_id: fullGuild.id,
          name: fullGuild.name,
          icon: fullGuild.icon,
          owner_id: fullGuild.ownerId,
          member_count: fullGuild.memberCount,
          channel_count: fullGuild.channels.cache.size,
        });
        synced++;
      } catch (err) {
        console.error(`Failed to sync guild ${guild.name}:`, err.message);
      }
    }
    console.log(`✅ Guild startup sync complete — ${synced} guild(s) synced to hub`);
  }

  // Initialize guild settings
  async initializeGuild(guild) {
    try {
      if (!this.pool) return;
      
      await this.pool.query(`
        INSERT INTO server_settings (server_id, server_name, owner_id, settings)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (server_id) DO UPDATE SET
          server_name = $2,
          updated_at = CURRENT_TIMESTAMP
      `, [
        guild.id,
        guild.name,
        guild.ownerId,
        JSON.stringify(normalizeServerSettings(DEFAULT_SETTINGS))
      ]);
      
      console.log(`✅ Initialized guild: ${guild.name}`);
    } catch (err) {
      console.error('Failed to initialize guild:', err);
    }
  }
  
  // Register slash commands
  async registerSlashCommands() {
    const commands = [
      new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option => 
          option.setName('user').setDescription('User to ban').setRequired(true))
        .addStringOption(option => 
          option.setName('reason').setDescription('Reason for ban')),
      
      new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(option => 
          option.setName('user').setDescription('User to kick').setRequired(true))
        .addStringOption(option => 
          option.setName('reason').setDescription('Reason for kick')),
      
      new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Timeout/mute a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option => 
          option.setName('user').setDescription('User to mute').setRequired(true))
        .addIntegerOption(option => 
          option.setName('duration').setDescription('Duration in minutes').setRequired(true))
        .addStringOption(option => 
          option.setName('reason').setDescription('Reason for mute')),

      new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Remove timeout from a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
          option.setName('user').setDescription('User to unmute').setRequired(true))
        .addStringOption(option =>
          option.setName('reason').setDescription('Reason for unmute')),
      
      new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option => 
          option.setName('user').setDescription('User to warn').setRequired(true))
        .addStringOption(option => 
          option.setName('reason').setDescription('Reason for warning').setRequired(true)),

      new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('View warning history for a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
          option.setName('user').setDescription('User to inspect').setRequired(true))
        .addIntegerOption(option =>
          option.setName('page').setDescription('Page number').setMinValue(1)),

      new SlashCommandBuilder()
        .setName('unwarn')
        .setDescription('Remove a specific warning by ID')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addIntegerOption(option =>
          option.setName('warning_id').setDescription('Warning ID to remove').setRequired(true))
        .addStringOption(option =>
          option.setName('reason').setDescription('Reason for removing the warning')),

      new SlashCommandBuilder()
        .setName('clearwarnings')
        .setDescription('Remove all warnings for a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
          option.setName('user').setDescription('User to clear warnings for').setRequired(true))
        .addStringOption(option =>
          option.setName('reason').setDescription('Reason for clearing warnings')),

      new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user by Discord ID')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(option =>
          option.setName('user_id').setDescription('Discord user ID to unban').setRequired(true))
        .addStringOption(option =>
          option.setName('reason').setDescription('Reason for unban')),
      
      new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear messages')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option => 
          option.setName('amount').setDescription('Number of messages').setRequired(true)),
      
      new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Get server information'),
      
      new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Get user information')
        .addUserOption(option => 
          option.setName('user').setDescription('User to check')),
      
      new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your economy balance'),
      
      new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim daily reward'),
      
      new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View XP leaderboard'),

      new SlashCommandBuilder()
        .setName('rank')
        .setDescription('View your XP rank or another member\'s rank')
        .addUserOption(option =>
          option.setName('user').setDescription('User to inspect')),

      new SlashCommandBuilder()
        .setName('help')
        .setDescription('Learn commands in simple words')
        .addStringOption(option =>
          option
            .setName('topic')
            .setDescription('Pick what you need help with')
            .addChoices(
              { name: 'quick start', value: 'quick' },
              { name: 'moderation', value: 'moderation' },
              { name: 'progression', value: 'progression' },
              { name: 'ai advisor', value: 'ai' },
              { name: 'tickets', value: 'tickets' },
              { name: 'all commands', value: 'all' }
            )),

      new SlashCommandBuilder()
        .setName('aiask')
        .setDescription('Ask a question using your personal AI provider')
        .addStringOption(option =>
          option.setName('prompt').setDescription('Question or prompt').setRequired(true).setMaxLength(1000)),

      new SlashCommandBuilder()
        .setName('aiadvisor')
        .setDescription('Ask the AI advisor using your personal AI provider')
        .addStringOption(option =>
          option.setName('prompt').setDescription('Question or prompt').setRequired(true).setMaxLength(1000)),

      new SlashCommandBuilder()
        .setName('ai-config')
        .setDescription('Show your personal AI provider status'),

      new SlashCommandBuilder()
        .setName('ai-usage')
        .setDescription('Show your current AI usage stats'),

      new SlashCommandBuilder()
        .setName('ai-disable')
        .setDescription('Disable your personal AI provider')
    ];
    
    try {
      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
      
      await rest.put(
        Routes.applicationCommands(this.client.user.id),
        { body: commands }
      );
      
      console.log(`✅ Registered ${commands.length} slash commands`);
    } catch (err) {
      console.error('Failed to register commands:', err);
    }
  }
  
  // Handle slash commands
  async handleSlashCommand(interaction) {
    const { commandName, options, guild } = interaction;
    
    // Track command usage
    this.trackCommand(commandName);
    
    try {
      switch (commandName) {
        case 'ban':
          await this.cmdBan(interaction, options);
          break;
        case 'kick':
          await this.cmdKick(interaction, options);
          break;
        case 'mute':
          await this.cmdMute(interaction, options);
          break;
        case 'unmute':
          await this.cmdUnmute(interaction, options);
          break;
        case 'warn':
          await this.cmdWarn(interaction, options);
          break;
        case 'warnings':
          await this.cmdWarnings(interaction, options);
          break;
        case 'unwarn':
          await this.cmdUnwarn(interaction, options);
          break;
        case 'clearwarnings':
          await this.cmdClearWarnings(interaction, options);
          break;
        case 'unban':
          await this.cmdUnban(interaction, options);
          break;
        case 'clear':
          await this.cmdClear(interaction, options);
          break;
        case 'serverinfo':
          await this.cmdServerInfo(interaction, guild);
          break;
        case 'userinfo':
          await this.cmdUserInfo(interaction, options);
          break;
        case 'balance':
          await this.cmdBalance(interaction);
          break;
        case 'daily':
          await this.cmdDaily(interaction);
          break;
        case 'leaderboard':
          await this.cmdLeaderboard(interaction, guild);
          break;
        case 'rank':
          await this.cmdRank(interaction, options);
          break;
        case 'help':
          await this.cmdHelp(interaction, options);
          break;
        case 'aiask':
          await this.cmdAIAsk(interaction, options);
          break;
        case 'aiadvisor':
          await this.cmdAIAsk(interaction, options, 'aiadvisor');
          break;
        case 'ai-config':
          await this.cmdAIConfig(interaction);
          break;
        case 'ai-usage':
          await this.cmdAIUsage(interaction);
          break;
        case 'ai-disable':
          await this.cmdAIDisable(interaction);
          break;
      }
    } catch (err) {
      console.error(`Command error (${commandName}):`, err);
      const payload = { content: '❌ An error occurred!', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    }
  }

  async resolveTargetMember(interaction, options) {
    const targetUser = options.getUser('user');
    if (!targetUser) return null;
    return interaction.guild.members.fetch(targetUser.id).catch(() => null);
  }

  getModerationBlockReason(interaction, target) {
    const actor = interaction.member;
    const botMember = interaction.guild.members.me;

    if (!actor || !botMember) {
      return '❌ Unable to verify permissions right now. Try again in a few seconds.';
    }

    if (target.id === interaction.user.id) {
      return '❌ You cannot moderate yourself.';
    }

    if (target.id === botMember.id) {
      return '❌ I cannot moderate myself.';
    }

    if (
      interaction.guild.ownerId !== interaction.user.id &&
      target.roles.highest.position >= actor.roles.highest.position
    ) {
      return '❌ You cannot moderate someone with an equal or higher role.';
    }

    if (target.roles.highest.position >= botMember.roles.highest.position) {
      return '❌ I cannot moderate this user due to role hierarchy.';
    }

    return null;
  }

  createCaseId() {
    const stamp = Date.now().toString(36).toUpperCase();
    const suffix = Math.floor(Math.random() * 1296).toString(36).padStart(2, '0').toUpperCase();
    return `CASE-${stamp}-${suffix}`;
  }

  formatAuditReason(reason, caseId) {
    const safeReason = String(reason || 'No reason provided').trim() || 'No reason provided';
    return `[CASE:${caseId}] ${safeReason}`;
  }

  isTicketChannel(channel) {
    if (!channel || !channel.guild || !channel.name) return false;
    return String(channel.name).toLowerCase().startsWith(this.ticketChannelPrefix);
  }

  getTicketOpenerId(channel) {
    const overwrites = channel?.permissionOverwrites?.cache;
    if (!overwrites) return null;

    for (const overwrite of overwrites.values()) {
      if (overwrite.type === 1) {
        return overwrite.id;
      }
    }

    return null;
  }

  async emitHubEvent(type, payload = {}) {
    if (!this.hubApiBaseUrl || !this.webhookSecret) {
      return;
    }

    try {
      const body = JSON.stringify({ type, payload });
      const signature = `sha256=${crypto.createHmac('sha256', this.webhookSecret).update(body).digest('hex')}`;

      await axios.post(`${this.hubApiBaseUrl}/api/webhook/bot`, body, {
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature': signature
        },
        timeout: 10000
      });
    } catch (err) {
      console.error(`Failed to emit hub event ${type}:`, err.response?.data || err.message);
    }
  }

  async getGuildSettings(guildId) {
    if (!this.pool) {
      return normalizeServerSettings(DEFAULT_SETTINGS);
    }

    const settingsResult = await this.pool.query(
      'SELECT settings FROM server_settings WHERE server_id = $1',
      [guildId]
    );

    return normalizeServerSettings(settingsResult.rows[0]?.settings);
  }

  async getWarningThresholdResult(guildId, userId) {
    if (!this.pool) return null;

    const settings = await this.getGuildSettings(guildId);
    const countResult = await this.pool.query(
      `SELECT COUNT(*) AS total
       FROM user_warnings
       WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId]
    );

    const totalWarnings = Number(countResult.rows[0]?.total || 0);
    if (totalWarnings < settings.warnings.maxWarnings) {
      return null;
    }

    return {
      settings,
      totalWarnings,
      action: settings.warnings.action,
      muteDurationMinutes: settings.warnings.muteDurationMinutes
    };
  }

  async applyWarningThresholdAction(guild, target, moderator, triggerReason) {
    const threshold = await this.getWarningThresholdResult(guild.id, target.id);
    if (!threshold) return null;

    const caseId = this.createCaseId();
    const escalationReason = `${triggerReason} | Auto action after ${threshold.totalWarnings} warnings`;

    switch (threshold.action) {
      case 'ban':
        if (!target.bannable) return null;
        await target.ban({ reason: escalationReason });
        await this.logAction(guild, 'AUTO_BAN', target.user, moderator, escalationReason, caseId);
        return `Automatic action: banned after ${threshold.totalWarnings} warnings.`;
      case 'kick':
        if (!target.kickable) return null;
        await target.kick(escalationReason);
        await this.logAction(guild, 'AUTO_KICK', target.user, moderator, escalationReason, caseId);
        return `Automatic action: kicked after ${threshold.totalWarnings} warnings.`;
      case 'mute':
      default:
        if (!target.moderatable) return null;
        await target.timeout(threshold.muteDurationMinutes * 60 * 1000, escalationReason);
        await this.logAction(
          guild,
          'AUTO_MUTE',
          target.user,
          moderator,
          `${escalationReason} (${threshold.muteDurationMinutes}m)`,
          caseId
        );
        return `Automatic action: muted for ${threshold.muteDurationMinutes} minutes after ${threshold.totalWarnings} warnings.`;
    }
  }
  
  // Ban command
  async cmdBan(interaction, options) {
    const target = await this.resolveTargetMember(interaction, options);
    const reason = options.getString('reason') || 'No reason provided';
    const caseId = this.createCaseId();
    
    if (!target) {
      return await interaction.reply({ content: '❌ User not found!', ephemeral: true });
    }
    
    const blockReason = this.getModerationBlockReason(interaction, target);
    if (blockReason) {
      return await interaction.reply({ content: blockReason, ephemeral: true });
    }

    if (!target.bannable) {
      return await interaction.reply({ content: '❌ I cannot ban this user!', ephemeral: true });
    }
    
      await target.ban({ reason });
    await this.logAction(interaction.guild, 'BAN', target.user, interaction.user, reason, caseId);
    
    await interaction.reply(`🔨 **${target.user.tag}** has been banned.\nReason: ${reason}\nCase ID: ${caseId}`);
  }
  
  // Kick command
  async cmdKick(interaction, options) {
    const target = await this.resolveTargetMember(interaction, options);
    const reason = options.getString('reason') || 'No reason provided';
    const caseId = this.createCaseId();
    
    if (!target) {
      return await interaction.reply({ content: '❌ User not found!', ephemeral: true });
    }
    
    const blockReason = this.getModerationBlockReason(interaction, target);
    if (blockReason) {
      return await interaction.reply({ content: blockReason, ephemeral: true });
    }

    if (!target.kickable) {
      return await interaction.reply({ content: '❌ I cannot kick this user!', ephemeral: true });
    }
    
    await target.kick(reason);
    await this.logAction(interaction.guild, 'KICK', target.user, interaction.user, reason, caseId);
    
    await interaction.reply(`👢 **${target.user.tag}** has been kicked.\nReason: ${reason}\nCase ID: ${caseId}`);
  }
  
  // Mute/Timeout command
  async cmdMute(interaction, options) {
    const target = await this.resolveTargetMember(interaction, options);
    const duration = options.getInteger('duration');
    const reason = options.getString('reason') || 'No reason provided';
    const caseId = this.createCaseId();
    
    if (!target) {
      return await interaction.reply({ content: '❌ User not found!', ephemeral: true });
    }
    
    if (!duration || duration < 1 || duration > 40320) {
      return await interaction.reply({
        content: '❌ Duration must be between 1 and 40320 minutes (28 days).',
        ephemeral: true
      });
    }

    const blockReason = this.getModerationBlockReason(interaction, target);
    if (blockReason) {
      return await interaction.reply({ content: blockReason, ephemeral: true });
    }

    if (!target.moderatable) {
      return await interaction.reply({ content: '❌ I cannot mute this user!', ephemeral: true });
    }
    
    const timeoutDuration = duration * 60 * 1000; // Convert to ms
    await target.timeout(timeoutDuration, reason);
    await this.logAction(interaction.guild, 'MUTE', target.user, interaction.user, `${reason} (${duration}m)`, caseId);
    
    await interaction.reply(`🔇 **${target.user.tag}** has been muted for ${duration} minutes.\nReason: ${reason}\nCase ID: ${caseId}`);
  }
  
  // Warn command
  async cmdWarn(interaction, options) {
    const target = await this.resolveTargetMember(interaction, options);
    const reason = options.getString('reason');
    const caseId = this.createCaseId();
    
    if (!target) {
      return await interaction.reply({ content: '❌ User not found!', ephemeral: true });
    }
    
    const blockReason = this.getModerationBlockReason(interaction, target);
    if (blockReason) {
      return await interaction.reply({ content: blockReason, ephemeral: true });
    }

    // Store warning in database
    if (this.pool) {
      const warningResult = await this.pool.query(`
        INSERT INTO user_warnings (user_id, guild_id, moderator_id, reason, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        RETURNING id
      `, [target.id, interaction.guild.id, interaction.user.id, reason]);

      const autoActionMessage = await this.applyWarningThresholdAction(
        interaction.guild,
        target,
        interaction.user,
        reason
      );

      await this.logAction(interaction.guild, 'WARN', target.user, interaction.user, reason, caseId);

      const warningId = warningResult.rows[0]?.id;
      const suffix = autoActionMessage ? `\n${autoActionMessage}` : '';
      return await interaction.reply(`⚠️ **${target.user.tag}** has been warned.\nReason: ${reason}\nWarning ID: ${warningId}\nCase ID: ${caseId}${suffix}`);
    }

    await this.logAction(interaction.guild, 'WARN', target.user, interaction.user, reason, caseId);
    await interaction.reply(`⚠️ **${target.user.tag}** has been warned.\nReason: ${reason}\nCase ID: ${caseId}`);
  }

  // Warnings command
  async cmdWarnings(interaction, options) {
    const target = await this.resolveTargetMember(interaction, options);
    const page = options.getInteger('page') || 1;
    const pageSize = 5;

    if (!target) {
      return await interaction.reply({ content: '❌ User not found!', ephemeral: true });
    }

    if (!this.pool) {
      return await interaction.reply({
        content: '❌ Database is unavailable right now.',
        ephemeral: true
      });
    }

    const countResult = await this.pool.query(
      `SELECT COUNT(*) AS total
       FROM user_warnings
       WHERE user_id = $1 AND guild_id = $2`,
      [target.id, interaction.guild.id]
    );

    const total = Number(countResult.rows[0]?.total || 0);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const normalizedPage = Math.min(page, pageCount);
    const offset = (normalizedPage - 1) * pageSize;

    const result = await this.pool.query(
      `SELECT id, reason, moderator_id, created_at
       FROM user_warnings
       WHERE user_id = $1 AND guild_id = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [target.id, interaction.guild.id, pageSize, offset]
    );

    if (result.rows.length === 0) {
      return await interaction.reply({
        content: `✅ **${target.user.tag}** has no warnings.`,
        ephemeral: true
      });
    }

    const lines = result.rows.map((row, i) => {
      const date = new Date(row.created_at).toLocaleString();
      return `${offset + i + 1}. [#${row.id}] ${row.reason} (by <@${row.moderator_id}> on ${date})`;
    });

    const embed = {
      title: `Warnings for ${target.user.tag}`,
      description: lines.join('\n'),
      color: 0xF1C40F,
      footer: {
        text: `Page ${normalizedPage}/${pageCount} • ${total} total warnings`
      },
      timestamp: new Date().toISOString()
    };

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  async cmdUnwarn(interaction, options) {
    const warningId = options.getInteger('warning_id');
    const reason = options.getString('reason') || 'No reason provided';
    const caseId = this.createCaseId();

    if (!this.pool) {
      return await interaction.reply({ content: '❌ Database is unavailable right now.', ephemeral: true });
    }

    const result = await this.pool.query(
      `DELETE FROM user_warnings
       WHERE id = $1 AND guild_id = $2
       RETURNING user_id`,
      [warningId, interaction.guild.id]
    );

    if (result.rows.length === 0) {
      return await interaction.reply({ content: '❌ Warning not found for this server.', ephemeral: true });
    }

    await this.logAction(
      interaction.guild,
      'UNWARN',
      { id: result.rows[0].user_id },
      interaction.user,
      `Removed warning #${warningId}: ${reason}`,
      caseId
    );

    await interaction.reply(`✅ Removed warning #${warningId}.\nReason: ${reason}\nCase ID: ${caseId}`);
  }

  async cmdClearWarnings(interaction, options) {
    const target = await this.resolveTargetMember(interaction, options);
    const reason = options.getString('reason') || 'No reason provided';
    const caseId = this.createCaseId();

    if (!target) {
      return await interaction.reply({ content: '❌ User not found!', ephemeral: true });
    }

    if (!this.pool) {
      return await interaction.reply({ content: '❌ Database is unavailable right now.', ephemeral: true });
    }

    const result = await this.pool.query(
      `DELETE FROM user_warnings
       WHERE guild_id = $1 AND user_id = $2
       RETURNING id`,
      [interaction.guild.id, target.id]
    );

    if (result.rows.length === 0) {
      return await interaction.reply({ content: `✅ **${target.user.tag}** has no warnings to clear.`, ephemeral: true });
    }

    await this.logAction(
      interaction.guild,
      'CLEAR_WARNINGS',
      target.user,
      interaction.user,
      `Cleared ${result.rows.length} warnings: ${reason}`,
      caseId
    );

    await interaction.reply(`✅ Cleared ${result.rows.length} warnings for **${target.user.tag}**.\nReason: ${reason}\nCase ID: ${caseId}`);
  }

  // Unmute command
  async cmdUnmute(interaction, options) {
    const target = await this.resolveTargetMember(interaction, options);
    const reason = options.getString('reason') || 'No reason provided';
    const caseId = this.createCaseId();

    if (!target) {
      return await interaction.reply({ content: '❌ User not found!', ephemeral: true });
    }

    const blockReason = this.getModerationBlockReason(interaction, target);
    if (blockReason) {
      return await interaction.reply({ content: blockReason, ephemeral: true });
    }

    if (!target.moderatable) {
      return await interaction.reply({ content: '❌ I cannot unmute this user!', ephemeral: true });
    }

    await target.timeout(null, reason);
    await this.logAction(interaction.guild, 'UNMUTE', target.user, interaction.user, reason, caseId);

    await interaction.reply(`🔊 **${target.user.tag}** has been unmuted.\nReason: ${reason}\nCase ID: ${caseId}`);
  }

  // Unban command
  async cmdUnban(interaction, options) {
    const userId = options.getString('user_id');
    const reason = options.getString('reason') || 'No reason provided';
    const caseId = this.createCaseId();

    if (!/^\d{17,20}$/.test(userId || '')) {
      return await interaction.reply({
        content: '❌ Please provide a valid Discord user ID.',
        ephemeral: true
      });
    }

    const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
    if (!ban) {
      return await interaction.reply({
        content: '❌ This user is not currently banned.',
        ephemeral: true
      });
    }

    await interaction.guild.members.unban(userId, reason);
    await this.logAction(interaction.guild, 'UNBAN', ban.user, interaction.user, reason, caseId);

    await interaction.reply(`🔓 **${ban.user.tag}** has been unbanned.\nReason: ${reason}\nCase ID: ${caseId}`);
  }
  
  // Clear command
  async cmdClear(interaction, options) {
    const requested = options.getInteger('amount');
    if (!requested || requested < 1) {
      return await interaction.reply({
        content: '❌ Amount must be at least 1.',
        ephemeral: true
      });
    }

    const amount = Math.min(requested, 100);
    
    await interaction.channel.bulkDelete(amount, true);
    await interaction.reply({ content: `🗑️ Deleted ${amount} messages.`, ephemeral: true });
  }
  
  // Server info command
  async cmdServerInfo(interaction, guild) {
    const embed = {
      title: guild.name,
      thumbnail: { url: guild.iconURL() },
      fields: [
        { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: 'Members', value: guild.memberCount.toString(), inline: true },
        { name: 'Channels', value: guild.channels.cache.size.toString(), inline: true },
        { name: 'Roles', value: guild.roles.cache.size.toString(), inline: true },
        { name: 'Boosts', value: guild.premiumSubscriptionCount?.toString() || '0', inline: true },
        { name: 'Created', value: guild.createdAt.toDateString(), inline: true }
      ],
      timestamp: new Date().toISOString()
    };
    
    await interaction.reply({ embeds: [embed] });
  }
  
  // User info command
  async cmdUserInfo(interaction, options) {
    const target = options.getMember('user') || interaction.member;
    
    const embed = {
      title: target.user.tag,
      thumbnail: { url: target.user.displayAvatarURL() },
      fields: [
        { name: 'ID', value: target.id, inline: true },
        { name: 'Nickname', value: target.nickname || 'None', inline: true },
        { name: 'Joined', value: target.joinedAt?.toDateString() || 'Unknown', inline: true },
        { name: 'Account Created', value: target.user.createdAt.toDateString(), inline: true },
        { name: 'Roles', value: target.roles.cache.size.toString(), inline: true }
      ],
      timestamp: new Date().toISOString()
    };
    
    await interaction.reply({ embeds: [embed] });
  }
  
  // Auto-moderation
  async handleAutoMod(message) {
    try {
      if (!this.pool) return;

      const settings = await this.getGuildSettings(message.guild.id);
      if (!settings.autoMod?.enabled) return;
      
      // Check for spam
      const userKey = `${message.guild.id}-${message.author.id}`;
      const now = Date.now();
      
      if (!this.messageCache.has(userKey)) {
        this.messageCache.set(userKey, []);
      }
      
      const userMessages = this.messageCache.get(userKey);
      userMessages.push(now);
      
      // Remove old messages (> 5 seconds)
      const cutoff = now - 5000;
      while (userMessages.length > 0 && userMessages[0] < cutoff) {
        userMessages.shift();
      }
      
      // Check spam threshold
      const threshold = settings.autoMod.spamThreshold || 5;
      if (userMessages.length > threshold) {
        await message.delete();
        await message.member.timeout(60000, 'Auto-mod: Spam detected');
        
        await message.channel.send({
          content: `🔇 **${message.author.tag}** was muted for 1 minute for spam.`
        });
        
        await this.logAction(message.guild, 'AUTO-MUTE', message.author, this.client.user, 'Spam detection');
      }
      
      // Check for invite links
      if (message.content.includes('discord.gg/') || message.content.includes('discord.com/invite/')) {
        if (!settings.autoMod.allowInvites) {
          await message.delete();
          await message.channel.send({
            content: `🚫 **${message.author.tag}**, invite links are not allowed!`
          });
        }
      }
    } catch (err) {
      console.error('Auto-mod error:', err);
    }
  }
  
  // XP System
  async handleXP(message) {
    try {
      if (!this.pool) return;

      const settings = await this.getGuildSettings(message.guild.id);
      if (!settings.xp?.enabled) return;

      const xpKey = `${message.guild.id}-${message.author.id}`;
      const cooldownUntil = this.xpCooldowns.get(xpKey) || 0;
      if (Date.now() < cooldownUntil) return;
      this.xpCooldowns.set(xpKey, Date.now() + 60 * 1000);

      const baseGain = Math.floor(Math.random() * (settings.xp.max - settings.xp.min + 1)) + settings.xp.min;
      const xpGain = Math.max(1, Math.round(baseGain * settings.xp.multiplier));

      const result = await this.pool.query(`
        INSERT INTO user_xp (user_id, guild_id, xp, level, messages, last_message)
        VALUES ($1, $2, $3, 1, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, guild_id) DO UPDATE SET
          xp = user_xp.xp + $3,
          messages = user_xp.messages + 1,
          last_message = CURRENT_TIMESTAMP
        RETURNING xp, level, messages
      `, [message.author.id, message.guild.id, xpGain]);

      const record = result.rows[0];
      const nextLevel = calculateLevelFromXP(record.xp);
      if (nextLevel !== record.level) {
        await this.pool.query(
          'UPDATE user_xp SET level = $3 WHERE user_id = $1 AND guild_id = $2',
          [message.author.id, message.guild.id, nextLevel]
        );

        const levelChannel = settings.xp.levelChannel
          ? message.guild.channels.cache.get(settings.xp.levelChannel)
          : message.channel;

        if (levelChannel?.send) {
          await levelChannel.send(
            `🎉 ${message.author}, you reached **Level ${nextLevel}** with **${record.xp} XP**!`
          ).catch(() => null);
        }
      }
      
    } catch (err) {
      console.error('XP error:', err);
    }
  }
  
  // Welcome message
  async handleWelcome(member) {
    try {
      if (!this.pool) return;

      const settings = await this.getGuildSettings(member.guild.id);
      if (!settings.welcomeMessage) return;

      const channel = (settings.welcomeChannel
        ? member.guild.channels.cache.get(settings.welcomeChannel)
        : null) || member.guild.systemChannel || member.guild.channels.cache.find(ch => ch.type === 0);
      
      if (channel) {
        await channel.send({
          content: `👋 Welcome ${member} to **${member.guild.name}**!\nCheck out the rules and enjoy your stay!`
        });
      }
    } catch (err) {
      console.error('Welcome error:', err);
    }
  }
  
  // Logging
  async logAction(guild, action, target, moderator, reason, caseId = null) {
    try {
      if (!this.pool) return;

      const auditReason = caseId
        ? this.formatAuditReason(reason, caseId)
        : (String(reason || 'No reason provided').trim() || 'No reason provided');
      
      await this.pool.query(`
        INSERT INTO audit_logs (server_id, user_id, target_id, action, reason, created_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      `, [guild.id, moderator.id, target.id, action, auditReason]);

      await this.emitHubEvent('mod_action', {
        guild_id: guild.id,
        action: String(action || '').toLowerCase(),
        target_id: target.id,
        target_name: target.tag || target.username,
        moderator_id: moderator.id,
        moderator_name: moderator.tag || moderator.username,
        reason,
        duration: null,
        case_id: caseId
      });
      
    } catch (err) {
      console.error('Logging error:', err);
    }
  }
  
  async logMessageEdit(oldMessage, newMessage) {
    if (oldMessage.author.bot) return;
    await this.logAction(oldMessage.guild, 'MESSAGE_EDIT', oldMessage.author, this.client.user, 
      `Channel: #${oldMessage.channel.name}`);
  }
  
  async logMessageDelete(message) {
    if (message.author?.bot) return;
    await this.logAction(message.guild, 'MESSAGE_DELETE', message.author, this.client.user,
      `Channel: #${message.channel.name}`);
  }
  
  // Track command usage
  trackCommand(commandName) {
    const count = this.commandStats.get(commandName) || 0;
    this.commandStats.set(commandName, count + 1);
  }
  
  // Economy commands
  async cmdBalance(interaction) {
    if (!this.pool) return;

    const settings = await this.getGuildSettings(interaction.guild.id);
    if (!settings.economy.enabled) {
      return await interaction.reply({ content: '❌ Economy is disabled for this server.', ephemeral: true });
    }
    
    const result = await this.pool.query(
      'SELECT balance FROM user_economy WHERE user_id = $1 AND guild_id = $2',
      [interaction.user.id, interaction.guild.id]
    );
    
    const balance = result.rows[0]?.balance || 0;
    await interaction.reply(`💰 Your balance: **${balance}** coins`);
  }
  
  async cmdDaily(interaction) {
    if (!this.pool) return;

    const settings = await this.getGuildSettings(interaction.guild.id);
    if (!settings.economy.enabled) {
      return await interaction.reply({ content: '❌ Economy is disabled for this server.', ephemeral: true });
    }
    
    // Check if already claimed today
    const result = await this.pool.query(
      'SELECT last_daily FROM user_economy WHERE user_id = $1 AND guild_id = $2',
      [interaction.user.id, interaction.guild.id]
    );
    
    if (result.rows.length > 0) {
      const lastDaily = new Date(result.rows[0].last_daily);
      const now = new Date();
      const hoursSince = (now - lastDaily) / (1000 * 60 * 60);
      
      if (hoursSince < 24) {
        const hoursLeft = Math.ceil(24 - hoursSince);
        return await interaction.reply({
          content: `⏰ You can claim your daily reward in **${hoursLeft} hours**!`,
          ephemeral: true
        });
      }
    }
    
    // Give daily reward
    const reward = Math.floor(Math.random() * 100) + 100;
    await this.pool.query(`
      INSERT INTO user_economy (user_id, guild_id, balance, last_daily)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, guild_id) DO UPDATE SET
        balance = user_economy.balance + $3,
        last_daily = CURRENT_TIMESTAMP
    `, [interaction.user.id, interaction.guild.id, reward]);
    
    await interaction.reply(`🎁 You claimed your daily reward: **${reward}** coins!`);
  }
  
  async cmdLeaderboard(interaction, guild) {
    if (!this.pool) return;

    const settings = await this.getGuildSettings(guild.id);
    if (!settings.xp.enabled) {
      return await interaction.reply({ content: '❌ Leveling is disabled for this server.', ephemeral: true });
    }
    
    const result = await this.pool.query(`
      SELECT user_id, xp, level
      FROM user_xp
      WHERE guild_id = $1
      ORDER BY xp DESC
      LIMIT 10
    `, [guild.id]);
    
    if (result.rows.length === 0) {
      return await interaction.reply('No leaderboard data yet!');
    }
    
    const leaderboard = result.rows.map((row, index) => 
      `${index + 1}. <@${row.user_id}> - Level ${row.level} (${row.xp}/${getXPForLevel(row.level)} XP)`
    ).join('\n');
    
    await interaction.reply(`🏆 **XP Leaderboard**\n\n${leaderboard}`);
  }

  async cmdRank(interaction, options) {
    if (!this.pool) return;

    const settings = await this.getGuildSettings(interaction.guild.id);
    if (!settings.xp.enabled) {
      return await interaction.reply({ content: '❌ Leveling is disabled for this server.', ephemeral: true });
    }

    const target = options.getUser('user') || interaction.user;
    const result = await this.pool.query(
      `SELECT xp, level, messages
       FROM user_xp
       WHERE user_id = $1 AND guild_id = $2`,
      [target.id, interaction.guild.id]
    );

    const row = result.rows[0] || { xp: 0, level: 1, messages: 0 };
    const nextLevelXp = getXPForLevel(Number(row.level) || 1);

    await interaction.reply({
      content: `📈 **${target.tag}**\nLevel: **${row.level}**\nXP: **${row.xp}/${nextLevelXp}**\nMessages: **${row.messages}**`,
      ephemeral: target.id !== interaction.user.id
    });
  }

  buildHelpMessage(topic = 'quick') {
    const normalized = String(topic || 'quick').toLowerCase();

    const sections = {
      quick: [
        '**Quick Start (Simple Guide)**',
        '',
        '1) Need moderation tools? Start with `/warn` then check `/warnings`.',
        '2) Need AI help? Run `/aiadvisor prompt:<your question>`.',
        '3) Need coins/xp? Run `/daily` and then `/rank`.',
        '',
        '**Most used commands**',
        '`/help topic:all` for full list',
        '`/help topic:moderation` for staff commands',
        '`/help topic:ai` for AI setup and usage',
      ],
      moderation: [
        '**Moderation Commands**',
        '',
        '`/warn user:<@user> reason:<why>` add warning',
        '`/warnings user:<@user>` view warning history',
        '`/unwarn warning_id:<id>` remove one warning',
        '`/clearwarnings user:<@user>` remove all warnings',
        '`/mute user:<@user> duration:<minutes>` timeout user',
        '`/unmute user:<@user>` remove timeout',
        '`/kick user:<@user>` remove from server',
        '`/ban user:<@user>` ban user',
        '`/unban user_id:<discord id>` unban by id',
        '`/clear amount:<1-100>` delete recent messages',
        '',
        'Tip: Use clear reasons so logs stay useful.'
      ],
      progression: [
        '**Progression Commands**',
        '',
        '`/daily` claim daily coins',
        '`/balance` check your coins',
        '`/rank` see your xp level',
        '`/leaderboard` see top xp users',
        '',
        'Tip: `/rank user:<@user>` checks someone else.'
      ],
      ai: [
        '**AI Advisor Commands**',
        '',
        '`/ai-config` check if your AI key is connected',
        '`/aiadvisor prompt:<question>` ask the advisor (recommended)',
        '`/aiask prompt:<question>` same as advisor command',
        '`/ai-usage` see requests/tokens used',
        '`/ai-disable` turn off your AI key',
        '',
        'If AI says "not configured", open Hub Settings and add your provider key.'
      ],
      tickets: [
        '**Ticket Help**',
        '',
        'Tickets are handled in the Hub dashboard by staff.',
        'Use the Tickets pages to view, assign, resolve, reopen, or close tickets.',
        '',
        'Fast flow for staff:',
        '1) Open ticket',
        '2) Assign to yourself',
        '3) Mark resolved when solved',
        '4) Close when fully complete',
        '',
        'Use `/help topic:all` for command list.'
      ],
      all: [
        '**All Commands**',
        '',
        '**Moderation**',
        '`/ban` `/kick` `/mute` `/unmute` `/warn` `/warnings` `/unwarn` `/clearwarnings` `/unban` `/clear`',
        '',
        '**Progression**',
        '`/balance` `/daily` `/leaderboard` `/rank`',
        '',
        '**AI**',
        '`/aiadvisor` `/aiask` `/ai-config` `/ai-usage` `/ai-disable`',
        '',
        '**Info**',
        '`/serverinfo` `/userinfo` `/help`',
      ]
    };

    return (sections[normalized] || sections.quick).join('\n');
  }

  async cmdHelp(interaction, options) {
    const topic = options?.getString('topic') || 'quick';
    const text = this.buildHelpMessage(topic);
    await interaction.reply({ content: text, ephemeral: true });
  }

  getInternalApiHeaders() {
    if (!this.internalApiKey) {
      throw new Error('BOT_INTERNAL_API_KEY or WEBHOOK_SECRET must be configured for AI commands');
    }
    return { 'X-Internal-API-Key': this.internalApiKey };
  }

  getHubApiBaseUrl() {
    if (!this.hubApiBaseUrl) {
      throw new Error('HUB_API_BASE_URL must be configured for AI commands');
    }
    return this.hubApiBaseUrl;
  }

  async fetchUserAIConfig(discordId) {
    const response = await axios.get(
      `${this.getHubApiBaseUrl()}/api/internal/ai-provider/${encodeURIComponent(discordId)}`,
      {
        headers: this.getInternalApiHeaders(),
        timeout: 10000
      }
    );
    return response.data;
  }

  async postUserAIUsage(discordId, payload) {
    await axios.post(
      `${this.getHubApiBaseUrl()}/api/internal/ai-provider/${encodeURIComponent(discordId)}/usage`,
      payload,
      {
        headers: {
          ...this.getInternalApiHeaders(),
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
  }

  async disableUserAIProvider(discordId, reason) {
    const response = await axios.post(
      `${this.getHubApiBaseUrl()}/api/internal/ai-provider/${encodeURIComponent(discordId)}/disable`,
      { reason },
      {
        headers: {
          ...this.getInternalApiHeaders(),
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    return response.data;
  }

  async getUserAIContext(discordId) {
    try {
      return await this.fetchUserAIConfig(discordId);
    } catch (err) {
      if (err.response?.status === 404) {
        return err.response.data || null;
      }
      throw err;
    }
  }

  async cmdAIConfig(interaction) {
    const config = await this.getUserAIContext(interaction.user.id);
    if (!config?.configured) {
      return interaction.reply({
        content: `AI is ${config?.status || 'not configured'} for your account. Open the Hub Settings page and add or re-enable your personal provider key.`,
        ephemeral: true
      });
    }

    const usage = config.usage || {};
    await interaction.reply({
      content: [
        `**Provider:** ${config.provider}`,
        `**Model:** ${config.model}`,
        `**Status:** ${config.status}`,
        `**Req/hour limit:** ${config.usage_limit_requests_per_hour}`,
        `**Used this hour:** ${usage.requests_this_hour || 0} requests / ${usage.tokens_this_hour || 0} tokens`,
        `**Stored key:** ${config.key_hint || 'hidden'}`
      ].join('\n'),
      ephemeral: true
    });
  }

  async cmdAIUsage(interaction) {
    const config = await this.getUserAIContext(interaction.user.id);
    if (!config) {
      return interaction.reply({
        content: 'No AI usage is available because your personal provider is not configured yet.',
        ephemeral: true
      });
    }

    const usage = config.usage || {};
    await interaction.reply({
      content: [
        `**This hour:** ${usage.requests_this_hour || 0} requests, ${usage.tokens_this_hour || 0} tokens`,
        `**Lifetime:** ${usage.lifetime_requests || 0} requests, ${usage.lifetime_tokens || 0} tokens`,
        `**Last command:** ${usage.last_command || '—'}`,
        `**Last used:** ${usage.last_used_at ? new Date(usage.last_used_at).toLocaleString() : '—'}`,
        `**Last error:** ${usage.last_error || 'none'}`
      ].join('\n'),
      ephemeral: true
    });
  }

  async cmdAIDisable(interaction) {
    const config = await this.getUserAIContext(interaction.user.id);
    if (!config?.configured) {
      return interaction.reply({
        content: 'There is no active AI provider to disable for your account.',
        ephemeral: true
      });
    }

    await this.disableUserAIProvider(interaction.user.id, 'Disabled via Discord command');
    await interaction.reply({
      content: 'Your personal AI provider has been disabled. Re-enable it from the Hub Settings page when ready.',
      ephemeral: true
    });
  }

  async cmdAIAsk(interaction, options, commandName = 'aiask') {
    const prompt = options.getString('prompt');
    if (!prompt || !String(prompt).trim()) {
      return interaction.reply({ content: 'Please provide a prompt.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const config = await this.getUserAIContext(interaction.user.id);
    if (!config?.configured) {
      return interaction.editReply('AI is not configured for your account. Open the Hub Settings page and add a personal provider key first.');
    }

    const usage = config.usage || {};
    const usedThisHour = Number(usage.requests_this_hour || 0);
    const requestLimit = Number(config.usage_limit_requests_per_hour || 0);
    if (requestLimit > 0 && usedThisHour >= requestLimit) {
      return interaction.editReply(`You have reached your hourly AI limit of ${requestLimit} requests. Try again later or raise the limit in the Hub Settings page.`);
    }

    try {
      const result = await invokeAIProvider({
        provider: config.provider,
        model: config.model,
        baseUrl: config.base_url,
        apiKey: config.api_key,
        timeout: 20000
      }, prompt);

      const tokenCount = Number(result.usage?.totalTokens || result.usage?.total_tokens || 0);
      await this.postUserAIUsage(interaction.user.id, {
        command: commandName,
        success: true,
        token_count: tokenCount
      });

      const answer = result.text || 'The provider returned an empty response.';
      await interaction.editReply(answer.slice(0, 1900));
    } catch (err) {
      const errorMessage = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Unknown AI provider error';
      await this.postUserAIUsage(interaction.user.id, {
        command: commandName,
        success: false,
        token_count: 0,
        error: errorMessage
      }).catch(() => null);
      await interaction.editReply(`AI request failed: ${errorMessage}`);
    }
  }
  
  // Login method
  async login(token) {
    return this.client.login(token);
  }
  
  // Set database pool
  setDatabasePool(pool) {
    this.pool = pool;
  }
  
  // Get client for API usage
  getClient() {
    return this.client;
  }
  
  // Get stats
  getStats() {
    return {
      guilds: this.client.guilds.cache.size,
      users: this.client.users.cache.size,
      commands: Object.fromEntries(this.commandStats)
    };
  }
}

module.exports = DissidentBot;
