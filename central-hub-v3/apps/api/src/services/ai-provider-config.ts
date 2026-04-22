import { PrismaClient } from '@prisma/client';
import { decrypt, encrypt, maskSecret } from './encryption';

const prisma = new PrismaClient();

export type SupportedAIProvider = 'ollama' | 'openai' | 'anthropic';

export interface UserProviderConfig {
  provider: SupportedAIProvider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  enabled?: boolean;
}

interface StoredProviderPayload {
  provider: SupportedAIProvider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  enabled?: boolean;
}

const SERVICE_TYPE = 'ai-provider';

function configName(userId: string, provider: SupportedAIProvider): string {
  return `${userId}:${provider}`;
}

function parseProviderFromName(name: string): SupportedAIProvider | null {
  const provider = name.split(':').pop();
  if (provider === 'ollama' || provider === 'openai' || provider === 'anthropic') {
    return provider;
  }
  return null;
}

function toStoredPayload(input: UserProviderConfig): StoredProviderPayload {
  return {
    provider: input.provider,
    apiKey: input.apiKey.trim(),
    baseUrl: input.baseUrl?.trim() || undefined,
    model: input.model?.trim() || undefined,
    enabled: input.enabled ?? true,
  };
}

export async function saveUserProviderConfig(
  userId: string,
  input: UserProviderConfig
): Promise<void> {
  const payload = toStoredPayload(input);

  if (!payload.apiKey) {
    throw new Error('API key is required');
  }

  const encrypted = encrypt(JSON.stringify(payload));
  const name = configName(userId, payload.provider);

  const existing = await prisma.credential.findFirst({
    where: {
      serviceType: SERVICE_TYPE,
      name,
    },
  });

  if (existing) {
    await prisma.credential.update({
      where: { id: existing.id },
      data: {
        encryptedToken: encrypted.data,
        iv: encrypted.iv,
        encryptionTag: encrypted.tag,
      },
    });
    return;
  }

  await prisma.credential.create({
    data: {
      serviceType: SERVICE_TYPE,
      name,
      encryptedToken: encrypted.data,
      iv: encrypted.iv,
      encryptionTag: encrypted.tag,
    },
  });
}

export async function getUserProviderConfigs(
  userId: string
): Promise<Partial<Record<SupportedAIProvider, UserProviderConfig>>> {
  const rows = await prisma.credential.findMany({
    where: {
      serviceType: SERVICE_TYPE,
      name: { startsWith: `${userId}:` },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const result: Partial<Record<SupportedAIProvider, UserProviderConfig>> = {};

  for (const row of rows) {
    try {
      const provider = parseProviderFromName(row.name);
      if (!provider) {
        continue;
      }

      const decrypted = decrypt({
        iv: row.iv,
        tag: row.encryptionTag,
        data: row.encryptedToken,
        algorithm: 'aes-256-gcm',
      });

      const payload = JSON.parse(decrypted) as StoredProviderPayload;

      result[provider] = {
        provider,
        apiKey: payload.apiKey,
        baseUrl: payload.baseUrl,
        model: payload.model,
        enabled: payload.enabled ?? true,
      };
    } catch (error) {
      console.error(`Failed to decrypt AI provider config for ${row.name}:`, error);
    }
  }

  return result;
}

export async function getUserProviderStatuses(userId: string): Promise<Array<{
  provider: SupportedAIProvider;
  configured: boolean;
  enabled: boolean;
  hasBaseUrl: boolean;
  baseUrl?: string;
  model?: string;
  maskedApiKey?: string;
}>> {
  const configs = await getUserProviderConfigs(userId);

  const providers: SupportedAIProvider[] = ['ollama', 'openai', 'anthropic'];

  return providers.map((provider) => {
    const cfg = configs[provider];
    return {
      provider,
      configured: !!cfg?.apiKey,
      enabled: cfg?.enabled ?? false,
      hasBaseUrl: !!cfg?.baseUrl,
      baseUrl: cfg?.baseUrl,
      model: cfg?.model,
      maskedApiKey: cfg?.apiKey ? maskSecret(cfg.apiKey) : undefined,
    };
  });
}

export async function deleteUserProviderConfig(
  userId: string,
  provider: SupportedAIProvider
): Promise<void> {
  await prisma.credential.deleteMany({
    where: {
      serviceType: SERVICE_TYPE,
      name: configName(userId, provider),
    },
  });
}

export async function markProviderUsed(
  userId: string,
  provider: SupportedAIProvider
): Promise<void> {
  await prisma.credential.updateMany({
    where: {
      serviceType: SERVICE_TYPE,
      name: configName(userId, provider),
    },
    data: {
      lastUsedAt: new Date(),
    },
  });
}
