/**
 * Circuit Breaker Utility
 * Prevents cascade failures when external services are down
 * Implements the circuit breaker pattern for resilient API calls
 */

import CircuitBreaker from 'opossum';

// Circuit breaker states
enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, rejecting requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

interface CircuitBreakerOptions {
  timeout?: number;           // Time before considering a failure (ms)
  errorThresholdPercentage?: number; // Error % to open circuit
  resetTimeout?: number;      // Time before attempting reset (ms)
  rollingCountTimeout?: number; // Window for error calculation (ms)
  rollingCountBuckets?: number;   // Number of buckets in window
  name?: string;              // Circuit breaker name
}

// Store all circuit breakers
const breakers: Map<string, CircuitBreaker> = new Map();

/**
 * Create or get a circuit breaker for a function
 */
export function createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: CircuitBreakerOptions = {}
): CircuitBreaker {
  const name = options.name || fn.name || 'unnamed';
  
  // Return existing if already created
  if (breakers.has(name)) {
    return breakers.get(name)!;
  }
  
  const breaker = new CircuitBreaker(fn, {
    timeout: options.timeout || 10000,           // 10s timeout
    errorThresholdPercentage: options.errorThresholdPercentage || 50, // 50% errors
    resetTimeout: options.resetTimeout || 30000,   // 30s before retry
    rollingCountTimeout: options.rollingCountTimeout || 10000,
    rollingCountBuckets: options.rollingCountBuckets || 10,
    name,
  });
  
  // Event handlers
  breaker.on('open', () => {
    console.error(`🔒 Circuit breaker OPEN for ${name}`);
  });
  
  breaker.on('halfOpen', () => {
    console.warn(`🔓 Circuit breaker HALF-OPEN for ${name} (testing recovery)`);
  });
  
  breaker.on('close', () => {
    console.log(`✅ Circuit breaker CLOSED for ${name} (healthy)`);
  });
  
  breaker.on('fallback', (result) => {
    console.log(`🛡️ Circuit breaker fallback executed for ${name}:`, result);
  });
  
  breaker.on('reject', () => {
    console.warn(`⛔ Request rejected by circuit breaker ${name}`);
  });
  
  breaker.on('timeout', () => {
    console.error(`⏱️ Request timed out for ${name}`);
  });
  
  breakers.set(name, breaker);
  return breaker;
}

/**
 * Execute a function with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  options: CircuitBreakerOptions & { fallback?: T } = {}
): Promise<T> {
  const breaker = createCircuitBreaker(fn, options);
  
  // Set fallback if provided
  if (options.fallback !== undefined) {
    breaker.fallback(() => options.fallback);
  }
  
  try {
    return await breaker.fire();
  } catch (error) {
    throw error;
  }
}

/**
 * Get status of all circuit breakers
 */
export function getCircuitBreakerStatus(): Array<{
  name: string;
  state: string;
  stats: any;
  openedAt?: Date;
}> {
  return Array.from(breakers.entries()).map(([name, breaker]) => ({
    name,
    state: breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
    stats: breaker.stats,
    openedAt: breaker.lastTimeOpenCalculated ? new Date(breaker.lastTimeOpenCalculated) : undefined,
  }));
}

/**
 * Reset a specific circuit breaker
 */
export function resetCircuitBreaker(name: string): boolean {
  const breaker = breakers.get(name);
  if (breaker) {
    breaker.close();
    console.log(`🔧 Manually reset circuit breaker: ${name}`);
    return true;
  }
  return false;
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuitBreakers(): void {
  breakers.forEach((breaker, name) => {
    breaker.close();
    console.log(`🔧 Reset circuit breaker: ${name}`);
  });
}

/**
 * Create circuit breaker wrapper for Railway API calls
 */
export function withRailwayCircuitBreaker<T>(fn: () => Promise<T>): Promise<T> {
  return withCircuitBreaker(fn, {
    name: 'railway-api',
    timeout: 15000,        // 15s timeout for Railway
    resetTimeout: 60000,    // 1min before retry
    fallback: null as any, // Return null on failure
  });
}

/**
 * Create circuit breaker wrapper for Discord API calls
 */
export function withDiscordCircuitBreaker<T>(fn: () => Promise<T>): Promise<T> {
  return withCircuitBreaker(fn, {
    name: 'discord-api',
    timeout: 10000,        // 10s timeout for Discord
    resetTimeout: 30000,    // 30s before retry
    fallback: null as any,
  });
}

/**
 * Create circuit breaker for LLM API calls
 */
export function withLLMCircuitBreaker<T>(fn: () => Promise<T>, provider: string): Promise<T> {
  return withCircuitBreaker(fn, {
    name: `llm-${provider}`,
    timeout: 30000,        // 30s timeout for LLM generation
    resetTimeout: 30000,
    fallback: null as any,
  });
}

/**
 * Health check for circuit breakers
 */
export function checkCircuitBreakerHealth(): {
  healthy: boolean;
  openCircuits: string[];
  closedCircuits: string[];
} {
  const status = getCircuitBreakerStatus();
  const openCircuits = status.filter(s => s.state === 'OPEN').map(s => s.name);
  const closedCircuits = status.filter(s => s.state === 'CLOSED').map(s => s.name);
  
  return {
    healthy: openCircuits.length === 0,
    openCircuits,
    closedCircuits,
  };
}

// Export
export { CircuitState };
export default {
  createCircuitBreaker,
  withCircuitBreaker,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
  resetAllCircuitBreakers,
  withRailwayCircuitBreaker,
  withDiscordCircuitBreaker,
  withLLMCircuitBreaker,
  checkCircuitBreakerHealth,
  CircuitState,
};
