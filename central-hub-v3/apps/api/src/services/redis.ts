/**
 * Redis Service
 * Provides caching, session management, and pub/sub capabilities
 * Critical for performance and reliability
 */

import Redis from 'ioredis';

// Redis configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Cache TTLs (in seconds)
const CACHE_TTL = {
  SERVICES: 300,        // 5 minutes
  METRICS: 60,          // 1 minute
  AI_INSIGHTS: 600,     // 10 minutes
  HEALTH_STATUS: 30,    // 30 seconds
  API_RESPONSES: 300,   // 5 minutes
  SESSIONS: 86400,      // 24 hours
  RATE_LIMITS: 60,      // 1 minute
};

// Initialize Redis client
let redis: Redis | null = null;

/**
 * Initialize Redis connection
 */
export function initializeRedis(): Redis {
  if (redis) return redis;

  try {
    redis = new Redis(REDIS_URL, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        console.log(`🔴 Redis reconnect attempt ${times}, retrying in ${delay}ms...`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });

    redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redis.on('error', (error) => {
      console.error('❌ Redis error:', error.message);
    });

    redis.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });

    return redis;
  } catch (error) {
    console.error('❌ Failed to initialize Redis:', error);
    throw error;
  }
}

/**
 * Get Redis client (initialize if needed)
 */
export function getRedis(): Redis {
  if (!redis) {
    return initializeRedis();
  }
  return redis;
}

// Backward-compatible export for older services that import `{ redis }`.
export const redisClient = getRedis();
export { redisClient as redis };

/**
 * Cache a value with TTL
 */
export async function setCache(
  key: string,
  value: any,
  ttl: number = CACHE_TTL.API_RESPONSES
): Promise<void> {
  try {
    const client = getRedis();
    const serialized = JSON.stringify(value);
    await client.setex(key, ttl, serialized);
  } catch (error) {
    console.error(`❌ Cache set failed for key ${key}:`, error);
    // Don't throw - cache failures shouldn't break the app
  }
}

/**
 * Get cached value
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const client = getRedis();
    const data = await client.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    console.error(`❌ Cache get failed for key ${key}:`, error);
    return null;
  }
}

/**
 * Delete cached value
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    const client = getRedis();
    await client.del(key);
  } catch (error) {
    console.error(`❌ Cache delete failed for key ${key}:`, error);
  }
}

/**
 * Clear cache by pattern
 */
export async function clearCachePattern(pattern: string): Promise<void> {
  try {
    const client = getRedis();
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
      console.log(`🧹 Cleared ${keys.length} cache entries matching ${pattern}`);
    }
  } catch (error) {
    console.error(`❌ Cache clear failed for pattern ${pattern}:`, error);
  }
}

/**
 * Cache wrapper for async functions
 */
export function withCache<T>(
  fn: (...args: any[]) => Promise<T>,
  keyGenerator: (...args: any[]) => string,
  ttl: number = CACHE_TTL.API_RESPONSES
): (...args: any[]) => Promise<T> {
  return async (...args: any[]): Promise<T> => {
    const cacheKey = keyGenerator(...args);
    
    // Try to get from cache
    const cached = await getCache<T>(cacheKey);
    if (cached !== null) {
      console.log(`📦 Cache hit: ${cacheKey}`);
      return cached;
    }
    
    // Execute function
    console.log(`🔍 Cache miss: ${cacheKey}`);
    const result = await fn(...args);
    
    // Store in cache
    await setCache(cacheKey, result, ttl);
    
    return result;
  };
}

/**
 * Session management
 */
export const session = {
  async set(sessionId: string, data: any, ttl: number = CACHE_TTL.SESSIONS): Promise<void> {
    const key = `session:${sessionId}`;
    await setCache(key, data, ttl);
  },

  async get<T>(sessionId: string): Promise<T | null> {
    const key = `session:${sessionId}`;
    return getCache<T>(key);
  },

  async destroy(sessionId: string): Promise<void> {
    const key = `session:${sessionId}`;
    await deleteCache(key);
  },
};

/**
 * Rate limiting
 */
export const rateLimit = {
  async isAllowed(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
    try {
      const client = getRedis();
      const current = await client.incr(key);
      
      if (current === 1) {
        // First request, set expiry
        await client.expire(key, windowSeconds);
      }
      
      return current <= maxRequests;
    } catch (error) {
      console.error('❌ Rate limit check failed:', error);
      // Allow request if Redis is down (fail open)
      return true;
    }
  },

  async getRemaining(key: string, maxRequests: number): Promise<number> {
    try {
      const client = getRedis();
      const current = await client.get(key);
      if (!current) return maxRequests;
      return Math.max(0, maxRequests - parseInt(current, 10));
    } catch (error) {
      return maxRequests;
    }
  },
};

/**
 * Pub/Sub for real-time updates
 */
export const pubsub = {
  async publish(channel: string, message: any): Promise<void> {
    try {
      const client = getRedis();
      await client.publish(channel, JSON.stringify(message));
    } catch (error) {
      console.error(`❌ Pub failed for channel ${channel}:`, error);
    }
  },

  subscribe(channel: string, callback: (message: any) => void): void {
    try {
      const subscriber = new Redis(REDIS_URL);
      
      subscriber.subscribe(channel, (err) => {
        if (err) {
          console.error(`❌ Subscribe failed for channel ${channel}:`, err);
        } else {
          console.log(`📡 Subscribed to channel: ${channel}`);
        }
      });

      subscriber.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          try {
            const data = JSON.parse(message);
            callback(data);
          } catch (error) {
            console.error('❌ Failed to parse pub/sub message:', error);
          }
        }
      });
    } catch (error) {
      console.error(`❌ Pub/sub setup failed for channel ${channel}:`, error);
    }
  },
};

/**
 * Health check
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = getRedis();
    await client.ping();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Graceful shutdown
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    console.log('👋 Redis connection closed');
  }
}

// Export everything
export { CACHE_TTL };
export default {
  initializeRedis,
  getRedis,
  setCache,
  getCache,
  deleteCache,
  clearCachePattern,
  withCache,
  session,
  rateLimit,
  pubsub,
  checkRedisHealth,
  closeRedis,
  CACHE_TTL,
};
