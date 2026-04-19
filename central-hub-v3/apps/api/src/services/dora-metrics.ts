/**
 * DORA Metrics Service
 * Tracks DevOps performance metrics
 * Deployment Frequency, Lead Time, Change Failure Rate, MTTR
 */

import { PrismaClient, Deployment, Service } from '@prisma/client';

const prisma = new PrismaClient();

// DORA metric types
interface DORAMetrics {
  // Deployment Frequency
  deploymentFrequency: {
    daily: number;
    weekly: number;
    monthly: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  
  // Lead Time for Changes
  leadTime: {
    average: number; // in hours
    median: number;
    percentile90: number;
    trend: 'improving' | 'worsening' | 'stable';
  };
  
  // Change Failure Rate
  changeFailureRate: {
    percentage: number;
    failed: number;
    total: number;
    trend: 'improving' | 'worsening' | 'stable';
  };
  
  // Time to Recovery (MTTR)
  mttr: {
    average: number; // in minutes
    median: number;
    percentile90: number;
    trend: 'improving' | 'worsening' | 'stable';
  };
  
  // Time range
  period: {
    start: Date;
    end: Date;
    days: number;
  };
}

/**
 * Calculate deployment frequency
 */
async function calculateDeploymentFrequency(
  serviceId: string,
  days: number = 30
): Promise<DORAMetrics['deploymentFrequency']> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const deployments = await prisma.deployment.findMany({
    where: {
      serviceId,
      status: 'success',
      createdAt: { gte: startDate },
    },
    orderBy: { createdAt: 'asc' },
  });
  
  if (deployments.length === 0) {
    return {
      daily: 0,
      weekly: 0,
      monthly: 0,
      trend: 'stable',
    };
  }
  
  // Calculate frequencies
  const daily = deployments.length / days;
  const weekly = daily * 7;
  const monthly = daily * 30;
  
  // Calculate trend (compare first half to second half)
  const halfPoint = Math.floor(deployments.length / 2);
  const firstHalf = deployments.slice(0, halfPoint).length;
  const secondHalf = deployments.slice(halfPoint).length;
  
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (secondHalf > firstHalf * 1.2) trend = 'increasing';
  else if (secondHalf < firstHalf * 0.8) trend = 'decreasing';
  
  return { daily, weekly, monthly, trend };
}

/**
 * Calculate lead time for changes
 * Simplified: time from previous deployment to this deployment
 * In real implementation, would integrate with GitHub/GitLab for commit time
 */
async function calculateLeadTime(
  serviceId: string,
  days: number = 30
): Promise<DORAMetrics['leadTime']> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const deployments = await prisma.deployment.findMany({
    where: {
      serviceId,
      status: 'success',
      createdAt: { gte: startDate },
    },
    orderBy: { createdAt: 'asc' },
  });
  
  if (deployments.length < 2) {
    return {
      average: 0,
      median: 0,
      percentile90: 0,
      trend: 'stable',
    };
  }
  
  // Calculate time between deployments (as proxy for lead time)
  const leadTimes: number[] = [];
  for (let i = 1; i < deployments.length; i++) {
    const diff = deployments[i].createdAt.getTime() - deployments[i-1].createdAt.getTime();
    leadTimes.push(diff / (1000 * 60 * 60)); // Convert to hours
  }
  
  // Calculate statistics
  const sorted = leadTimes.sort((a, b) => a - b);
  const average = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const percentile90 = sorted[Math.floor(sorted.length * 0.9)];
  
  // Trend: compare first half to second half
  const halfPoint = Math.floor(sorted.length / 2);
  const firstHalfAvg = sorted.slice(0, halfPoint).reduce((a, b) => a + b, 0) / halfPoint;
  const secondHalfAvg = sorted.slice(halfPoint).reduce((a, b) => a + b, 0) / (sorted.length - halfPoint);
  
  let trend: 'improving' | 'worsening' | 'stable' = 'stable';
  if (secondHalfAvg < firstHalfAvg * 0.8) trend = 'improving'; // Lower lead time is better
  else if (secondHalfAvg > firstHalfAvg * 1.2) trend = 'worsening';
  
  return { average, median, percentile90, trend };
}

/**
 * Calculate change failure rate
 */
async function calculateChangeFailureRate(
  serviceId: string,
  days: number = 30
): Promise<DORAMetrics['changeFailureRate']> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const total = await prisma.deployment.count({
    where: {
      serviceId,
      createdAt: { gte: startDate },
    },
  });
  
  const failed = await prisma.deployment.count({
    where: {
      serviceId,
      status: 'failed',
      createdAt: { gte: startDate },
    },
  });
  
  const percentage = total > 0 ? (failed / total) * 100 : 0;
  
  // Calculate trend
  const halfDays = Math.floor(days / 2);
  const firstHalfStart = startDate;
  const firstHalfEnd = new Date(startDate);
  firstHalfEnd.setDate(firstHalfEnd.getDate() + halfDays);
  
  const secondHalfStart = firstHalfEnd;
  
  const firstHalfTotal = await prisma.deployment.count({
    where: {
      serviceId,
      createdAt: { gte: firstHalfStart, lt: firstHalfEnd },
    },
  });
  
  const firstHalfFailed = await prisma.deployment.count({
    where: {
      serviceId,
      status: 'failed',
      createdAt: { gte: firstHalfStart, lt: firstHalfEnd },
    },
  });
  
  const secondHalfTotal = await prisma.deployment.count({
    where: {
      serviceId,
      createdAt: { gte: secondHalfStart },
    },
  });
  
  const secondHalfFailed = await prisma.deployment.count({
    where: {
      serviceId,
      status: 'failed',
      createdAt: { gte: secondHalfStart },
    },
  });
  
  const firstHalfRate = firstHalfTotal > 0 ? (firstHalfFailed / firstHalfTotal) * 100 : 0;
  const secondHalfRate = secondHalfTotal > 0 ? (secondHalfFailed / secondHalfTotal) * 100 : 0;
  
  let trend: 'improving' | 'worsening' | 'stable' = 'stable';
  if (secondHalfRate < firstHalfRate * 0.8) trend = 'improving';
  else if (secondHalfRate > firstHalfRate * 1.2) trend = 'worsening';
  
  return { percentage, failed, total, trend };
}

/**
 * Calculate MTTR (Mean Time To Recovery)
 */
async function calculateMTTR(
  serviceId: string,
  days: number = 30
): Promise<DORAMetrics['mttr']> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Find failed deployments that were followed by successful deployments
  const failedDeployments = await prisma.deployment.findMany({
    where: {
      serviceId,
      status: 'failed',
      createdAt: { gte: startDate },
    },
    orderBy: { createdAt: 'asc' },
  });
  
  const recoveryTimes: number[] = [];
  
  for (const failed of failedDeployments) {
    // Find next successful deployment
    const recovery = await prisma.deployment.findFirst({
      where: {
        serviceId,
        status: 'success',
        createdAt: { gt: failed.createdAt },
      },
      orderBy: { createdAt: 'asc' },
    });
    
    if (recovery) {
      const diff = recovery.createdAt.getTime() - failed.createdAt.getTime();
      recoveryTimes.push(diff / (1000 * 60)); // Convert to minutes
    }
  }
  
  if (recoveryTimes.length === 0) {
    return {
      average: 0,
      median: 0,
      percentile90: 0,
      trend: 'stable',
    };
  }
  
  const sorted = recoveryTimes.sort((a, b) => a - b);
  const average = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const percentile90 = sorted[Math.floor(sorted.length * 0.9)];
  
  // Trend
  const halfPoint = Math.floor(sorted.length / 2);
  const firstHalfAvg = sorted.slice(0, halfPoint).reduce((a, b) => a + b, 0) / halfPoint || 0;
  const secondHalfAvg = sorted.slice(halfPoint).reduce((a, b) => a + b, 0) / (sorted.length - halfPoint) || 0;
  
  let trend: 'improving' | 'worsening' | 'stable' = 'stable';
  if (secondHalfAvg < firstHalfAvg * 0.8) trend = 'improving'; // Lower MTTR is better
  else if (secondHalfAvg > firstHalfAvg * 1.2) trend = 'worsening';
  
  return { average, median, percentile90, trend };
}

/**
 * Get all DORA metrics for a service
 */
export async function getDORAMetrics(
  serviceId: string,
  days: number = 30
): Promise<DORAMetrics> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const [
    deploymentFrequency,
    leadTime,
    changeFailureRate,
    mttr,
  ] = await Promise.all([
    calculateDeploymentFrequency(serviceId, days),
    calculateLeadTime(serviceId, days),
    calculateChangeFailureRate(serviceId, days),
    calculateMTTR(serviceId, days),
  ]);
  
  return {
    deploymentFrequency,
    leadTime,
    changeFailureRate,
    mttr,
    period: {
      start: startDate,
      end: endDate,
      days,
    },
  };
}

/**
 * Get DORA metrics for all services
 */
export async function getAllDORAMetrics(
  days: number = 30
): Promise<Array<{ serviceId: string; serviceName: string; metrics: DORAMetrics }>> {
  const services = await prisma.service.findMany();
  
  const results = await Promise.all(
    services.map(async (service) => ({
      serviceId: service.id,
      serviceName: service.name,
      metrics: await getDORAMetrics(service.id, days),
    }))
  );
  
  return results;
}

/**
 * Get DORA performance level
 * Elite: DF = on-demand (multiple per day), LT < 1 hour, CFR < 5%, MTTR < 1 hour
 * High: DF = daily, LT < 1 week, CFR < 15%, MTTR < 1 day
 * Medium: DF = weekly, LT < 1 month, CFR < 30%, MTTR < 1 week
 * Low: Everything else
 */
export function getPerformanceLevel(metrics: DORAMetrics): 'elite' | 'high' | 'medium' | 'low' {
  const { deploymentFrequency, leadTime, changeFailureRate, mttr } = metrics;
  
  // Elite criteria
  if (
    deploymentFrequency.daily > 1 && // Multiple per day
    leadTime.average < 1 && // Less than 1 hour
    changeFailureRate.percentage < 5 && // Less than 5%
    mttr.average < 60 // Less than 1 hour
  ) {
    return 'elite';
  }
  
  // High criteria
  if (
    deploymentFrequency.daily >= 1 && // Daily
    leadTime.average < 168 && // Less than 1 week (168 hours)
    changeFailureRate.percentage < 15 && // Less than 15%
    mttr.average < 1440 // Less than 1 day (1440 minutes)
  ) {
    return 'high';
  }
  
  // Medium criteria
  if (
    deploymentFrequency.weekly >= 1 && // Weekly
    leadTime.average < 720 && // Less than 1 month (720 hours)
    changeFailureRate.percentage < 30 && // Less than 30%
    mttr.average < 10080 // Less than 1 week (10080 minutes)
  ) {
    return 'medium';
  }
  
  return 'low';
}

/**
 * Record deployment for metrics tracking
 */
export async function recordDeployment(
  serviceId: string,
  status: 'success' | 'failed',
  metadata: Record<string, any> = {}
): Promise<void> {
  await prisma.deployment.create({
    data: {
      serviceId,
      status,
      deployedBy: 'user',
      logs: JSON.stringify(metadata),
    },
  });
}

/**
 * Get deployment trend (for charting)
 */
export async function getDeploymentTrend(
  serviceId: string,
  days: number = 30
): Promise<Array<{ date: string; successful: number; failed: number }>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const deployments = await prisma.deployment.findMany({
    where: {
      serviceId,
      createdAt: { gte: startDate },
    },
    orderBy: { createdAt: 'asc' },
  });
  
  // Group by date
  const byDate = new Map<string, { successful: number; failed: number }>();
  
  for (const deployment of deployments) {
    const date = deployment.createdAt.toISOString().split('T')[0];
    const current = byDate.get(date) || { successful: 0, failed: 0 };
    
    if (deployment.status === 'success') {
      current.successful++;
    } else {
      current.failed++;
    }
    
    byDate.set(date, current);
  }
  
  // Convert to array
  return Array.from(byDate.entries()).map(([date, counts]) => ({
    date,
    successful: counts.successful,
    failed: counts.failed,
  }));
}

// Export
export {
  DORAMetrics,
  getDORAMetrics,
  getAllDORAMetrics,
  getPerformanceLevel,
  recordDeployment,
  getDeploymentTrend,
};

export default {
  getDORAMetrics,
  getAllDORAMetrics,
  getPerformanceLevel,
  recordDeployment,
  getDeploymentTrend,
};
