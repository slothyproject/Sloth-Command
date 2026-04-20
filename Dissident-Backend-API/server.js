// FORCE REBUILD MARKER - CHANGE THIS TO TRIGGER REBUILD: 2026-04-17-03
console.log('>>> API STARTING - VERSION 2026-04-17-03');

require('dotenv').config();

const express = require('express');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Test endpoint to verify deployment
app.get('/api/version', (req, res) => {
  res.json({ version: '2.1.0-OAUTH-DEBUG', timestamp: Date.now() });
});

// FORCE DEPLOYMENT - Version marker
console.log('🚀 DISSIDENT API v2.1.0 - OAuth Debug Build');

// Validate required environment variables
const requiredEnvVars = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please set these variables in Railway dashboard');
  process.exit(1);
}

console.log('✅ Environment variables validated');
console.log('📋 OAuth Configuration:');
console.log('   Client ID:', process.env.DISCORD_CLIENT_ID);
console.log('   Redirect URI:', process.env.DISCORD_REDIRECT_URI);
console.log('   Environment:', process.env.NODE_ENV);

// Initialize Discord bot client
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

// Database connection
let pool;
try {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL not set - database features will be disabled');
    // Create mock pool for development without database
    pool = {
      query: async () => ({ rows: [] }),
      connect: async () => ({ release: () => {} })
    };
  } else {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    console.log('✅ Database connection established');
  }
} catch (error) {
  console.error('❌ Database connection failed:', error.message);
  process.exit(1);
}

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true
}));
app.use(express.json());

// Initialize database tables
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(32) PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        discriminator VARCHAR(4),
        avatar VARCHAR(255),
        email VARCHAR(255),
        access_token TEXT,
        refresh_token TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(32) REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS server_settings (
        id SERIAL PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        server_name VARCHAR(255),
        owner_id VARCHAR(32) REFERENCES users(id),
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(server_id)
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        user_id VARCHAR(32),
        target_id VARCHAR(32),
        action VARCHAR(50) NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_warnings (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(32) NOT NULL,
        guild_id VARCHAR(32) NOT NULL,
        moderator_id VARCHAR(32) NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_xp (
        user_id VARCHAR(32) NOT NULL,
        guild_id VARCHAR(32) NOT NULL,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        messages INTEGER DEFAULT 0,
        last_message TIMESTAMP,
        PRIMARY KEY (user_id, guild_id)
      );

      CREATE TABLE IF NOT EXISTS user_economy (
        user_id VARCHAR(32) NOT NULL,
        guild_id VARCHAR(32) NOT NULL,
        balance INTEGER DEFAULT 0,
        last_daily TIMESTAMP,
        PRIMARY KEY (user_id, guild_id)
      );
    `);
    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
}

// Discord OAuth Strategy with enhanced debugging
const discordStrategyConfig = {
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_REDIRECT_URI,
  scope: ['identify', 'guilds', 'email']
};

console.log('🔧 DiscordStrategy Config:', {
  clientID: discordStrategyConfig.clientID,
  callbackURL: discordStrategyConfig.callbackURL,
  scope: discordStrategyConfig.scope
});

passport.use(new DiscordStrategy(discordStrategyConfig, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('✅ Discord OAuth callback received, profile:', profile.id);
    
    const query = `
      INSERT INTO users (id, username, discriminator, avatar, email, access_token, refresh_token)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        username = $2,
        discriminator = $3,
        avatar = $4,
        email = $5,
        access_token = $6,
        refresh_token = $7,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const values = [
      profile.id,
      profile.username,
      profile.discriminator,
      profile.avatar,
      profile.email,
      accessToken,
      refreshToken
    ];
    
    const result = await pool.query(query, values);
    const user = result.rows[0];
    
    return done(null, user);
  } catch (error) {
    console.error('❌ Discord OAuth database error:', error);
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (error) {
    done(error, null);
  }
});

app.use(passport.initialize());

// JWT Authentication Middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify session exists
    const sessionResult = await pool.query(
      'SELECT * FROM user_sessions WHERE user_id = $1 AND token = $2 AND expires_at > NOW()',
      [decoded.userId, token]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid or expired session' });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// OAuth Debug endpoint - helps troubleshoot redirect issues
app.get('/api/auth/test', (req, res) => {
  res.json({
    discordClientId: process.env.DISCORD_CLIENT_ID,
    redirectUri: process.env.DISCORD_REDIRECT_URI,
    currentHost: req.get('host'),
    currentProtocol: req.protocol,
    currentUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
    headers: {
      host: req.headers.host,
      'x-forwarded-host': req.headers['x-forwarded-host'],
      'x-forwarded-proto': req.headers['x-forwarded-proto']
    },
    expectedCallback: 'https://dissident-backend-api-production.up.railway.app/api/auth/discord/callback'
  });
});

// Discord OAuth Diagnostic Endpoint
app.get('/api/auth/diagnose', (req, res) => {
  const diagnostic = {
    timestamp: new Date().toISOString(),
    environment: {
      DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
      DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI,
      NODE_ENV: process.env.NODE_ENV
    },
    expectedDiscordUrl: `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20guilds%20email`,
    instructions: 'Copy the expectedDiscordUrl and test it in your browser. If it fails, compare with your Discord Developer Portal OAuth2 settings.'
  };
  res.json(diagnostic);
});

// Discord OAuth Routes
app.get('/api/auth/discord', (req, res, next) => {
  console.log('🔔 Discord OAuth initiated at', new Date().toISOString());
  console.log('   Configured Redirect URI:', process.env.DISCORD_REDIRECT_URI);
  console.log('   Request Host:', req.get('host'));
  console.log('   Request Protocol:', req.protocol);
  
  passport.authenticate('discord', {
    scope: ['identify', 'guilds', 'email']
  })(req, res, (err) => {
    if (err) {
      console.error('❌ Passport authenticate error:', err.message);
      return res.redirect(`https://dissident-website-production.up.railway.app/af78bb.html?error=oauth_init_failed&message=${encodeURIComponent(err.message)}`);
    }
    next();
  });
});

app.get('/api/auth/discord/callback', 
  passport.authenticate('discord', { 
    session: false,
    failureRedirect: '/af78bb.html?error=auth_failed'
  }),
  async (req, res) => {
    try {
      if (!req.user) {
        console.error('❌ No user returned from Discord OAuth');
        return res.redirect('https://dissident-website-production.up.railway.app/af78bb.html?error=auth_failed');
      }
      
      console.log('✅ OAuth successful for user:', req.user.id);
      
      // Generate JWT
      const token = jwt.sign(
        { 
          userId: req.user.id,
          username: req.user.username,
          avatar: req.user.avatar
        }, 
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      // Save session to database
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      await pool.query(
        'INSERT INTO user_sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [req.user.id, token, expiresAt]
      );
      
      // Redirect to dashboard with token
      const redirectUrl = `https://dissident-website-production.up.railway.app/af34a3.html?token=${token}`;
      
      console.log('🚀 Redirecting user to:', redirectUrl);
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('❌ Auth callback error:', error);
      res.redirect('https://dissident-website-production.up.railway.app/af78bb.html?error=callback_failed');
    }
  }
);

// OAuth error handler with detailed diagnostics
app.use('/api/auth', (err, req, res, next) => {
  console.error('❌ OAuth Error:', err.message);
  console.error('   Stack:', err.stack);
  
  const errorDetails = {
    message: err.message,
    stack: err.stack?.split('\n')[0],
    url: req.originalUrl,
    query: req.query
  };
  
  // Log to console for debugging
  console.error('Full error details:', JSON.stringify(errorDetails, null, 2));
  
  // Redirect with error info
  const redirectUrl = `https://dissident-website-production.up.railway.app/af78bb.html?error=oauth_error&details=${encodeURIComponent(JSON.stringify(errorDetails))}`;
  res.redirect(redirectUrl);
});

// Logout
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    await pool.query('DELETE FROM user_sessions WHERE token = $1', [token]);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, discriminator, avatar, email FROM users WHERE id = $1', [req.user.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Discord Guild Routes
app.get('/api/discord/guilds', authenticateToken, async (req, res) => {
  try {
    // Get user's Discord access token
    const userResult = await pool.query('SELECT access_token FROM users WHERE id = $1', [req.user.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const accessToken = userResult.rows[0].access_token;
    
    // Fetch guilds from Discord API
    const response = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    
    // Filter guilds where user has admin permissions
    const adminGuilds = response.data.filter(guild => {
      const permissions = BigInt(guild.permissions);
      return (permissions & BigInt(0x8)) === BigInt(0x8); // ADMINISTRATOR permission
    });
    
    res.json(adminGuilds);
  } catch (error) {
    console.error('Fetch guilds error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch guilds' });
  }
});

// Get specific guild details
app.get('/api/discord/guilds/:guildId', authenticateToken, async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Check if bot is in this guild
    const guild = await discordClient.guilds.fetch(guildId).catch(() => null);
    
    if (!guild) {
      return res.json({
        id: guildId,
        botInGuild: false,
        inviteUrl: `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&scope=bot&permissions=8&guild_id=${guildId}`
      });
    }
    
    const stats = {
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      memberCount: guild.memberCount,
      botInGuild: true,
      channels: guild.channels.cache.size,
      roles: guild.roles.cache.size
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch guild details' });
  }
});

// Moderation API Endpoints
app.get('/api/moderation/logs/:guildId', authenticateToken, async (req, res) => {
  try {
    const { guildId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const result = await pool.query(`
      SELECT * FROM audit_logs
      WHERE server_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [guildId, limit]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Moderation logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

app.post('/api/moderation/ban', authenticateToken, async (req, res) => {
  try {
    const { guildId, userId, reason, deleteMessages } = req.body;
    
    const guild = await discordClient.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    
    await member.ban({ 
      reason,
      deleteMessageSeconds: deleteMessages ? 604800 : 0 // 7 days
    });
    
    await pool.query(`
      INSERT INTO audit_logs (server_id, user_id, target_id, action, reason)
      VALUES ($1, $2, $3, 'BAN', $4)
    `, [guildId, req.user.userId, userId, reason]);
    
    res.json({ success: true, message: 'User banned successfully' });
  } catch (error) {
    console.error('Ban error:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

app.post('/api/moderation/kick', authenticateToken, async (req, res) => {
  try {
    const { guildId, userId, reason } = req.body;
    
    const guild = await discordClient.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    
    await member.kick(reason);
    
    await pool.query(`
      INSERT INTO audit_logs (server_id, user_id, target_id, action, reason)
      VALUES ($1, $2, $3, 'KICK', $4)
    `, [guildId, req.user.userId, userId, reason]);
    
    res.json({ success: true, message: 'User kicked successfully' });
  } catch (error) {
    console.error('Kick error:', error);
    res.status(500).json({ error: 'Failed to kick user' });
  }
});

app.post('/api/moderation/mute', authenticateToken, async (req, res) => {
  try {
    const { guildId, userId, duration, reason } = req.body;
    
    const guild = await discordClient.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    
    await member.timeout(duration * 1000, reason);
    
    await pool.query(`
      INSERT INTO audit_logs (server_id, user_id, target_id, action, reason)
      VALUES ($1, $2, $3, 'MUTE', $4)
    `, [guildId, req.user.userId, userId, `${reason} (${duration}s)`]);
    
    res.json({ success: true, message: 'User muted successfully' });
  } catch (error) {
    console.error('Mute error:', error);
    res.status(500).json({ error: 'Failed to mute user' });
  }
});

app.post('/api/moderation/warn', authenticateToken, async (req, res) => {
  try {
    const { guildId, userId, reason } = req.body;
    
    await pool.query(`
      INSERT INTO user_warnings (user_id, guild_id, moderator_id, reason)
      VALUES ($1, $2, $3, $4)
    `, [userId, guildId, req.user.userId, reason]);
    
    await pool.query(`
      INSERT INTO audit_logs (server_id, user_id, target_id, action, reason)
      VALUES ($1, $2, $3, 'WARN', $4)
    `, [guildId, req.user.userId, userId, reason]);
    
    res.json({ success: true, message: 'User warned successfully' });
  } catch (error) {
    console.error('Warn error:', error);
    res.status(500).json({ error: 'Failed to warn user' });
  }
});

// XP System API
app.get('/api/xp/leaderboard/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await pool.query(`
      SELECT user_id, xp, level, messages
      FROM user_xp
      WHERE guild_id = $1
      ORDER BY xp DESC
      LIMIT $2
    `, [guildId, limit]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

app.get('/api/xp/user/:guildId/:userId', async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    
    const result = await pool.query(`
      SELECT xp, level, messages
      FROM user_xp
      WHERE guild_id = $1 AND user_id = $2
    `, [guildId, userId]);
    
    if (result.rows.length === 0) {
      return res.json({ xp: 0, level: 1, messages: 0 });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('User XP error:', error);
    res.status(500).json({ error: 'Failed to fetch user XP' });
  }
});

// Economy API
app.get('/api/economy/balance/:guildId/:userId', async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    
    const result = await pool.query(`
      SELECT balance, last_daily
      FROM user_economy
      WHERE guild_id = $1 AND user_id = $2
    `, [guildId, userId]);
    
    if (result.rows.length === 0) {
      return res.json({ balance: 0, last_daily: null });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Balance error:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// Dashboard Statistics - NOW WITH REAL DATA
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    // Get real stats from Discord bot
    const stats = {
      memberCount: discordClient.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
      onlineCount: discordClient.guilds.cache.reduce((acc, guild) => {
        return acc + guild.members.cache.filter(m => m.presence?.status === 'online').size;
      }, 0),
      commandCount: discordClient.commandStats ? 
        Array.from(discordClient.commandStats.values()).reduce((a, b) => a + b, 0) : 0,
      messageCount: 0, // Would need message tracking
      activeServers: discordClient.guilds.cache.size,
      recentActivity: await getRecentActivity()
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Guild-specific Dashboard Stats
app.get('/api/guilds/:guildId/stats', authenticateToken, async (req, res) => {
  try {
    const { guildId } = req.params;
    const guild = await discordClient.guilds.fetch(guildId).catch(() => null);
    
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    // Get online count
    const onlineCount = guild.members.cache.filter(m => 
      m.presence?.status === 'online' || m.presence?.status === 'dnd' || m.presence?.status === 'idle'
    ).size;
    
    // Get recent moderation stats
    const modStats = await pool.query(
      `SELECT action, COUNT(*) FROM audit_logs 
       WHERE server_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
       GROUP BY action`,
      [guildId]
    );
    
    res.json({
      memberCount: guild.memberCount,
      onlineCount,
      moderationToday: modStats.rows.reduce((acc, row) => {
        acc[row.action.toLowerCase()] = parseInt(row.count);
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Guild stats error:', error);
    res.status(500).json({ error: 'Failed to fetch guild stats' });
  }
});

// Server Settings API
app.get('/api/settings/:guildId', authenticateToken, async (req, res) => {
  try {
    const { guildId } = req.params;
    
    let result = await pool.query(
      'SELECT settings FROM server_settings WHERE server_id = $1',
      [guildId]
    );
    
    if (result.rows.length === 0) {
      // Return default settings
      return res.json({
        modules: { autoMod: false, economy: false, tickets: false, xp: true }
      });
    }
    
    res.json(result.rows[0].settings);
  } catch (error) {
    console.error('Settings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/settings/:guildId', authenticateToken, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { settings } = req.body;
    
    await pool.query(
      `INSERT INTO server_settings (server_id, settings, updated_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (server_id) DO UPDATE SET settings = $2, updated_at = CURRENT_TIMESTAMP`,
      [guildId, JSON.stringify(settings)]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Module Toggle API
app.get('/api/modules/:guildId', authenticateToken, async (req, res) => {
  try {
    const { guildId } = req.params;
    
    const result = await pool.query(
      'SELECT settings FROM server_settings WHERE server_id = $1',
      [guildId]
    );
    
    if (result.rows.length === 0) {
      return res.json({ autoMod: false, economy: false, tickets: false, xp: true });
    }
    
    const settings = result.rows[0].settings;
    res.json({
      autoMod: settings.modules?.autoMod || false,
      economy: settings.modules?.economy || false,
      tickets: settings.modules?.tickets || false,
      xp: settings.modules?.xp !== false
    });
  } catch (error) {
    console.error('Modules fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

app.post('/api/modules/:guildId/:module', authenticateToken, async (req, res) => {
  try {
    const { guildId, module: moduleName } = req.params;
    const { enabled } = req.body;
    
    // Get current settings
    let result = await pool.query(
      'SELECT settings FROM server_settings WHERE server_id = $1',
      [guildId]
    );
    
    let settings = result.rows[0]?.settings || {};
    if (!settings.modules) settings.modules = {};
    settings.modules[moduleName] = enabled;
    
    await pool.query(
      `INSERT INTO server_settings (server_id, settings, updated_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (server_id) DO UPDATE SET settings = $2, updated_at = CURRENT_TIMESTAMP`,
      [guildId, JSON.stringify(settings)]
    );
    
    await pool.query(
      `INSERT INTO audit_logs (server_id, user_id, action, reason) 
       VALUES ($1, $2, 'SETTINGS_UPDATE', $3)`,
      [guildId, req.user.userId, `${moduleName} ${enabled ? 'enabled' : 'disabled'}`]
    );
    
    res.json({ success: true, module: moduleName, enabled });
  } catch (error) {
    console.error('Module toggle error:', error);
    res.status(500).json({ error: 'Failed to toggle module' });
  }
});

// Member search for moderation
app.get('/api/guilds/:guildId/members/search', authenticateToken, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { query, limit = 10 } = req.query;
    
    const guild = await discordClient.guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    
    await guild.members.fetch();
    
    const members = guild.members.cache
      .filter(m => 
        m.user.username.toLowerCase().includes(query.toLowerCase()) ||
        m.user.id === query
      )
      .first(parseInt(limit))
      .map(m => ({
        id: m.user.id,
        username: m.user.username,
        avatar: m.user.avatar
      }));
    
    res.json(members);
  } catch (error) {
    console.error('Member search error:', error);
    res.status(500).json({ error: 'Failed to search members' });
  }
});

// User warnings
app.get('/api/moderation/warnings/:guildId/:userId', authenticateToken, async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    
    const result = await pool.query(
      `SELECT * FROM user_warnings 
       WHERE guild_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [guildId, userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Warnings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch warnings' });
  }
});

// Moderation statistics
app.get('/api/moderation/stats/:guildId', authenticateToken, async (req, res) => {
  try {
    const { guildId } = req.params;
    
    const result = await pool.query(
      `SELECT action, COUNT(*) as count
       FROM audit_logs 
       WHERE server_id = $1 AND created_at > NOW() - INTERVAL '7 days'
       GROUP BY action`,
      [guildId]
    );
    
    res.json({ dailyStats: result.rows });
  } catch (error) {
    console.error('Moderation stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Helper function to get recent activity
async function getRecentActivity() {
  try {
    const result = await pool.query(`
      SELECT action, target_id, reason, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    return result.rows.map(row => ({
      action: row.action,
      user: 'Moderator', // Could fetch actual username
      time: new Date(row.created_at).toRelativeTime || 'recent',
      reason: row.reason
    }));
  } catch (err) {
    console.error('Failed to get activity:', err);
    return [];
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    discordConnected: discordClient.isReady(),
    deploymentVersion: '2.0.0'  // Force new deployment
  });
});

// OAuth error handler - MUST be before other error handlers
app.use('/api/auth', (err, req, res, next) => {
  console.error('❌ OAuth Error:', err.message);
  console.error('   Stack:', err.stack);
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  res.redirect(`${frontendUrl}/af78bb.html?error=oauth_error&message=` + encodeURIComponent(err.message));
});

// General error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Import and initialize Discord Bot
const DissidentBot = require('./bot');
const bot = new DissidentBot();

// Set database pool for bot
bot.setDatabasePool(pool);

// Initialize database and start server + bot
initDatabase().then(async () => {
  // Start API server
  app.listen(PORT, () => {
    console.log(`🚀 API server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:8080'}`);
    console.log(`✅ Health check available at: http://localhost:${PORT}/api/health`);
  });
  
  // Start Discord bot
  if (process.env.DISCORD_BOT_TOKEN) {
    try {
      await bot.login(process.env.DISCORD_BOT_TOKEN);
      console.log('✅ Discord bot started successfully');
    } catch (err) {
      console.error('❌ Failed to start Discord bot:', err.message);
      console.log('⚠️  Continuing without bot features');
    }
  } else {
    console.warn('⚠️  No DISCORD_BOT_TOKEN provided - bot features will be disabled');
  }
}).catch(error => {
  console.error('❌ Failed to initialize server:', error);
  process.exit(1);
});

// Add bot instance to app for API routes to access
app.locals.bot = bot;

module.exports = app;
