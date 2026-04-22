/**
 * Monitoring Scheduler
 * Runs periodic health checks and AI analysis
 * Orchestrates service monitoring, metrics collection, and AI insights
 */

import { PrismaClient } from '@prisma/client';
import { railwayService } from '../services/railway';
import aiService from '../services/ai';
import autoFixAgent, { processFixJob } from '../agents/auto-fix';
import { processQueue, QUEUES } from '../services/queue';

const prisma = new PrismaClient();

// Scheduler configuration
const SCHEDULE = {
  HEALTH_CHECK: 5 * 60 * 1000,      // 5 minutes
  METRICS_COLLECTION: 5 * 60 * 1000, // 5 minutes
  AI_ANALYSIS: 15 * 60 * 1000,       // 15 minutes
  PREDICTION: 60 * 60 * 1000,        // 1 hour
  AUTO_FIX: 5 * 60 * 1000,           // 5 minutes
  SYNC: 30 * 60 * 1000,              // 30 minutes
};

// Running intervals
const intervals: NodeJS.Timeout[] = [];

/**
 * Start the monitoring scheduler
 */
export function startScheduler(): void {
  console.log('⏰ Starting monitoring scheduler...');

  // Register job processors for async queues
  try {
    processQueue(QUEUES.AUTO_FIX, processFixJob, 2); // Process 2 auto-fix jobs concurrently
    console.log('✅ Registered auto-fix job processor');
  } catch (error) {
    console.error('❌ Failed to register auto-fix job processor:', error);
  }

  // Health check - every 5 minutes
  intervals.push(setInterval(runHealthChecks, SCHEDULE.HEALTH_CHECK));

  // Metrics collection - every 5 minutes
  intervals.push(setInterval(collectMetrics, SCHEDULE.METRICS_COLLECTION));

  // AI analysis - every 15 minutes
  intervals.push(setInterval(runAIAnalysis, SCHEDULE.AI_ANALYSIS));

  // Predictive analysis - every hour
  intervals.push(setInterval(runPredictions, SCHEDULE.PREDICTION));

  // Auto-fix processor - every 5 minutes (now just queues jobs, doesn't execute)
  intervals.push(setInterval(runAutoFixes, SCHEDULE.AUTO_FIX));

  // Railway sync - every 30 minutes
  intervals.push(setInterval(syncWithRailway, SCHEDULE.SYNC));

  // Run initial checks immediately
  console.log('🚀 Running initial checks...');
  setTimeout(() => {
    runHealthChecks();
    collectMetrics();
    syncWithRailway();
  }, 5000); // Wait 5 seconds for server to be ready

  console.log('✅ Monitoring scheduler started');
  console.log('   Health checks: every 5 minutes');
  console.log('   Metrics: every 5 minutes');
  console.log('   AI analysis: every 15 minutes');
  console.log('   Predictions: every hour');
  console.log('   Auto-fix: every 5 minutes');
  console.log('   Railway sync: every 30 minutes');
}

/**
 * Stop the monitoring scheduler
 */
export function stopScheduler(): void {
  console.log('🛑 Stopping monitoring scheduler...');
  intervals.forEach(clearInterval);
  intervals.length = 0;
  console.log('✅ Monitoring scheduler stopped');
}

/**
 * Run health checks on all services
 */
async function runHealthChecks(): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🔍 Running health checks...`);

  try {
    const services = await prisma.service.findMany();

    for (const service of services) {
      try {
        let status = service.status;

        if (service.platform === 'railway' && service.externalId) {
          // Check Railway service health
          try {
            const metrics = await railwayService.getServiceMetrics(service.id);
            
            // Determine health based on metrics
            if (metrics.cpu > 90 || metrics.memory > 95) {
              status = 'degraded';
            } else if (metrics.cpu < 80 && metrics.memory < 90) {
              status = 'healthy';
            }

            // Update service with latest metrics
            await prisma.service.update({
              where: { id: service.id },
              data: {
                status,
                cpuUsage: metrics.cpu,
                memoryUsage: metrics.memory,
              },
            });

            // Create metric records
            await prisma.metric.createMany({
              data: [
                {
                  serviceId: service.id,
                  metricType: 'cpu',
                  value: metrics.cpu,
                  unit: 'percent',
                  timestamp: new Date(),
                },
                {
                  serviceId: service.id,
                  metricType: 'memory',
                  value: metrics.memory,
                  unit: 'mb',
                  timestamp: new Date(),
                },
              ],
            });

          } catch (error) {
            console.error(`Failed to check health for ${service.name}:`, error);
            status = 'unknown';
          }
        }

        // If status changed, log it
        if (status !== service.status) {
          console.log(`   ${service.name}: ${service.status} → ${status}`);
        }

      } catch (error) {
        console.error(`Health check failed for ${service.name}:`, error);
      }
    }

    console.log(`[${timestamp}] ✅ Health checks complete`);
  } catch (error) {
    console.error('Health checks failed:', error);
  }
}

/**
 * Collect metrics from all services
 */
async function collectMetrics(): Promise<void> {
  try {
    const services = await prisma.service.findMany({
      where: {
        platform: 'railway',
        externalId: { not: null },
      },
    });

    for (const service of services) {
      try {
        const metrics = await railwayService.getServiceMetrics(service.id);

        // Store metrics
        await prisma.metric.createMany({
          data: [
            {
              serviceId: service.id,
              metricType: 'cpu',
              value: metrics.cpu,
              unit: 'percent',
              timestamp: new Date(),
            },
            {
              serviceId: service.id,
              metricType: 'memory',
              value: metrics.memory,
              unit: 'mb',
              timestamp: new Date(),
            },
            {
              serviceId: service.id,
              metricType: 'disk',
              value: metrics.disk,
              unit: 'mb',
              timestamp: new Date(),
            },
          ],
        });

        // Clean up old metrics (keep last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        await prisma.metric.deleteMany({
          where: {
            serviceId: service.id,
            timestamp: { lt: sevenDaysAgo },
          },
        });

      } catch (error) {
        // Silently fail for individual services
      }
    }
  } catch (error) {
    console.error('Metrics collection failed:', error);
  }
}

/**
 * Run AI analysis on services
 */
async function runAIAnalysis(): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🤖 Running AI analysis...`);

  try {
    // Get services that haven't been analyzed recently
    const services = await prisma.service.findMany({
      where: {
        aiEnabled: true,
        OR: [
          { lastAnalyzed: null },
          { lastAnalyzed: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        ],
      },
      take: 5, // Analyze max 5 services per run
    });

    for (const service of services) {
      try {
        console.log(`   Analyzing ${service.name}...`);
        const analysis = await aiService.analyzeService(service.id);
        
        if (analysis.insights.length > 0) {
          console.log(`   ✅ Found ${analysis.insights.length} insights`);
          
          // Log critical issues immediately
          const critical = analysis.insights.filter(i => i.severity === 'critical');
          if (critical.length > 0) {
            console.error(`   🚨 ${critical.length} CRITICAL issues found!`);
          }
        }

        // Small delay between analyses
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`   ❌ AI analysis failed for ${service.name}:`, error);
      }
    }

    console.log(`[${timestamp}] ✅ AI analysis complete`);
  } catch (error) {
    console.error('AI analysis failed:', error);
  }
}

/**
 * Run predictive analysis
 */
async function runPredictions(): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🔮 Running predictive analysis...`);

  try {
    const services = await prisma.service.findMany({
      where: { aiEnabled: true },
      take: 3,
    });

    for (const service of services) {
      try {
        const prediction = await aiService.predictIssues(service.id);
        
        if (prediction.insights.length > 0) {
          console.log(`   ${service.name}: ${prediction.insights.length} predictions`);
        }

        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.error(`Prediction failed for ${service.name}:`, error);
      }
    }

    console.log(`[${timestamp}] ✅ Predictive analysis complete`);
  } catch (error) {
    console.error('Predictive analysis failed:', error);
  }
}

/**
 * Run auto-fix processor
 */
async function runAutoFixes(): Promise<void> {
  try {
    const stats = await autoFixAgent.processAutoFixes();
    
    console.log(`📋 Auto-fix queue stats: ${stats.queued} queued, ${stats.alreadyQueued} already queued, ${stats.errors} errors`);
  } catch (error) {
    console.error('Auto-fix queue processing failed:', error);
  }
}

/**
 * Sync with Railway
 */
async function syncWithRailway(): Promise<void> {
  try {
    console.log('🔄 Syncing with Railway...');
    await railwayService.syncServices();
    console.log('✅ Railway sync complete');
  } catch (error) {
    console.error('Railway sync failed:', error);
  }
}

/**
 * Manual trigger functions for testing
 */
export async function manualHealthCheck(): Promise<void> {
  console.log('🔧 Manual health check triggered');
  await runHealthChecks();
}

export async function manualAIAnalysis(serviceId?: string): Promise<void> {
  console.log('🔧 Manual AI analysis triggered');
  
  if (serviceId) {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });
    
    if (service) {
      console.log(`Analyzing ${service.name}...`);
      await aiService.analyzeService(serviceId);
    }
  } else {
    await runAIAnalysis();
  }
}

export async function manualSync(): Promise<void> {
  console.log('🔧 Manual Railway sync triggered');
  await syncWithRailway();
}

// Export scheduler functions
export const monitoringScheduler = {
  startScheduler,
  stopScheduler,
  manualHealthCheck,
  manualAIAnalysis,
  manualSync,
};

export default monitoringScheduler;
