/**
 * Job Queue Service
 * Async processing using Bull and Redis
 * Handles auto-fixes, AI analysis, and background tasks
 */

import Queue from 'bull';
import { getRedis } from './redis';

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
  const redisClient = getRedis();
  
  // Auto-fix queue
  queues[QUEUES.AUTO_FIX] = new Queue(QUEUES.AUTO_FIX, {
    redis: redisClient.options,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 10,
      removeOnFail: 5,
    },
  });

  // AI Analysis queue
  queues[QUEUES.AI_ANALYSIS] = new Queue(QUEUES.AI_ANALYSIS, {
    redis: redisClient.options,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 5000,
      },
      removeOnComplete: 20,
      removeOnFail: 10,
    },
  });

  // Metrics sync queue
  queues[QUEUES.METRICS_SYNC] = new Queue(QUEUES.METRICS_SYNC, {
    redis: redisClient.options,
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: 5,
      removeOnFail: 5,
    },
  });

  // Notifications queue
  queues[QUEUES.NOTIFICATIONS] = new Queue(QUEUES.NOTIFICATIONS, {
    redis: redisClient.options,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  });

  // Reports queue
  queues[QUEUES.REPORTS] = new Queue(QUEUES.REPORTS, {
    redis: redisClient.options,
    defaultJobOptions: {
      attempts: 2,
      removeOnComplete: 5,
    },
  });

  // Setup event handlers for all queues
  Object.entries(queues).forEach(([name, queue]) => {
    queue.on('completed', (job, result) => {
      console.log(`✅ Job completed: ${name}#${job.id}`, result);
    });

    queue.on('failed', (job, err) => {
      console.error(`❌ Job failed: ${name}#${job.id}`, err.message);
    });

    queue.on('stalled', (job) => {
      console.warn(`⚠️ Job stalled: ${name}#${job.id}`);
    });
  });

  console.log('✅ Job queues initialized:', Object.keys(queues).join(', '));
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
export async function queueAutoFix(insightId: string): Promise<Queue.Job> {
  const queue = getQueue(QUEUES.AUTO_FIX);
  return queue.add({ insightId }, {
    priority: 1, // High priority
    jobId: `autofix-${insightId}`, // Prevent duplicates
  });
}

/**
 * Add job to AI analysis queue
 */
export async function queueAIAnalysis(serviceId: string): Promise<Queue.Job> {
  const queue = getQueue(QUEUES.AI_ANALYSIS);
  return queue.add({ serviceId }, {
    priority: 2,
    delay: 1000, // Slight delay to batch requests
  });
}

/**
 * Add job to metrics sync queue
 */
export async function queueMetricsSync(serviceId: string): Promise<Queue.Job> {
  const queue = getQueue(QUEUES.METRICS_SYNC);
  return queue.add({ serviceId }, {
    priority: 3,
  });
}

/**
 * Add notification job
 */
export async function queueNotification(
  type: string,
  recipient: string,
  data: any
): Promise<Queue.Job> {
  const queue = getQueue(QUEUES.NOTIFICATIONS);
  return queue.add({ type, recipient, data }, {
    priority: 2,
  });
}

/**
 * Add report generation job
 */
export async function queueReport(
  reportType: string,
  params: any
): Promise<Queue.Job> {
  const queue = getQueue(QUEUES.REPORTS);
  return queue.add({ reportType, params }, {
    priority: 4, // Lower priority
  });
}

/**
 * Get job status
 */
export async function getJobStatus(
  queueName: string,
  jobId: string
): Promise<{ state: string; progress: number; result?: any; error?: string } | null> {
  try {
    const queue = getQueue(queueName);
    const job = await queue.getJob(jobId);
    
    if (!job) return null;
    
    const state = await job.getState();
    const progress = job.progress() as number;
    
    return {
      state,
      progress,
      result: job.returnvalue,
      error: job.failedReason,
    };
  } catch (error) {
    console.error(`❌ Failed to get job status:`, error);
    return null;
  }
}

/**
 * Process jobs in a queue
 */
export function processQueue(
  name: string,
  processor: (job: Queue.Job) => Promise<any>,
  concurrency: number = 1
): void {
  const queue = getQueue(name);
  queue.process(concurrency, processor);
}

/**
 * Clean completed/failed jobs
 */
export async function cleanQueues(): Promise<void> {
  for (const [name, queue] of Object.entries(queues)) {
    await queue.clean(0, 'completed');
    await queue.clean(0, 'failed');
    console.log(`🧹 Cleaned queue: ${name}`);
  }
}

/**
 * Graceful shutdown
 */
export async function closeQueues(): Promise<void> {
  for (const [name, queue] of Object.entries(queues)) {
    await queue.close();
    console.log(`👋 Queue closed: ${name}`);
  }
}

// Export
export { QUEUES };
export default {
  initializeQueues,
  getQueue,
  queueAutoFix,
  queueAIAnalysis,
  queueMetricsSync,
  queueNotification,
  queueReport,
  getJobStatus,
  processQueue,
  cleanQueues,
  closeQueues,
  QUEUES,
};
