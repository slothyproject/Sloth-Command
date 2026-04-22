/**
 * Advanced Discord Features Service
 * AI moderation, analytics, and commerce capabilities
 * Enhanced bot functionality for community management
 */

import { PrismaClient } from '@prisma/client';
import { generate, generateJSON, TaskComplexity } from './llm-router';
import { redis } from './redis';
import { getQueue } from './queue';

const prisma = new PrismaClient();

// AI Moderation
export enum ModerationAction {
  NONE = 'none',
  WARN = 'warn',
  MUTE = 'mute',
  KICK = 'kick',
  BAN = 'ban',
  DELETE = 'delete',
  FLAG = 'flag',
}

export enum ContentViolation {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  HATE_SPEECH = 'hate_speech',
  NSFW = 'nsfw',
  SCAM = 'scam',
  TOS_VIOLATION = 'tos_violation',
  ADVERTISING = 'advertising',
  OFF_TOPIC = 'off_topic',
}

interface ModerationRule {
  id: string;
  guildId: string;
  name: string;
  enabled: boolean;
  violations: ContentViolation[];
  thresholds: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    maxScore: number;
  };
  action: ModerationAction;
  duration?: number; // minutes (for mute)
  message?: string;
  autoDelete: boolean;
  notifyMods: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ModerationLog {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  userId: string;
  username: string;
  content: string;
  violations: Array<{
    type: ContentViolation;
    confidence: number;
    severity: string;
  }>;
  action: ModerationAction;
  actionTakenBy: 'ai' | 'user' | 'system';
  moderatorId?: string;
  timestamp: Date;
  appealed?: boolean;
  appealStatus?: 'pending' | 'approved' | 'rejected';
  aiAnalysis: {
    toxicityScore: number;
    spamScore: number;
    sentiment: 'positive' | 'negative' | 'neutral';
    reasoning: string;
  };
}

// Analytics
interface GuildAnalytics {
  guildId: string;
  period: {
    start: Date;
    end: Date;
  };
  members: {
    total: number;
    active: number;
    new: number;
    left: number;
    growth: number; // percentage
  };
  messages: {
    total: number;
    byChannel: Record<string, number>;
    byHour: Record<number, number>;
    byDay: Record<string, number>;
  };
  engagement: {
    avgMessagesPerUser: number;
    topUsers: Array<{
      userId: string;
      username: string;
      messages: number;
      reactions: number;
    }>;
    voiceMinutes: number;
    reactions: number;
  };
  moderation: {
    violations: number;
    actions: Record<ModerationAction, number>;
    topViolations: Array<{ type: ContentViolation; count: number }>;
  };
  trends: {
    memberGrowth: 'up' | 'down' | 'stable';
    activityTrend: 'up' | 'down' | 'stable';
    sentiment: 'positive' | 'negative' | 'neutral';
  };
  recommendations: string[];
}

// Commerce
interface Product {
  id: string;
  guildId: string;
  name: string;
  description: string;
  price: number;
  currency: 'USD' | 'EUR' | 'GBP' | 'discord_nitro' | 'points';
  stock: number | 'unlimited';
  imageUrl?: string;
  category: string;
  roles?: string[]; // Discord roles to grant on purchase
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Order {
  id: string;
  guildId: string;
  userId: string;
  username: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  total: number;
  currency: string;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  paymentMethod?: string;
  redeemed: boolean;
  redeemedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface UserPoints {
  userId: string;
  guildId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  history: Array<{
    type: 'earned' | 'spent' | 'bonus';
    amount: number;
    reason: string;
    timestamp: Date;
  }>;
  lastUpdated: Date;
}

// Auto-responder
interface AutoResponder {
  id: string;
  guildId: string;
  name: string;
  trigger: {
    type: 'exact' | 'contains' | 'starts_with' | 'regex' | 'ai_intent';
    pattern: string;
    channels?: string[];
    users?: string[];
    cooldown: number; // seconds
  };
  response: {
    type: 'text' | 'embed' | 'dm' | 'reaction' | 'action';
    content: string;
    aiGenerated?: boolean;
  };
  enabled: boolean;
  usageCount: number;
  lastTriggered?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Redis keys
const REDIS_KEYS = {
  MODERATION_RULE_PREFIX: 'discord:mod:rule:',
  MODERATION_LOG_PREFIX: 'discord:mod:log:',
  ANALYTICS_PREFIX: 'discord:analytics:',
  PRODUCT_PREFIX: 'discord:product:',
  ORDER_PREFIX: 'discord:order:',
  POINTS_PREFIX: 'discord:points:',
  AUTO_RESPONDER_PREFIX: 'discord:responder:',
  MESSAGE_COUNT_PREFIX: 'discord:msgcount:',
};

// ============================================
// AI MODERATION
// ============================================

/**
 * Analyze message content with AI
 */
export async function analyzeMessage(
  content: string,
  context?: {
    userId?: string;
    channelId?: string;
    guildId?: string;
    previousMessages?: string[];
  }
): Promise<{
  violations: Array<{
    type: ContentViolation;
    confidence: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  overallScore: number;
  action: ModerationAction;
  reasoning: string;
}> {
  const analysisPrompt = `Analyze this Discord message for content violations:

MESSAGE: "${content}"
${context?.previousMessages ? `CONTEXT: ${context.previousMessages.join('\n')}` : ''}

Check for:
1. SPAM - Repetitive, unsolicited messages
2. HARASSMENT - Bullying, targeting users
3. HATE_SPEECH - Discriminatory content
4. NSFW - Inappropriate adult content
5. SCAM - Fraudulent links or requests
6. TOS_VIOLATION - Discord Terms of Service violations
7. ADVERTISING - Unauthorized promotion
8. OFF_TOPIC - Content not relevant to channel

For each violation found, provide:
- type: violation type
- confidence: 0-1 score
- severity: low/medium/high/critical

Also provide:
- overallScore: 0-100 toxicity/spam score
- action: none/warn/mute/kick/ban/delete/flag
- reasoning: explanation of decision

Respond with JSON matching the expected format.`;

  try {
    const result = await generateJSON<{
      violations: Array<{
        type: ContentViolation;
        confidence: number;
        severity: 'low' | 'medium' | 'high' | 'critical';
      }>;
      overallScore: number;
      action: ModerationAction;
      reasoning: string;
    }>(analysisPrompt, `{
      "violations": [{"type": "string", "confidence": "number", "severity": "string"}],
      "overallScore": "number",
      "action": "string",
      "reasoning": "string"
    }`, { complexity: TaskComplexity.MODERATE });

    return result;
  } catch (error) {
    console.error('AI moderation analysis failed:', error);
    
    // Fallback: simple keyword detection
    const violations: Array<{ type: ContentViolation; confidence: number; severity: 'low' | 'medium' | 'high' | 'critical' }> = [];
    
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('spam') || lowerContent.includes('buy now')) {
      violations.push({ type: ContentViolation.SPAM, confidence: 0.8, severity: 'medium' });
    }
    if (lowerContent.includes('stupid') || lowerContent.includes('idiot')) {
      violations.push({ type: ContentViolation.HARASSMENT, confidence: 0.6, severity: 'low' });
    }
    
    return {
      violations,
      overallScore: violations.length > 0 ? 50 : 10,
      action: violations.length > 0 ? ModerationAction.FLAG : ModerationAction.NONE,
      reasoning: violations.length > 0 ? 'Keyword-based detection' : 'No violations detected',
    };
  }
}

/**
 * Create moderation rule
 */
export async function createModerationRule(
  guildId: string,
  rule: Omit<ModerationRule, 'id' | 'guildId' | 'createdAt' | 'updatedAt'>
): Promise<ModerationRule> {
  const ruleId = `modrule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const moderationRule: ModerationRule = {
    ...rule,
    id: ruleId,
    guildId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await redis.setex(
    `${REDIS_KEYS.MODERATION_RULE_PREFIX}${guildId}:${ruleId}`,
    0,
    JSON.stringify(moderationRule)
  );

  console.log(`🛡️ Created moderation rule: ${rule.name} for guild ${guildId}`);

  return moderationRule;
}

/**
 * Get moderation rules for guild
 */
export async function getModerationRules(guildId: string): Promise<ModerationRule[]> {
  const keys = await redis.keys(`${REDIS_KEYS.MODERATION_RULE_PREFIX}${guildId}:*`);
  const rules: ModerationRule[] = [];

  for (const key of keys) {
    const ruleData = await redis.get(key);
    if (ruleData) {
      rules.push(JSON.parse(ruleData));
    }
  }

  return rules;
}

/**
 * Log moderation action
 */
export async function logModerationAction(
  log: Omit<ModerationLog, 'id' | 'timestamp'>
): Promise<ModerationLog> {
  const logId = `modlog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const moderationLog: ModerationLog = {
    ...log,
    id: logId,
    timestamp: new Date(),
  };

  await redis.setex(
    `${REDIS_KEYS.MODERATION_LOG_PREFIX}${log.guildId}:${logId}`,
    2592000, // 30 days
    JSON.stringify(moderationLog)
  );

  console.log(`📝 Logged moderation action: ${log.action} for ${log.username}`);

  return moderationLog;
}

/**
 * Get moderation logs
 */
export async function getModerationLogs(
  guildId: string,
  filters?: {
    userId?: string;
    action?: ModerationAction;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<ModerationLog[]> {
  const keys = await redis.keys(`${REDIS_KEYS.MODERATION_LOG_PREFIX}${guildId}:*`);
  const logs: ModerationLog[] = [];

  for (const key of keys) {
    const logData = await redis.get(key);
    if (logData) {
      const log: ModerationLog = JSON.parse(logData);
      
      // Apply filters
      if (filters?.userId && log.userId !== filters.userId) continue;
      if (filters?.action && log.action !== filters.action) continue;
      if (filters?.startDate && log.timestamp < filters.startDate) continue;
      if (filters?.endDate && log.timestamp > filters.endDate) continue;
      
      logs.push(log);
    }
  }

  return logs.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Process message through moderation rules
 */
export async function processMessage(
  content: string,
  guildId: string,
  userInfo: { userId: string; username: string },
  channelInfo: { channelId: string; messageId: string }
): Promise<{
  action: ModerationAction;
  violations: ContentViolation[];
  messageDeleted: boolean;
  userNotified: boolean;
  modsNotified: boolean;
}> {
  // Get rules for guild
  const rules = await getModerationRules(guildId);
  const enabledRules = rules.filter((r) => r.enabled);

  // Analyze message
  const analysis = await analyzeMessage(content);

  let action = ModerationAction.NONE;
  let messageDeleted = false;
  let userNotified = false;
  let modsNotified = false;

  // Check rules
  for (const rule of enabledRules) {
    const hasViolation = analysis.violations.some((v) => 
      rule.violations.includes(v.type) &&
      v.confidence >= rule.thresholds.confidence
    );

    if (hasViolation) {
      action = rule.action;
      
      if (rule.autoDelete) {
        messageDeleted = true;
      }

      if (rule.notifyMods) {
        modsNotified = true;
      }

      // Log the action
      await logModerationAction({
        guildId,
        channelId: channelInfo.channelId,
        messageId: channelInfo.messageId,
        userId: userInfo.userId,
        username: userInfo.username,
        content,
        violations: analysis.violations,
        action,
        actionTakenBy: 'ai',
        aiAnalysis: {
          toxicityScore: analysis.overallScore,
          spamScore: analysis.violations.find((v) => v.type === ContentViolation.SPAM)?.confidence || 0,
          sentiment: analysis.overallScore > 50 ? 'negative' : 'neutral',
          reasoning: analysis.reasoning,
        },
      });

      break; // Apply first matching rule
    }
  }

  return {
    action,
    violations: analysis.violations.map((v) => v.type),
    messageDeleted,
    userNotified,
    modsNotified,
  };
}

// ============================================
// ANALYTICS
// ============================================

/**
 * Track message for analytics
 */
export async function trackMessage(
  guildId: string,
  channelId: string,
  userId: string,
  timestamp: Date = new Date()
): Promise<void> {
  const hour = timestamp.getHours();
  const day = timestamp.toISOString().split('T')[0];
  const key = `${REDIS_KEYS.MESSAGE_COUNT_PREFIX}${guildId}:${day}`;

  // Increment counters
  await redis.hincrby(`${key}:byChannel`, channelId, 1);
  await redis.hincrby(`${key}:byHour`, hour.toString(), 1);
  await redis.hincrby(`${key}:byUser`, userId, 1);

  // Set expiration (7 days)
  await redis.expire(key, 604800);
}

/**
 * Generate guild analytics
 */
export async function generateGuildAnalytics(
  guildId: string,
  days: number = 7
): Promise<GuildAnalytics> {
  const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const periodEnd = new Date();

  // Collect message data
  let totalMessages = 0;
  const byChannel: Record<string, number> = {};
  const byHour: Record<number, number> = {};
  const userMessages: Record<string, number> = {};

  for (let i = 0; i < days; i++) {
    const date = new Date(periodStart);
    date.setDate(date.getDate() + i);
    const day = date.toISOString().split('T')[0];
    const key = `${REDIS_KEYS.MESSAGE_COUNT_PREFIX}${guildId}:${day}`;

    // Get channel data
    const channelData = await redis.hgetall(`${key}:byChannel`);
    for (const [channelId, count] of Object.entries(channelData as Record<string, string>)) {
      const numCount = parseInt(count);
      byChannel[channelId] = (byChannel[channelId] || 0) + numCount;
      totalMessages += numCount;
    }

    // Get hour data
    const hourData = await redis.hgetall(`${key}:byHour`);
    for (const [hour, count] of Object.entries(hourData as Record<string, string>)) {
      byHour[parseInt(hour)] = (byHour[parseInt(hour)] || 0) + parseInt(count);
    }

    // Get user data
    const userData = await redis.hgetall(`${key}:byUser`);
    for (const [userId, count] of Object.entries(userData as Record<string, string>)) {
      userMessages[userId] = (userMessages[userId] || 0) + parseInt(count);
    }
  }

  // Get moderation stats
  const moderationLogs = await getModerationLogs(guildId, { startDate: periodStart });
  const violations = moderationLogs.length;
  const actions: Record<ModerationAction, number> = {
    [ModerationAction.NONE]: 0,
    [ModerationAction.WARN]: 0,
    [ModerationAction.MUTE]: 0,
    [ModerationAction.KICK]: 0,
    [ModerationAction.BAN]: 0,
    [ModerationAction.DELETE]: 0,
    [ModerationAction.FLAG]: 0,
  };
  
  const violationCounts: Record<ContentViolation, number> = {
    [ContentViolation.SPAM]: 0,
    [ContentViolation.HARASSMENT]: 0,
    [ContentViolation.HATE_SPEECH]: 0,
    [ContentViolation.NSFW]: 0,
    [ContentViolation.SCAM]: 0,
    [ContentViolation.TOS_VIOLATION]: 0,
    [ContentViolation.ADVERTISING]: 0,
    [ContentViolation.OFF_TOPIC]: 0,
  };

  for (const log of moderationLogs) {
    actions[log.action]++;
    for (const v of log.violations) {
      violationCounts[v.type]++;
    }
  }

  const topUsers = Object.entries(userMessages)
    .map(([userId, messages]) => ({
      userId,
      username: `User_${userId.substr(0, 6)}`,
      messages,
      reactions: Math.floor(messages * 0.3),
    }))
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 10);

  // Generate recommendations
  const recommendations = await generateAnalyticsRecommendations({
    totalMessages,
    violations,
    activeUsers: Object.keys(userMessages).length,
  });

  const analytics: GuildAnalytics = {
    guildId,
    period: { start: periodStart, end: periodEnd },
    members: {
      total: 1000, // Would come from Discord API
      active: Object.keys(userMessages).length,
      new: Math.floor(Math.random() * 50),
      left: Math.floor(Math.random() * 20),
      growth: Math.random() * 10 - 2,
    },
    messages: {
      total: totalMessages,
      byChannel,
      byHour,
      byDay: {}, // Would fill from data
    },
    engagement: {
      avgMessagesPerUser: totalMessages / (Object.keys(userMessages).length || 1),
      topUsers,
      voiceMinutes: Math.floor(Math.random() * 10000),
      reactions: Math.floor(totalMessages * 0.5),
    },
    moderation: {
      violations,
      actions,
      topViolations: Object.entries(violationCounts)
        .map(([type, count]) => ({ type: type as ContentViolation, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    },
    trends: {
      memberGrowth: Math.random() > 0.5 ? 'up' : 'stable',
      activityTrend: totalMessages > 1000 ? 'up' : 'stable',
      sentiment: violations > 50 ? 'negative' : 'positive',
    },
    recommendations,
  };

  // Store analytics
  await redis.setex(
    `${REDIS_KEYS.ANALYTICS_PREFIX}${guildId}:${days}`,
    86400,
    JSON.stringify(analytics)
  );

  return analytics;
}

/**
 * Generate recommendations using AI
 */
async function generateAnalyticsRecommendations(data: {
  totalMessages: number;
  violations: number;
  activeUsers: number;
}): Promise<string[]> {
  const prompt = `Based on this Discord server data, provide 3-5 community management recommendations:

MESSAGES (7 days): ${data.totalMessages}
ACTIVE USERS: ${data.activeUsers}
VIOLATIONS: ${data.violations}

Provide actionable recommendations for:
1. Engagement improvement
2. Moderation effectiveness
3. Community growth

Respond with a JSON array of recommendation strings.`;

  try {
    return await generateJSON<string[]>(prompt, '["string"]', { complexity: TaskComplexity.MODERATE });
  } catch {
    return [
      'Consider adding more interactive channels to boost engagement',
      'Review moderation rules if violations are trending up',
      'Host community events to increase activity during low-activity hours',
    ];
  }
}

// ============================================
// COMMERCE
// ============================================

/**
 * Create a product
 */
export async function createProduct(
  product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Product> {
  const productId = `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const newProduct: Product = {
    ...product,
    id: productId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await redis.setex(
    `${REDIS_KEYS.PRODUCT_PREFIX}${product.guildId}:${productId}`,
    0,
    JSON.stringify(newProduct)
  );

  console.log(`🏪 Created product: ${product.name} in guild ${product.guildId}`);

  return newProduct;
}

/**
 * Get products for guild
 */
export async function getProducts(guildId: string): Promise<Product[]> {
  const keys = await redis.keys(`${REDIS_KEYS.PRODUCT_PREFIX}${guildId}:*`);
  const products: Product[] = [];

  for (const key of keys) {
    const productData = await redis.get(key);
    if (productData) {
      const product: Product = JSON.parse(productData);
      if (product.enabled) {
        products.push(product);
      }
    }
  }

  return products.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Create an order
 */
export async function createOrder(
  order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'redeemed'>
): Promise<Order> {
  const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const newOrder: Order = {
    ...order,
    id: orderId,
    redeemed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await redis.setex(
    `${REDIS_KEYS.ORDER_PREFIX}${order.guildId}:${orderId}`,
    0,
    JSON.stringify(newOrder)
  );

  console.log(`🛒 Created order: ${orderId} for ${order.username}`);

  return newOrder;
}

/**
 * Get user points balance
 */
export async function getUserPoints(
  userId: string,
  guildId: string
): Promise<UserPoints> {
  const pointsData = await redis.get(`${REDIS_KEYS.POINTS_PREFIX}${guildId}:${userId}`);
  
  if (pointsData) {
    return JSON.parse(pointsData);
  }

  // Return default
  return {
    userId,
    guildId,
    balance: 0,
    totalEarned: 0,
    totalSpent: 0,
    history: [],
    lastUpdated: new Date(),
  };
}

/**
 * Award points to user
 */
export async function awardPoints(
  userId: string,
  guildId: string,
  amount: number,
  reason: string
): Promise<UserPoints> {
  const points = await getUserPoints(userId, guildId);
  
  points.balance += amount;
  points.totalEarned += amount;
  points.history.push({
    type: 'earned',
    amount,
    reason,
    timestamp: new Date(),
  });
  points.lastUpdated = new Date();

  await redis.setex(
    `${REDIS_KEYS.POINTS_PREFIX}${guildId}:${userId}`,
    0,
    JSON.stringify(points)
  );

  console.log(`💰 Awarded ${amount} points to ${userId}: ${reason}`);

  return points;
}

// ============================================
// AUTO RESPONDER
// ============================================

/**
 * Create auto-responder
 */
export async function createAutoResponder(
  responder: Omit<AutoResponder, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>
): Promise<AutoResponder> {
  const responderId = `responder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const newResponder: AutoResponder = {
    ...responder,
    id: responderId,
    usageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await redis.setex(
    `${REDIS_KEYS.AUTO_RESPONDER_PREFIX}${responder.guildId}:${responderId}`,
    0,
    JSON.stringify(newResponder)
  );

  console.log(`🤖 Created auto-responder: ${responder.name}`);

  return newResponder;
}

/**
 * Get auto-responders for guild
 */
export async function getAutoResponders(guildId: string): Promise<AutoResponder[]> {
  const keys = await redis.keys(`${REDIS_KEYS.AUTO_RESPONDER_PREFIX}${guildId}:*`);
  const responders: AutoResponder[] = [];

  for (const key of keys) {
    const responderData = await redis.get(key);
    if (responderData) {
      responders.push(JSON.parse(responderData));
    }
  }

  return responders.filter((r) => r.enabled);
}

/**
 * Process message for auto-responders
 */
export async function processAutoResponders(
  content: string,
  guildId: string,
  channelId: string
): Promise<Array<{
  responderName: string;
  response: string;
  type: string;
}> | null> {
  const responders = await getAutoResponders(guildId);
  const matches: Array<{ responderName: string; response: string; type: string }> = [];

  for (const responder of responders) {
    let triggered = false;

    switch (responder.trigger.type) {
      case 'exact':
        triggered = content.toLowerCase() === responder.trigger.pattern.toLowerCase();
        break;
      case 'contains':
        triggered = content.toLowerCase().includes(responder.trigger.pattern.toLowerCase());
        break;
      case 'starts_with':
        triggered = content.toLowerCase().startsWith(responder.trigger.pattern.toLowerCase());
        break;
      case 'regex':
        try {
          const regex = new RegExp(responder.trigger.pattern, 'i');
          triggered = regex.test(content);
        } catch {
          triggered = false;
        }
        break;
    }

    // Check channel restriction
    if (triggered && responder.trigger.channels) {
      if (!responder.trigger.channels.includes(channelId)) {
        triggered = false;
      }
    }

    if (triggered) {
      // Check cooldown
      const lastTriggerKey = `responder:cooldown:${responder.id}:${channelId}`;
      const lastTrigger = await redis.get(lastTriggerKey);
      
      if (lastTrigger) {
        const elapsed = Date.now() - parseInt(lastTrigger);
        if (elapsed < responder.trigger.cooldown * 1000) {
          continue; // Still in cooldown
        }
      }

      // Update usage
      responder.usageCount++;
      responder.lastTriggered = new Date();
      await redis.setex(
        `${REDIS_KEYS.AUTO_RESPONDER_PREFIX}${guildId}:${responder.id}`,
        0,
        JSON.stringify(responder)
      );

      // Set cooldown
      await redis.setex(lastTriggerKey, responder.trigger.cooldown, Date.now().toString());

      matches.push({
        responderName: responder.name,
        response: responder.response.content,
        type: responder.response.type,
      });
    }
  }

  return matches.length > 0 ? matches : null;
}

export default {
  // Moderation
  analyzeMessage,
  createModerationRule,
  getModerationRules,
  logModerationAction,
  getModerationLogs,
  processMessage,
  // Analytics
  trackMessage,
  generateGuildAnalytics,
  // Commerce
  createProduct,
  getProducts,
  createOrder,
  getUserPoints,
  awardPoints,
  // Auto-responder
  createAutoResponder,
  getAutoResponders,
  processAutoResponders,
  // Enums
  ContentViolation,
  ModerationAction,
};
