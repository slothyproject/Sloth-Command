/**
 * Job Queue Service
 * Async processing using Bull and Redis
 * Handles auto-fixes, AI analysis, and background tasks
 *
 * NOTE: Bull requires its own Redis connections without enableReadyCheck or
 * maxRetriesPerRequest — we pass the URL string directly, not the shared client.
 * See: https://github.com/OptimalBits/bull/issues/1873
 */

import Queue from 'bull';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Bull-compatible Redis options (must NOT have enableReadyCheck or maxRetriesPerRequest)
const bullRedisOpts = {
  url: REDIS_URL,
  enableReadyCheck: false,
  maxRetriesPerRequest: null as any,
};

// Queue names
const QUEUES = {
  AUTO_FIX: 'auto-fix',
  AI_ANALYSIS: 'ai-analysis',
  METRICS_SYNC: 'metrics-sync',
  NOTIFICATIONS: 'notifications',
  REPORTS: 'reports',
};

// Queue instances
const queues: Record<string, Queue.Queue> = {};

/**
 * Initialize all job queues
 */
export function initializeQueues(): void {
  const defaultJobOptions: Queue.JobOptions = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 10,
    removeOnFail: 5,
  };

  const names = Object.values(QUEUES);
  for (const name of names) {
    try {
      queues[name] = new Queue(name, REDIS_URL, {
        redis: { enableReadyCheck: false, maxRetriesPerRequest: null as any },
        defaultJobOptions,
      });

      queues[name].on('completed', (job, result) => {
        console.log(`✅ Job completed: ${name}#${job.id}`);
      });
      queues[name].on('failed', (job, err) => {
        console.error(`❌ Job failed: ${name}#${job.id}`, err.message);
      });
    } catch (err) {
      console.error(`⚠️  Could not create queue ${name}:`, err);
    }
  }

  console.log('✅ Job queues initialized:', names.join(', '));
}

/**
 * Get a queue instance
 */
export function getQueue(name: string): Queue.Queue {
  if (!queues[name]) {
    throw new Error(`Queue ${name} not initialized`);
  }
  return queues[name];
}

/**
 * Add job to auto-fix queue
 */
export async function queueAutoFix(insightId: string): Promise<Queue.Job | null> {
  try {
    return getQueue(QUEUES.AUTO_FIX).add({ insightId }, { priority: 1, jobId: `autofix-${insightId}` });
  } catch {
    return null;
  }
}

/**
 * Add job to AI analysis queue
 */
export async function queueAIAnalysis(serviceId: string): Promise<Queue.Job | null> {
  try {
    return getQueue(QUEUES.AI_ANALYSIS).add({ serviceId }, { jobId: `analysis-${serviceId}` });
  } catch {
    return null;
  }
}

/**
 * Add job to metrics sync queue
 */
export async function queueMetricsSync(serviceId: string): Promise<Queue.Job | null> {
  try {
    return getQueue(QUEUES.METRICS_SYNC).add({ serviceId }, { jobId: `metrics-${serviceId}` });
  } catch {
    return null;
  }
}

/**
 * Close all queues gracefully
 */
export async function closeQueues(): Promise<void> {
  const results = await Promise.allSettled(
    Object.values(queues).map(q => q.close().catch(() => {}))
  );
  console.log('👋 All queues closed');
}

export default queues;
