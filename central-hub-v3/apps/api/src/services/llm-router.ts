/**
 * Multi-LLM Router Service
 * Intelligent LLM selection with automatic failover
 * Provides redundancy and cost optimization across multiple AI providers
 */

import OpenAI from 'openai';
import {
  getUserProviderConfigs,
  markProviderUsed,
  type SupportedAIProvider,
  type UserProviderConfig,
} from './ai-provider-config';

// LLM Provider configurations
interface LLMConfig {
  name: string;
  enabled: boolean;
  priority: number; // Lower = higher priority (1 = primary)
  costPer1KTokens: number; // For cost optimization
  maxTokens: number;
  supportsFunctions: boolean;
  supportsStreaming: boolean;
  timeout: number;
  retryAttempts: number;
}

// Provider configurations
const LLM_CONFIGS: Record<string, LLMConfig> = {
  ollama: {
    name: 'Ollama Cloud',
    enabled: !!process.env.OLLAMA_API_KEY || process.env.OLLAMA_HOST !== 'http://localhost:11434',
    priority: 1, // Primary
    costPer1KTokens: 0.0, // Free (or included in Ollama Cloud subscription)
    maxTokens: 4096,
    supportsFunctions: false,
    supportsStreaming: true,
    timeout: 30000,
    retryAttempts: 3,
  },
  openai: {
    name: 'OpenAI GPT-4o',
    enabled: !!process.env.OPENAI_API_KEY,
    priority: 2, // Fallback 1
    costPer1KTokens: 0.005, // $5 per 1M input tokens
    maxTokens: 8192,
    supportsFunctions: true,
    supportsStreaming: true,
    timeout: 30000,
    retryAttempts: 3,
  },
  anthropic: {
    name: 'Anthropic Claude 3.5',
    enabled: !!process.env.ANTHROPIC_API_KEY,
    priority: 3, // Fallback 2
    costPer1KTokens: 0.003, // $3 per 1M input tokens
    maxTokens: 8192,
    supportsFunctions: true,
    supportsStreaming: true,
    timeout: 30000,
    retryAttempts: 2,
  },
};

// Task complexity levels
enum TaskComplexity {
  SIMPLE = 'simple',           // Quick responses, status checks
  MODERATE = 'moderate',       // Analysis, summaries
  COMPLEX = 'complex',         // Deep reasoning, multi-step
  CODE = 'code',               // Code generation/review
}

// Model selection by complexity
const MODELS_BY_COMPLEXITY: Record<TaskComplexity, Record<string, string>> = {
  [TaskComplexity.SIMPLE]: {
    ollama: 'llama3.1:8b',
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-haiku-20240307',
  },
  [TaskComplexity.MODERATE]: {
    ollama: 'mistral:7b',
    openai: 'gpt-4o',
    anthropic: 'claude-3-sonnet-20240229',
  },
  [TaskComplexity.COMPLEX]: {
    ollama: 'llama3.1:70b',
    openai: 'gpt-4o',
    anthropic: 'claude-3-5-sonnet-20240620',
  },
  [TaskComplexity.CODE]: {
    ollama: 'codellama:7b',
    openai: 'gpt-4o',
    anthropic: 'claude-3-5-sonnet-20240620',
  },
};

interface GenerateOptions {
  complexity?: TaskComplexity;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  timeout?: number;
  fallbackEnabled?: boolean;
  trackUsage?: boolean;
  userId?: string;
}

type RuntimeProviderConfig = Pick<UserProviderConfig, 'apiKey' | 'baseUrl' | 'model' | 'enabled'>;

interface GenerateResult {
  response: string;
  provider: string;
  model: string;
  latency: number;
  tokensUsed?: number;
  cost?: number;
  fromCache?: boolean;
  retries: number;
}

interface ProviderStatus {
  provider: string;
  name: string;
  enabled: boolean;
  healthy: boolean;
  lastError?: string;
  lastUsed?: Date;
  averageLatency: number;
  successRate: number;
}

// Circuit breaker state
const circuitBreakers: Record<string, { failures: number; lastFailure: Date; open: boolean }> = {
  ollama: { failures: 0, lastFailure: new Date(0), open: false },
  openai: { failures: 0, lastFailure: new Date(0), open: false },
  anthropic: { failures: 0, lastFailure: new Date(0), open: false },
};

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

/**
 * Check if circuit breaker is open for a provider
 */
function isCircuitBreakerOpen(provider: string): boolean {
  const cb = circuitBreakers[provider];
  if (!cb.open) return false;
  
  // Check if we should half-open
  const timeSinceLastFailure = Date.now() - cb.lastFailure.getTime();
  if (timeSinceLastFailure > CIRCUIT_BREAKER_TIMEOUT) {
    cb.open = false;
    cb.failures = 0;
    console.log(`🔓 Circuit breaker half-open for ${provider}`);
    return false;
  }
  
  return true;
}

/**
 * Record success for circuit breaker
 */
function recordSuccess(provider: string): void {
  const cb = circuitBreakers[provider];
  if (cb.failures > 0) {
    cb.failures = Math.max(0, cb.failures - 1);
    console.log(`✅ Circuit breaker success for ${provider}, failures: ${cb.failures}`);
  }
}

/**
 * Record failure for circuit breaker
 */
function recordFailure(provider: string, error: Error): void {
  const cb = circuitBreakers[provider];
  cb.failures++;
  cb.lastFailure = new Date();
  
  if (cb.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    cb.open = true;
    console.error(`🔒 Circuit breaker OPEN for ${provider} after ${cb.failures} failures: ${error.message}`);
  } else {
    console.warn(`⚠️ Circuit breaker warning for ${provider}: ${cb.failures}/${CIRCUIT_BREAKER_THRESHOLD} failures`);
  }
}

/**
 * Determine task complexity based on prompt characteristics
 */
function analyzeComplexity(prompt: string): TaskComplexity {
  const lowerPrompt = prompt.toLowerCase();
  
  // Code-related
  if (lowerPrompt.includes('code') || 
      lowerPrompt.includes('function') || 
      lowerPrompt.includes('debug') ||
      lowerPrompt.includes('error')) {
    return TaskComplexity.CODE;
  }
  
  // Complex reasoning indicators
  if (lowerPrompt.includes('analyze') || 
      lowerPrompt.includes('compare') || 
      lowerPrompt.includes('evaluate') ||
      lowerPrompt.includes('optimize') ||
      prompt.length > 1000) {
    return TaskComplexity.COMPLEX;
  }
  
  // Moderate
  if (lowerPrompt.includes('explain') || 
      lowerPrompt.includes('summarize') ||
      lowerPrompt.includes('describe') ||
      prompt.length > 500) {
    return TaskComplexity.MODERATE;
  }
  
  return TaskComplexity.SIMPLE;
}

/**
 * Get ordered list of available providers
 */
function getAvailableProviders(): string[] {
  return Object.entries(LLM_CONFIGS)
    .filter(([_, config]) => config.enabled)
    .filter(([provider]) => !isCircuitBreakerOpen(provider))
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([provider]) => provider);
}

function getAvailableUserProviders(
  userConfigs: Partial<Record<SupportedAIProvider, RuntimeProviderConfig>>
): SupportedAIProvider[] {
  return (Object.entries(LLM_CONFIGS) as Array<[SupportedAIProvider, LLMConfig]>)
    .filter(([provider]) => {
      const cfg = userConfigs[provider];
      return !!cfg?.apiKey && (cfg.enabled ?? true);
    })
    .filter(([provider]) => !isCircuitBreakerOpen(provider))
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([provider]) => provider);
}

/**
 * Generate with Ollama
 */
async function generateWithOllama(
  prompt: string,
  model: string,
  options: GenerateOptions,
  runtimeConfig: RuntimeProviderConfig
): Promise<{ response: string; tokensUsed?: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 30000);
  
  try {
    const ollamaHost = runtimeConfig.baseUrl || process.env.OLLAMA_HOST || 'http://localhost:11434';
    const response = await fetch(`${ollamaHost.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${runtimeConfig.apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        system: options.systemPrompt,
        temperature: options.temperature ?? 0.7,
        stream: false,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }
    
    const data: any = await response.json();
    
    return {
      response: data.response.trim(),
      tokensUsed: data.eval_count,
    };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * Generate with OpenAI
 */
async function generateWithOpenAI(
  prompt: string,
  model: string,
  options: GenerateOptions,
  runtimeConfig: RuntimeProviderConfig
): Promise<{ response: string; tokensUsed: number }> {
  const openai = new OpenAI({
    apiKey: runtimeConfig.apiKey,
    baseURL: runtimeConfig.baseUrl || process.env.OPENAI_BASE_URL,
  });

  const response = await openai.chat.completions.create({
    model,
    messages: [
      ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
      { role: 'user' as const, content: prompt },
    ],
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens,
  });
  
  return {
    response: response.choices[0]?.message?.content || '',
    tokensUsed: response.usage?.total_tokens || 0,
  };
}

/**
 * Generate with Anthropic (Claude)
 */
async function generateWithAnthropic(
  prompt: string,
  model: string,
  options: GenerateOptions,
  runtimeConfig: RuntimeProviderConfig
): Promise<{ response: string; tokensUsed?: number }> {
  // Note: Anthropic SDK would be imported here
  // For now, using fetch API
  const anthropicBase = runtimeConfig.baseUrl || 'https://api.anthropic.com';
  const response = await fetch(`${anthropicBase.replace(/\/$/, '')}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': runtimeConfig.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature ?? 0.7,
      system: options.systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Anthropic error: ${response.status} ${response.statusText}`);
  }
  
  const data: any = await response.json();
  
  return {
    response: data.content[0]?.text || '',
    tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
  };
}

/**
 * Main generation function with automatic failover
 */
export async function generate(
  prompt: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const startTime = Date.now();
  const complexity = options.complexity || analyzeComplexity(prompt);
  let providers: string[] = [];
  let userProviderConfigs: Partial<Record<SupportedAIProvider, RuntimeProviderConfig>> = {};

  if (options.userId) {
    userProviderConfigs = await getUserProviderConfigs(options.userId);
    providers = getAvailableUserProviders(userProviderConfigs);
    if (providers.length === 0) {
      throw new Error(
        'No user AI providers configured. Configure your own API key in Settings > Integrations > AI Advisor before using AI features.'
      );
    }
  } else {
    providers = getAvailableProviders();
  }
  
  if (providers.length === 0) {
    throw new Error('No LLM providers available. Check circuit breakers and API keys.');
  }
  
  let lastError: Error | null = null;
  let totalRetries = 0;
  
  // Try each provider in priority order
  for (const provider of providers) {
    const providerKey = provider as SupportedAIProvider;
    const config = LLM_CONFIGS[providerKey];
    const runtimeConfig = userProviderConfigs[providerKey];
    const model = runtimeConfig?.model || MODELS_BY_COMPLEXITY[complexity][providerKey];
    
    if (!model) {
      console.warn(`⚠️ No model configured for ${provider} with complexity ${complexity}`);
      continue;
    }
    
    // Try with retries
    for (let attempt = 0; attempt < config.retryAttempts; attempt++) {
      try {
        console.log(`🤖 Trying ${config.name} (attempt ${attempt + 1}/${config.retryAttempts})...`);
        
        let result: { response: string; tokensUsed?: number };
        
        switch (provider) {
          case 'ollama':
            result = await generateWithOllama(prompt, model, options, runtimeConfig || {
              apiKey: process.env.OLLAMA_API_KEY || '',
              baseUrl: process.env.OLLAMA_HOST,
            });
            break;
          case 'openai':
            result = await generateWithOpenAI(prompt, model, options, runtimeConfig || {
              apiKey: process.env.OPENAI_API_KEY || '',
              baseUrl: process.env.OPENAI_BASE_URL,
            });
            break;
          case 'anthropic':
            result = await generateWithAnthropic(prompt, model, options, runtimeConfig || {
              apiKey: process.env.ANTHROPIC_API_KEY || '',
              baseUrl: process.env.ANTHROPIC_BASE_URL,
            });
            break;
          default:
            throw new Error(`Unknown provider: ${provider}`);
        }
        
        // Success! Record it and return
        recordSuccess(provider);
        
        const latency = Date.now() - startTime;
        const cost = result.tokensUsed 
          ? (result.tokensUsed / 1000) * config.costPer1KTokens 
          : undefined;
        
        console.log(`✅ Successfully generated with ${config.name} in ${latency}ms`);

        if (options.userId && (provider === 'ollama' || provider === 'openai' || provider === 'anthropic')) {
          await markProviderUsed(options.userId, provider);
        }
        
        return {
          response: result.response,
          provider: config.name,
          model,
          latency,
          tokensUsed: result.tokensUsed,
          cost,
          fromCache: false,
          retries: totalRetries,
        };
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        totalRetries++;
        
        console.warn(`❌ ${config.name} attempt ${attempt + 1} failed: ${lastError.message}`);
        
        // Record failure for circuit breaker
        recordFailure(provider, lastError);
        
        // Wait before retry (exponential backoff)
        if (attempt < config.retryAttempts - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If we've exhausted retries for this provider, try next
    console.log(`🔄 Falling back from ${config.name} to next provider...`);
  }
  
  // All providers failed
  throw new Error(`All LLM providers failed. Last error: ${lastError?.message || 'Unknown'}`);
}

/**
 * Quick generation for simple tasks (uses fastest/cheapest model)
 */
export async function generateQuick(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const result = await generate(prompt, {
    complexity: TaskComplexity.SIMPLE,
    systemPrompt,
    temperature: 0.3,
  });
  return result.response;
}

/**
 * Generate with structured output (JSON)
 */
export async function generateJSON<T>(
  prompt: string,
  schema: string,
  options: GenerateOptions = {}
): Promise<T> {
  const systemPrompt = `${options.systemPrompt || ''}\n\nYou must respond with valid JSON that matches this schema:\n${schema}\n\nRespond ONLY with JSON, no markdown, no explanations.`;
  
  const result = await generate(prompt, {
    ...options,
    systemPrompt,
    temperature: 0.2, // Low temperature for consistency
  });
  
  try {
    // Extract JSON from response (in case there's any markdown or extra text)
    const jsonMatch = result.response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    return JSON.parse(jsonMatch[0]) as T;
  } catch (error) {
    console.error('Failed to parse JSON from LLM response:', result.response);
    throw new Error(`JSON parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get status of all LLM providers
 */
export function getProviderStatus(): ProviderStatus[] {
  return Object.entries(LLM_CONFIGS).map(([provider, config]) => {
    const cb = circuitBreakers[provider];
    return {
      provider,
      name: config.name,
      enabled: config.enabled,
      healthy: !isCircuitBreakerOpen(provider) && config.enabled,
      lastError: cb.open ? `Circuit breaker open (${cb.failures} failures)` : undefined,
      averageLatency: 0, // TODO: Track actual latencies
      successRate: 0, // TODO: Calculate from metrics
    };
  });
}

/**
 * Reset circuit breaker for a provider
 */
export function resetCircuitBreaker(provider: string): void {
  if (circuitBreakers[provider]) {
    circuitBreakers[provider].open = false;
    circuitBreakers[provider].failures = 0;
    console.log(`🔓 Manually reset circuit breaker for ${provider}`);
  }
}

/**
 * Estimate cost for a request
 */
export function estimateCost(
  prompt: string,
  complexity: TaskComplexity = TaskComplexity.MODERATE
): Record<string, number> {
  const estimatedTokens = Math.ceil(prompt.length / 4); // Rough estimate: 4 chars ≈ 1 token
  const costs: Record<string, number> = {};
  
  for (const [provider, config] of Object.entries(LLM_CONFIGS)) {
    if (config.enabled) {
      costs[provider] = (estimatedTokens / 1000) * config.costPer1KTokens;
    }
  }
  
  return costs;
}

// Export types and utilities
export { TaskComplexity, LLM_CONFIGS };
export type { GenerateOptions, GenerateResult, ProviderStatus };

// Default export
export default {
  generate,
  generateQuick,
  generateJSON,
  getProviderStatus,
  resetCircuitBreaker,
  estimateCost,
  TaskComplexity,
};
