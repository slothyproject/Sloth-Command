/**
 * Discord Bot Core Functionality
 * Implements all missing Discord bot features
 */

const { Client, GatewayIntentBits, Events, PermissionFlagsBits, SlashCommandBuilder, Routes, REST } = require('discord.js');

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
    
    this.init();
  }
  
  init() {
    // Event: Bot ready
    this.client.once(Events.ClientReady, async (readyClient) => {
      console.log(`✅ Discord bot logged in as ${readyClient.user.tag}`);
      
      // Register slash commands
      await this.registerSlashCommands();
    });
    
    // Event: Guild create (bot joins server)
    this.client.on(Events.GuildCreate, async (guild) => {
      console.log(`📥 Joined guild: ${guild.name} (${guild.id})`);
      await this.initializeGuild(guild);
    });
    
    // Event: Interaction create (slash commands)
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      await this.handleSlashCommand(interaction);
    });
    
    // Event: Message create (for auto-mod)
    this.client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;
      await this.handleAutoMod(message);
      await this.handleXP(message);
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
        JSON.stringify({
          welcomeMessage: true,
          autoMod: { enabled: true, spamThreshold: 5 },
          xp: { enabled: true, min: 15, max: 25 },
          economy: { enabled: false }
        })
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
        .setName('help')
        .setDescription('Show available commands and categories')
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
        case 'help':
          await this.cmdHelp(interaction);
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
      await this.pool.query(`
        INSERT INTO user_warnings (user_id, guild_id, moderator_id, reason, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      `, [target.id, interaction.guild.id, interaction.user.id, reason]);
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
      `SELECT reason, moderator_id, created_at
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
      return `${offset + i + 1}. ${row.reason} (by <@${row.moderator_id}> on ${date})`;
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
      
      // Get guild settings
      const settingsResult = await this.pool.query(
        'SELECT settings FROM server_settings WHERE server_id = $1',
        [message.guild.id]
      );
      
      if (settingsResult.rows.length === 0) return;
      
      const settings = settingsResult.rows[0].settings;
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
      
      const settingsResult = await this.pool.query(
        'SELECT settings FROM server_settings WHERE server_id = $1',
        [message.guild.id]
      );
      
      if (settingsResult.rows.length === 0) return;
      
      const settings = settingsResult.rows[0].settings;
      if (!settings.xp?.enabled) return;
      
      const xpKey = `${message.guild.id}-${message.author.id}`;
      const xpGain = Math.floor(Math.random() * (settings.xp.max - settings.xp.min + 1)) + settings.xp.min;
      
      // Update XP in database
      await this.pool.query(`
        INSERT INTO user_xp (user_id, guild_id, xp, level, messages, last_message)
        VALUES ($1, $2, $3, 1, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, guild_id) DO UPDATE SET
          xp = user_xp.xp + $3,
          messages = user_xp.messages + 1,
          last_message = CURRENT_TIMESTAMP
      `, [message.author.id, message.guild.id, xpGain]);
      
    } catch (err) {
      console.error('XP error:', err);
    }
  }
  
  // Welcome message
  async handleWelcome(member) {
    try {
      if (!this.pool) return;
      
      const settingsResult = await this.pool.query(
        'SELECT settings FROM server_settings WHERE server_id = $1',
        [member.guild.id]
      );
      
      if (settingsResult.rows.length === 0) return;
      
      const settings = settingsResult.rows[0].settings;
      if (!settings.welcomeMessage) return;
      
      // Find system channel or first text channel
      const channel = member.guild.systemChannel || 
        member.guild.channels.cache.find(ch => ch.type === 0);
      
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
    
    const result = await this.pool.query(
      'SELECT balance FROM user_economy WHERE user_id = $1 AND guild_id = $2',
      [interaction.user.id, interaction.guild.id]
    );
    
    const balance = result.rows[0]?.balance || 0;
    await interaction.reply(`💰 Your balance: **${balance}** coins`);
  }
  
  async cmdDaily(interaction) {
    if (!this.pool) return;
    
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
      `${index + 1}. <@${row.user_id}> - Level ${row.level} (${row.xp} XP)`
    ).join('\n');
    
    await interaction.reply(`🏆 **XP Leaderboard**\n\n${leaderboard}`);
  }

  async cmdHelp(interaction) {
    const text = [
      '**Dissident Commands**',
      '',
      '**Moderation**',
      '`/ban` `/kick` `/mute` `/unmute` `/warn` `/warnings` `/unban` `/clear`',
      '',
      '**Info**',
      '`/serverinfo` `/userinfo` `/help`',
      '',
      '**Progression**',
      '`/balance` `/daily` `/leaderboard`'
    ].join('\n');

    await interaction.reply({ content: text, ephemeral: true });
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
