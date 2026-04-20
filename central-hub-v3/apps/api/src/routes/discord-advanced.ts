/**
 * Advanced Discord API Routes
 * /api/discord/advanced/*
 * AI moderation, analytics, and commerce features
 */

import { Router } from 'express';
import discordAdvanced, { ContentViolation, ModerationAction } from '../services/discord-advanced';

const router = Router();

/**
 * GET /api/discord/advanced/status
 * Get advanced Discord features status
 */
router.get('/status', async (req, res) => {
  try {
    // Get counts from services
    const moderationStats = { rules: 0, logs: 0 };
    const commerceStats = { products: 0, orders: 0 };
    
    res.json({
      success: true,
      data: {
        moderation: {
          enabled: true,
          aiPowered: true,
          rules: moderationStats.rules,
          logs: moderationStats.logs,
        },
        analytics: {
          enabled: true,
          tracking: true,
        },
        commerce: {
          enabled: true,
          products: commerceStats.products,
          orders: commerceStats.orders,
          currency: ['USD', 'points', 'nitro'],
        },
        autoResponder: {
          enabled: true,
        },
      },
    });
  } catch (error) {
    console.error('Discord advanced status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status',
    });
  }
});

// ============================================
// MODERATION
// ============================================

/**
 * POST /api/discord/advanced/moderation/analyze
 * Analyze message content
 */
router.post('/moderation/analyze', async (req, res) => {
  try {
    const { content, context } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'content is required',
      });
    }

    const analysis = await discordAdvanced.analyzeMessage(content, context);
    
    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('Analyze message error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze message',
    });
  }
});

/**
 * GET /api/discord/advanced/moderation/rules
 * Get moderation rules for guild
 */
router.get('/moderation/rules', async (req, res) => {
  try {
    const { guildId } = req.query;
    
    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'guildId is required',
      });
    }

    const rules = await discordAdvanced.getModerationRules(guildId as string);
    
    res.json({
      success: true,
      data: rules,
      count: rules.length,
    });
  } catch (error) {
    console.error('Get moderation rules error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get rules',
    });
  }
});

/**
 * POST /api/discord/advanced/moderation/rules
 * Create moderation rule
 */
router.post('/moderation/rules', async (req, res) => {
  try {
    const { guildId, rule } = req.body;
    
    if (!guildId || !rule) {
      return res.status(400).json({
        success: false,
        error: 'guildId and rule are required',
      });
    }

    const newRule = await discordAdvanced.createModerationRule(guildId, rule);
    
    res.json({
      success: true,
      data: newRule,
    });
  } catch (error) {
    console.error('Create moderation rule error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create rule',
    });
  }
});

/**
 * GET /api/discord/advanced/moderation/logs
 * Get moderation logs
 */
router.get('/moderation/logs', async (req, res) => {
  try {
    const { guildId, userId, action, startDate, endDate } = req.query;
    
    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'guildId is required',
      });
    }

    const logs = await discordAdvanced.getModerationLogs(guildId as string, {
      userId: userId as string,
      action: action as ModerationAction,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });
    
    res.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error) {
    console.error('Get moderation logs error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get logs',
    });
  }
});

/**
 * POST /api/discord/advanced/moderation/process
 * Process message through moderation
 */
router.post('/moderation/process', async (req, res) => {
  try {
    const { content, guildId, userId, username, channelId, messageId } = req.body;
    
    if (!content || !guildId || !userId || !channelId) {
      return res.status(400).json({
        success: false,
        error: 'content, guildId, userId, and channelId are required',
      });
    }

    const result = await discordAdvanced.processMessage(
      content,
      guildId,
      { userId, username: username || 'Unknown' },
      { channelId, messageId: messageId || 'unknown' }
    );
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Process message error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process message',
    });
  }
});

// ============================================
// ANALYTICS
// ============================================

/**
 * POST /api/discord/advanced/analytics/track
 * Track a message
 */
router.post('/analytics/track', async (req, res) => {
  try {
    const { guildId, channelId, userId, timestamp } = req.body;
    
    if (!guildId || !channelId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'guildId, channelId, and userId are required',
      });
    }

    await discordAdvanced.trackMessage(
      guildId,
      channelId,
      userId,
      timestamp ? new Date(timestamp) : new Date()
    );
    
    res.json({
      success: true,
      message: 'Message tracked',
    });
  } catch (error) {
    console.error('Track message error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to track message',
    });
  }
});

/**
 * GET /api/discord/advanced/analytics/guild/:guildId
 * Get guild analytics
 */
router.get('/analytics/guild/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { days = '7' } = req.query;
    
    const analytics = await discordAdvanced.generateGuildAnalytics(
      guildId,
      parseInt(days as string)
    );
    
    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Get guild analytics error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get analytics',
    });
  }
});

// ============================================
// COMMERCE
// ============================================

/**
 * GET /api/discord/advanced/commerce/products
 * Get products for guild
 */
router.get('/commerce/products', async (req, res) => {
  try {
    const { guildId } = req.query;
    
    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'guildId is required',
      });
    }

    const products = await discordAdvanced.getProducts(guildId as string);
    
    res.json({
      success: true,
      data: products,
      count: products.length,
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get products',
    });
  }
});

/**
 * POST /api/discord/advanced/commerce/products
 * Create product
 */
router.post('/commerce/products', async (req, res) => {
  try {
    const product = await discordAdvanced.createProduct(req.body);
    
    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create product',
    });
  }
});

/**
 * POST /api/discord/advanced/commerce/orders
 * Create order
 */
router.post('/commerce/orders', async (req, res) => {
  try {
    const order = await discordAdvanced.createOrder(req.body);
    
    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create order',
    });
  }
});

/**
 * GET /api/discord/advanced/commerce/points/:userId
 * Get user points
 */
router.get('/commerce/points/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { guildId } = req.query;
    
    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'guildId is required',
      });
    }

    const points = await discordAdvanced.getUserPoints(userId, guildId as string);
    
    res.json({
      success: true,
      data: points,
    });
  } catch (error) {
    console.error('Get user points error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get points',
    });
  }
});

/**
 * POST /api/discord/advanced/commerce/points/award
 * Award points to user
 */
router.post('/commerce/points/award', async (req, res) => {
  try {
    const { userId, guildId, amount, reason } = req.body;
    
    if (!userId || !guildId || amount === undefined || !reason) {
      return res.status(400).json({
        success: false,
        error: 'userId, guildId, amount, and reason are required',
      });
    }

    const points = await discordAdvanced.awardPoints(userId, guildId, amount, reason);
    
    res.json({
      success: true,
      data: points,
    });
  } catch (error) {
    console.error('Award points error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to award points',
    });
  }
});

// ============================================
// AUTO RESPONDER
// ============================================

/**
 * GET /api/discord/advanced/responders
 * Get auto-responders
 */
router.get('/responders', async (req, res) => {
  try {
    const { guildId } = req.query;
    
    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'guildId is required',
      });
    }

    const responders = await discordAdvanced.getAutoResponders(guildId as string);
    
    res.json({
      success: true,
      data: responders,
      count: responders.length,
    });
  } catch (error) {
    console.error('Get responders error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get responders',
    });
  }
});

/**
 * POST /api/discord/advanced/responders
 * Create auto-responder
 */
router.post('/responders', async (req, res) => {
  try {
    const responder = await discordAdvanced.createAutoResponder(req.body);
    
    res.json({
      success: true,
      data: responder,
    });
  } catch (error) {
    console.error('Create responder error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create responder',
    });
  }
});

/**
 * POST /api/discord/advanced/responders/process
 * Process message for auto-responders
 */
router.post('/responders/process', async (req, res) => {
  try {
    const { content, guildId, channelId } = req.body;
    
    if (!content || !guildId || !channelId) {
      return res.status(400).json({
        success: false,
        error: 'content, guildId, and channelId are required',
      });
    }

    const responses = await discordAdvanced.processAutoResponders(content, guildId, channelId);
    
    res.json({
      success: true,
      data: responses,
      triggered: responses ? responses.length : 0,
    });
  } catch (error) {
    console.error('Process responders error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process responders',
    });
  }
});

export default router;
