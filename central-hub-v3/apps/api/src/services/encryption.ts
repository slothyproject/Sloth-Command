/**
 * encryption.ts — AES-256-GCM encryption service
 * Ported from Dissident-Tokens-Vault/services/credential-vault.js
 *
 * Used for:
 *  - Variable values where isSecret=true
 *  - Credential token storage
 */

import crypto from 'crypto';

interface EncryptedPayload {
  iv: string;           // hex, 16 bytes
  tag: string;          // hex, 16 bytes (GCM auth tag)
  data: string;         // hex ciphertext
  algorithm: 'aes-256-gcm';
}

function deriveMasterKey(): Buffer {
  const keyEnv = process.env.ENCRYPTION_MASTER_KEY;
  if (!keyEnv) {
    console.warn('[Encryption] WARNING: ENCRYPTION_MASTER_KEY not set — using insecure fallback key. Set this env var in production!');
    return crypto.scryptSync('fallback-key-change-in-production', 'salt', 32);
  }
  return crypto.scryptSync(keyEnv, 'salt', 32);
}

// Derive once at module load time so we don't re-derive on every call
const MASTER_KEY: Buffer = deriveMasterKey();

export function encrypt(plaintext: string): EncryptedPayload {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted,
    algorithm: 'aes-256-gcm',
  };
}

export function decrypt(payload: EncryptedPayload): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    MASTER_KEY,
    Buffer.from(payload.iv, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
  let decrypted = decipher.update(payload.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/** Returns first 4 chars + **** + last 4 chars for display */
export function maskSecret(value: string): string {
  if (!value || value.length < 8) return '••••';
  return value.substring(0, 4) + '••••' + value.substring(value.length - 4);
}

/** True when the master key is properly configured */
export function isEncryptionConfigured(): boolean {
  return !!process.env.ENCRYPTION_MASTER_KEY;
}
