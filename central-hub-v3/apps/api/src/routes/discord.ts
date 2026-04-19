/**
 * Discord Bot API Routes
 * /api/discord/*
 */

import { Router } from 'express';
import { discordService } from '../services/discord';

const router = Router();

/**
 * GET /api/discord/bots
 * Get all Discord bots
 */
router.get('/bots', async (req, res) => {
  try {
    const bots = await discordService.getAllBots();
    
    res.json({
      success: true,
      data: bots,
    });
  } catch (error) {
    console.error('Get bots error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get bots',
    });
  }
});

/**
 * POST /api/discord/bots
 * Create a new Discord bot
 */
router.post('/bots', async (req, res) => {
  try {
    const { name, token, config } = req.body;
    
    if (!name || !token) {
      return res.status(400).json({
        success: false,
        error: 'name and token are required',
      });
    }
    
    const bot = await discordService.createBot(name, token, config);
    
    res.json({
      success: true,
      data: bot,
    });
  } catch (error) {
    console.error('Create bot error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create bot',
    });
  }
});

/**
 * GET /api/discord/bots/:id
 * Get bot details
 */
router.get('/bots/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const status = await discordService.getBotStatus(id);
    
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Get bot error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get bot',
    });
  }
});

/**
 * POST /api/discord/bots/:id/start
 * Start a bot
 */
router.post('/bots/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await discordService.startBot(id);
    
    res.json({
      success,
      message: success ? 'Bot started' : 'Failed to start bot',
    });
  } catch (error) {
    console.error('Start bot error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start bot',
    });
  }
});

/**
 * POST /api/discord/bots/:id/stop
 * Stop a bot
 */
router.post('/bots/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await discordService.stopBot(id);
    
    res.json({
      success,
      message: success ? 'Bot stopped' : 'Failed to stop bot',
    });
  } catch (error) {
    console.error('Stop bot error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to stop bot',
    });
  }
});

/**
 * POST /api/discord/bots/:id/restart
 * Restart a bot
 */
router.post('/bots/:id/restart', async (req, res) => {
  try {
    const { id } = req.params;
    
    await discordService.stopBot(id);
    const success = await discordService.startBot(id);
    
    res.json({
      success,
      message: success ? 'Bot restarted' : 'Failed to restart bot',
    });
  } catch (error) {
    console.error('Restart bot error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restart bot',
    });
  }
});

/**
 * POST /api/discord/bots/:id/commands
 * Update bot commands
 */
router.post('/bots/:id/commands', async (req, res) => {
  try {
    const { id } = req.params;
    const { commands } = req.body;
    
    if (!Array.isArray(commands)) {
      return res.status(400).json({
        success: false,
        error: 'commands must be an array',
      });
    }
    
    const bot = await discordService.updateCommands(id, commands);
    
    res.json({
      success: true,
      data: bot,
    });
  } catch (error) {
    console.error('Update commands error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update commands',
    });
  }
});

/**
 * POST /api/discord/bots/:id/message
 * Send a message through the bot
 */
router.post('/bots/:id/message', async (req, res) => {
  try {
    const { id } = req.params;
    const { channelId, message } = req.body;
    
    if (!channelId || !message) {
      return res.status(400).json({
        success: false,
        error: 'channelId and message are required',
      });
    }
    
    const success = await discordService.sendMessage(id, channelId, message);
    
    res.json({
      success,
      message: success ? 'Message sent' : 'Failed to send message',
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    });
  }
});

/**
 * POST /api/discord/bots/:id/configure
 * Update bot configuration
 */
router.post('/bots/:id/configure', async (req, res) => {
  try {
    const { id } = req.params;
    const config = req.body;
    
    const bot = await discordService.updateBotConfiguration(id, config);
    
    res.json({
      success: true,
      data: bot,
    });
  } catch (error) {
    console.error('Configure bot error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to configure bot',
    });
  }
});

/**
 * POST /api/discord/bots/:id/deploy
 * Deploy bot to Railway
 */
router.post('/bots/:id/deploy', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await discordService.deployBotToRailway(id);
    
    res.json({
      success,
      message: success ? 'Bot deployment initiated' : 'Failed to deploy bot',
    });
  } catch (error) {
    console.error('Deploy bot error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deploy bot',
    });
  }
});

/**
 * GET /api/discord/bots/:id/logs
 * Get bot logs
 */
router.get('/bots/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 100 } = req.query;
    
    // Get bot and return logs
    const bot = await discordService.getBotStatus(id);
    
    res.json({
      success: true,
      data: {
        logs: [], // Would get from bot's log file
        limit: parseInt(limit as string),
      },
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get logs',
    });
  }
});

/**
 * DELETE /api/discord/bots/:id
 * Delete a bot
 */
router.delete('/bots/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await discordService.deleteBot(id);
    
    res.json({
      success,
      message: success ? 'Bot deleted' : 'Failed to delete bot',
    });
  } catch (error) {
    console.error('Delete bot error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete bot',
    });
  }
});

/**
 * POST /api/discord/bots/:id/status
 * Update bot status (called by bot webhook)
 */
router.post('/bots/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, guilds } = req.body;
    
    // Update bot status in database
    // This is called by the bot itself
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update status',
    });
  }
});

/**
 * POST /api/discord/bots/:id/metrics
 * Update bot metrics (called by bot webhook)
 */
router.post('/bots/:id/metrics', async (req, res) => {
  try {
    const { id } = req.params;
    const { messages, errors } = req.body;
    
    // Update bot metrics in database
    // This is called by the bot itself
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update metrics error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update metrics',
    });
  }
});

/**
 * POST /api/discord/bots/:id/error
 * Report bot error (called by bot webhook)
 */
router.post('/bots/:id/error', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = req.body;
    
    console.error(`[Discord Bot ${id}] Error:`, error);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to report error',
    });
  }
});

export default router;
