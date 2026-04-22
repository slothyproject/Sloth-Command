/**
 * Discord Client Middleware
 * Injects Discord bot client into request context for guild operations
 */

import { Request, Response, NextFunction } from 'express';
import { Client } from 'discord.js';

declare global {
  namespace Express {
    interface Request {
      discordClient?: Client;
    }
  }
}

let globalDiscordClient: Client | null = null;

/**
 * Register the Discord client globally
 */
export function registerDiscordClient(client: Client) {
  globalDiscordClient = client;
  console.log('[OK] Discord client registered in middleware');
}

/**
 * Middleware to inject Discord client into request
 */
export function discordClientMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!globalDiscordClient) {
    console.warn('[WARN] Discord client not available in middleware');
  }
  req.discordClient = globalDiscordClient || undefined;
  next();
}

/**
 * Get the registered Discord client
 */
export function getDiscordClient(): Client | null {
  return globalDiscordClient;
}
