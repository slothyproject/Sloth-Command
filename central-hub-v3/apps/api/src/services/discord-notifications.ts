/**
 * discord-notifications.ts — Ops notifications via Discord webhook
 * Ported from Dissident-Tokens-Vault/js/vault-discord.js
 *
 * Configure by setting DISCORD_WEBHOOK_URL in the environment.
 * All notify() calls are fire-and-forget; failures never throw to callers.
 */

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL ?? '';

const WEBHOOK_PATTERN = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export type NotifyEvent =
  | 'VAULT_UNLOCKED'
  | 'VAULT_LOCKED'
  | 'VARIABLE_CHANGED'
  | 'VARIABLE_ADDED'
  | 'VARIABLE_DELETED'
  | 'DEPLOYMENT_STARTED'
  | 'DEPLOYMENT_SUCCESS'
  | 'DEPLOYMENT_FAILED'
  | 'BACKUP_CREATED'
  | 'BACKUP_RESTORED'
  | 'SECURITY_ALERT'
  | 'SYNC_COMPLETED'
  | 'DRIFT_DETECTED';

interface EventMeta {
  emoji: string;
  color: number;
  title: string;
}

const EVENT_META: Record<NotifyEvent, EventMeta> = {
  VAULT_UNLOCKED:      { emoji: '🔓', color: 0x3b82f6, title: 'Vault Accessed' },
  VAULT_LOCKED:        { emoji: '🔒', color: 0x9ca3af, title: 'Vault Locked' },
  VARIABLE_CHANGED:    { emoji: '✏️',  color: 0xf59e0b, title: 'Variable Updated' },
  VARIABLE_ADDED:      { emoji: '➕', color: 0x10b981, title: 'Variable Added' },
  VARIABLE_DELETED:    { emoji: '🗑️',  color: 0xef4444, title: 'Variable Deleted' },
  DEPLOYMENT_STARTED:  { emoji: '🚀', color: 0x667eea, title: 'Deployment Started' },
  DEPLOYMENT_SUCCESS:  { emoji: '✅', color: 0x10b981, title: 'Deployment Successful' },
  DEPLOYMENT_FAILED:   { emoji: '❌', color: 0xef4444, title: 'Deployment Failed' },
  BACKUP_CREATED:      { emoji: '💾', color: 0x3b82f6, title: 'Backup Created' },
  BACKUP_RESTORED:     { emoji: '📥', color: 0x10b981, title: 'Backup Restored' },
  SECURITY_ALERT:      { emoji: '⚠️',  color: 0xdc2626, title: 'Security Alert' },
  SYNC_COMPLETED:      { emoji: '🔄', color: 0x10b981, title: 'Sync Completed' },
  DRIFT_DETECTED:      { emoji: '⚡', color: 0xf59e0b, title: 'Configuration Drift Detected' },
};

type EmbedField = { name: string; value: string; inline?: boolean };

function maskSecret(value: string): string {
  if (!value || value.length <= 8) return '••••';
  return value.substring(0, 4) + '••••' + value.substring(value.length - 4);
}

function buildEmbed(eventType: NotifyEvent, data: Record<string, unknown>) {
  const meta = EVENT_META[eventType];
  const fields: EmbedField[] = [];

  switch (eventType) {
    case 'VARIABLE_CHANGED':
    case 'VARIABLE_ADDED':
    case 'VARIABLE_DELETED':
      fields.push(
        { name: 'Service',  value: String(data.service  ?? 'Unknown'), inline: true },
        { name: 'Variable', value: String(data.variable ?? 'Unknown'), inline: true },
      );
      if (data.oldValue) fields.push({ name: 'Old Value', value: maskSecret(String(data.oldValue)) });
      if (data.newValue) fields.push({ name: 'New Value', value: maskSecret(String(data.newValue)) });
      break;

    case 'DEPLOYMENT_STARTED':
    case 'DEPLOYMENT_SUCCESS':
    case 'DEPLOYMENT_FAILED':
      fields.push(
        { name: 'Service',     value: String(data.service     ?? 'Unknown'),    inline: true },
        { name: 'Environment', value: String(data.environment ?? 'production'), inline: true },
      );
      if (data.duration) fields.push({ name: 'Duration', value: String(data.duration), inline: true });
      if (data.error)    fields.push({ name: 'Error',    value: String(data.error).substring(0, 1024) });
      break;

    case 'SECURITY_ALERT':
      fields.push(
        { name: 'Alert Type', value: String(data.alertType ?? 'Unknown'), inline: true },
        { name: 'Details',    value: String(data.details   ?? 'No details') },
      );
      if (data.ip) fields.push({ name: 'IP Address', value: String(data.ip), inline: true });
      break;

    case 'SYNC_COMPLETED':
      fields.push(
        { name: 'Service',          value: String(data.service ?? 'All services'), inline: true },
        { name: 'Variables Synced', value: String(data.count   ?? 'Unknown'),      inline: true },
      );
      break;

    case 'DRIFT_DETECTED':
      fields.push(
        { name: 'Service',     value: String(data.service     ?? 'Unknown'), inline: true },
        { name: 'Differences', value: String(data.differences ?? 'Unknown'), inline: true },
      );
      break;

    default:
      if (data.duration) fields.push({ name: 'Duration', value: String(data.duration), inline: true });
      break;
  }

  return {
    title:     `${meta.emoji} ${meta.title}`,
    color:     meta.color,
    timestamp: new Date().toISOString(),
    fields,
    footer: { text: 'Central Command' },
  };
}

export async function notify(eventType: NotifyEvent, data: Record<string, unknown> = {}): Promise<void> {
  if (!WEBHOOK_URL || !WEBHOOK_PATTERN.test(WEBHOOK_URL)) {
    // No webhook configured — log to console only
    const meta = EVENT_META[eventType];
    console.log(`[DiscordNotify] ${meta.emoji} ${meta.title}`, data);
    return;
  }

  try {
    const res = await fetch(WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ embeds: [buildEmbed(eventType, data)] }),
    });
    if (!res.ok) {
      console.error(`[DiscordNotify] Webhook returned ${res.status}`);
    }
  } catch (err) {
    console.error('[DiscordNotify] Failed to send webhook:', err);
  }
}

// Convenience helpers matching the Vault API surface
export const discordNotify = {
  deploymentStarted: (service: string, environment = 'production') =>
    notify('DEPLOYMENT_STARTED', { service, environment }),

  deploymentSuccess: (service: string, environment = 'production', duration?: string) =>
    notify('DEPLOYMENT_SUCCESS', { service, environment, duration }),

  deploymentFailed: (service: string, environment = 'production', error?: string) =>
    notify('DEPLOYMENT_FAILED', { service, environment, error }),

  variableAdded: (service: string, variable: string, newValue?: string) =>
    notify('VARIABLE_ADDED', { service, variable, newValue }),

  variableChanged: (service: string, variable: string, oldValue?: string, newValue?: string) =>
    notify('VARIABLE_CHANGED', { service, variable, oldValue, newValue }),

  variableDeleted: (service: string, variable: string) =>
    notify('VARIABLE_DELETED', { service, variable }),

  syncCompleted: (service: string, count: number) =>
    notify('SYNC_COMPLETED', { service, count }),

  driftDetected: (service: string, differences: number) =>
    notify('DRIFT_DETECTED', { service, differences }),

  securityAlert: (alertType: string, details: string, ip?: string) =>
    notify('SECURITY_ALERT', { alertType, details, ip }),
};
