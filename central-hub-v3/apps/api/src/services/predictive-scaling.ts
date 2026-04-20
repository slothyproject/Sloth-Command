/**
 * Predictive Scaling Service
 * ML-based traffic forecasting and pre-emptive scaling
 * Predicts resource needs before they occur
 */

import { PrismaClient } from '@prisma/client';
import { generate, generateJSON, TaskComplexity } from './llm-router';
import { getQueue } from './queue';
import { redis } from './redis';
import knowledgeGraph from './knowledge-graph';

const prisma = new PrismaClient();

// Time series data point
interface MetricDataPoint {
  timestamp: Date;
  value: number;
  metric: string;
  serviceId: string;
  tags: Record<string, string>;
}

// Traffic pattern
interface TrafficPattern {
  serviceId: string;
  pattern: 'steady' | 'cyclical' | 'trending_up' | 'trending_down' | 'spiky' | 'unpredictable';
  seasonality?: {
    hourly?: boolean;
    daily?: boolean;
    weekly?: boolean;
  };
  confidence: number;
  lastUpdated: Date;
}

// Forecast result
interface Forecast {
  serviceId: string;
  metric: string;
  horizon: '15min' | '1hour' | '6hour' | '24hour';
  predictions: Array<{
    timestamp: Date;
    predictedValue: number;
    confidenceInterval: [number, number]; // [lower, upper]
    confidence: number;
  }>;
  trends: {
    direction: 'up' | 'down' | 'stable';
    magnitude: number; // percentage change
    anomalyProbability: number;
  };
  generatedAt: Date;
}

// Scaling recommendation
interface ScalingRecommendation {
  serviceId: string;
  triggeredBy: string;
  currentCapacity: {
    replicas: number;
    cpuPerReplica: number;
    memoryPerReplica: number;
  };
  recommendedCapacity: {
    replicas: number;
    cpuPerReplica: number;
    memoryPerReplica: number;
    scalingAction: 'scale_up' | 'scale_down' | 'maintain';
    reason: string;
  };
  forecast: Forecast;
  costImpact: {
    current: number; // dollars per hour
    predicted: number;
    delta: number;
    deltaPercent: number;
  };
  timing: {
    recommendAt: Date;
    executeBy: Date;
    expiresAt: Date;
  };
  confidence: number;
  risk: 'low' | 'medium' | 'high';
}

// Scaling history
interface ScalingEvent {
  id: string;
  serviceId: string;
  timestamp: Date;
  previousState: Record<string, any>;
  newState: Record<string, any>;
  triggeredBy: string;
  forecastId?: string;
  result: 'success' | 'partial' | 'failed';
  metricsBefore: Record<string, number>;
  metricsAfter: Record<string, number>;
}

// Scaling configuration
interface ScalingConfig {
  serviceId: string;
  enabled: boolean;
  minReplicas: number;
  maxReplicas: number;
  targetCpuUtilization: number;
  targetMemoryUtilization: number;
  scaleUpThreshold: number; // CPU/Mem % to trigger scale up
  scaleDownThreshold: number; // CPU/Mem % to allow scale down
  scaleUpCooldown: number; // seconds
  scaleDownCooldown: number; // seconds;
  predictiveScaling: boolean;
  forecastHorizon: '15min' | '1hour' | '6hour' | '24hour';
  mlConfidenceThreshold: number; // 0-1
  costOptimization: boolean;
  customSchedules: ScalingSchedule[];
}

// Scheduled scaling
interface ScalingSchedule {
  name: string;
  cron: string;
  action: 'scale_up' | 'scale_down' | 'set_replicas';
  params: Record<string, any>;
  enabled: boolean;
}

// Redis keys
const REDIS_KEYS = {
  METRIC_PREFIX: 'scaling:metric:',
  PATTERN_PREFIX: 'scaling:pattern:',
  FORECAST_PREFIX: 'scaling:forecast:',
  RECOMMENDATION_PREFIX: 'scaling:rec:',
  EVENT_PREFIX: 'scaling:event:',
  CONFIG_PREFIX: 'scaling:config:',
  LAST_SCALE_PREFIX: 'scaling:last:',
};

// Default scaling configuration
const DEFAULT_SCALING_CONFIG: ScalingConfig = {
  serviceId: '',
  enabled: true,
  minReplicas: 1,
  maxReplicas: 10,
  targetCpuUtilization: 70,
  targetMemoryUtilization: 80,
  scaleUpThreshold: 75,
  scaleDownThreshold: 30,
  scaleUpCooldown: 60,
  scaleDownCooldown: 300,
  predictiveScaling: true,
  forecastHorizon: '1hour',
  mlConfidenceThreshold: 0.7,
  costOptimization: true,
  customSchedules: [],
};

/**
 * Store metric data point
 */
export async function storeMetric(data: MetricDataPoint): Promise<void> {
  const key = `${REDIS_KEYS.METRIC_PREFIX}${data.serviceId}:${data.metric}`;
  const metricEntry = {
    timestamp: data.timestamp.toISOString(),
    value: data.value,
    tags: data.tags,
  };

  // Store in time-sorted list (using Redis sorted set with timestamp as score)
  await redis.zadd(key, new Date(data.timestamp).getTime(), JSON.stringify(metricEntry));
  
  // Trim to keep only last 7 days of data
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  await redis.zremrangebyscore(key, 0, cutoff);
  
  // Set TTL to auto-expire
  await redis.expire(key, 7 * 24 * 60 * 60);
}

/**
 * Get metric history for a service
 */
export async function getMetricHistory(
  serviceId: string,
  metric: string,
  hours: number = 24
): Promise<MetricDataPoint[]> {
  const key = `${REDIS_KEYS.METRIC_PREFIX}${serviceId}:${metric}`;
  const cutoff = Date.now() - hours * 60 * 60 * 1000;

  const entries = await redis.zrangebyscore(key, cutoff, '+inf');
  
  return entries.map((entry) => {
    const data = JSON.parse(entry);
    return {
      serviceId,
      metric,
      timestamp: new Date(data.timestamp),
      value: data.value,
      tags: data.tags || {},
    };
  });
}

/**
 * Analyze traffic patterns for a service
 */
export async function analyzeTrafficPattern(serviceId: string): Promise<TrafficPattern> {
  const metrics = ['requests_per_second', 'cpu_usage', 'memory_usage'];
  const allData: MetricDataPoint[] = [];

  for (const metric of metrics) {
    const data = await getMetricHistory(serviceId, metric, 168); // 7 days
    allData.push(...data);
  }

  if (allData.length < 24) {
    return {
      serviceId,
      pattern: 'unpredictable',
      confidence: 0,
      lastUpdated: new Date(),
    };
  }

  // Group by hour to analyze hourly patterns
  const hourlyData = new Map<number, number[]>();
  for (const point of allData) {
    const hour = new Date(point.timestamp).getHours();
    const values = hourlyData.get(hour) || [];
    values.push(point.value);
    hourlyData.set(hour, values);
  }

  // Calculate hourly averages
  const hourlyAvgs = new Map<number, number>();
  for (const [hour, values] of hourlyData) {
    hourlyAvgs.set(hour, values.reduce((a, b) => a + b, 0) / values.length);
  }

  // Analyze for cyclical patterns
  let hasHourlyPattern = false;
  const avgValues = Array.from(hourlyAvgs.values());
  const globalAvg = avgValues.reduce((a, b) => a + b, 0) / avgValues.length;
  
  // Check if there's significant variance between hours
  const variance = avgValues.reduce((acc, val) => acc + Math.pow(val - globalAvg, 2), 0) / avgValues.length;
  const stdDev = Math.sqrt(variance);
  hasHourlyPattern = stdDev / globalAvg > 0.2; // Coefficient of variation > 20%

  // Check for trends
  const sortedByTime = allData.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const firstHalf = sortedByTime.slice(0, Math.floor(sortedByTime.length / 2));
  const secondHalf = sortedByTime.slice(Math.floor(sortedByTime.length / 2));
  
  const firstAvg = firstHalf.reduce((acc, p) => acc + p.value, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((acc, p) => acc + p.value, 0) / secondHalf.length;
  
  let trendChange = ((secondAvg - firstAvg) / firstAvg) * 100;

  // Determine pattern
  let pattern: TrafficPattern['pattern'] = 'unpredictable';
  let confidence = 0.5;

  if (hasHourlyPattern && Math.abs(trendChange) < 10) {
    pattern = 'cyclical';
    confidence = 0.8;
  } else if (trendChange > 20) {
    pattern = 'trending_up';
    confidence = 0.75;
  } else if (trendChange < -20) {
    pattern = 'trending_down';
    confidence = 0.75;
  } else if (stdDev / globalAvg > 0.5) {
    pattern = 'spiky';
    confidence = 0.6;
  } else if (Math.abs(trendChange) < 5) {
    pattern = 'steady';
    confidence = 0.9;
  }

  const trafficPattern: TrafficPattern = {
    serviceId,
    pattern,
    seasonality: {
      hourly: hasHourlyPattern,
      daily: true,
      weekly: allData.length > 24 * 3, // Has at least 3 days of data
    },
    confidence,
    lastUpdated: new Date(),
  };

  // Store pattern
  await redis.setex(
    `${REDIS_KEYS.PATTERN_PREFIX}${serviceId}`,
    86400, // 24 hours
    JSON.stringify(trafficPattern)
  );

  return trafficPattern;
}

/**
 * Generate forecast using ML/AI
 */
export async function generateForecast(
  serviceId: string,
  metric: string = 'requests_per_second',
  horizon: Forecast['horizon'] = '1hour'
): Promise<Forecast> {
  // Get historical data
  const hoursToFetch = horizon === '15min' ? 24 : horizon === '1hour' ? 48 : horizon === '6hour' ? 168 : 336;
  const history = await getMetricHistory(serviceId, metric, hoursToFetch);

  if (history.length < 12) {
    throw new Error(`Insufficient data for forecasting. Need at least 12 data points, have ${history.length}`);
  }

  // Get traffic pattern
  const pattern = await getTrafficPattern(serviceId);

  // Build forecast prompt
  const forecastPrompt = `Generate a traffic forecast for this service:

SERVICE: ${serviceId}
METRIC: ${metric}
FORECAST HORIZON: ${horizon}

HISTORICAL DATA (last ${hoursToFetch} hours):
${history
  .slice(-100)
  .map((p) => `- ${p.timestamp.toISOString()}: ${p.value.toFixed(2)}`)
  .join('\n')}

DETECTED PATTERN: ${pattern.pattern} (confidence: ${(pattern.confidence * 100).toFixed(0)}%)
${pattern.seasonality?.hourly ? '- Has hourly seasonality' : ''}
${pattern.seasonality?.daily ? '- Has daily seasonality' : ''}

Based on the historical data and pattern, generate predictions for the next ${horizon}.
Consider:
1. Recent trends (last few hours)
2. Seasonal patterns if detected
3. Potential anomalies or special events

Provide predictions at regular intervals (every 5 minutes for 15min/1hour, every 30 minutes for 6hour/24hour).

Respond with JSON:
{
  "predictions": [
    {
      "timestamp": "ISO date string",
      "predictedValue": number,
      "confidenceLower": number,
      "confidenceUpper": number,
      "confidence": number (0-1)
    }
  ],
  "trends": {
    "direction": "up|down|stable",
    "magnitude": number (percentage),
    "anomalyProbability": number (0-1)
  }
}`;

  const schema = `{
    "predictions": [
      {
        "timestamp": "string",
        "predictedValue": "number",
        "confidenceLower": "number",
        "confidenceUpper": "number",
        "confidence": "number"
      }
    ],
    "trends": {
      "direction": "string",
      "magnitude": "number",
      "anomalyProbability": "number"
    }
  }`;

  try {
    const forecastData = await generateJSON<{
      predictions: Array<{
        timestamp: string;
        predictedValue: number;
        confidenceLower: number;
        confidenceUpper: number;
        confidence: number;
      }>;
      trends: {
        direction: 'up' | 'down' | 'stable';
        magnitude: number;
        anomalyProbability: number;
      };
    }>(forecastPrompt, schema, {
      complexity: TaskComplexity.COMPLEX,
      temperature: 0.3,
    });

    const forecast: Forecast = {
      serviceId,
      metric,
      horizon,
      predictions: forecastData.predictions.map((p) => ({
        timestamp: new Date(p.timestamp),
        predictedValue: p.predictedValue,
        confidenceInterval: [p.confidenceLower, p.confidenceUpper],
        confidence: p.confidence,
      })),
      trends: forecastData.trends,
      generatedAt: new Date(),
    };

    // Store forecast
    await redis.setex(
      `${REDIS_KEYS.FORECAST_PREFIX}${serviceId}:${metric}:${horizon}`,
      3600, // 1 hour TTL
      JSON.stringify(forecast)
    );

    console.log(`📊 Generated forecast for ${serviceId}: ${metric} (${horizon}) - ${forecastData.trends.direction} trend`);

    return forecast;
  } catch (error) {
    console.error(`Failed to generate forecast for ${serviceId}:`, error);
    
    // Return simple trend-based forecast
    const lastValues = history.slice(-10);
    const avg = lastValues.reduce((acc, p) => acc + p.value, 0) / lastValues.length;
    const now = Date.now();
    const intervalMinutes = horizon === '15min' ? 5 : horizon === '1hour' ? 10 : horizon === '6hour' ? 30 : 60;
    const numPredictions = horizon === '15min' ? 3 : horizon === '1hour' ? 6 : horizon === '6hour' ? 12 : 24;

    const fallbackForecast: Forecast = {
      serviceId,
      metric,
      horizon,
      predictions: Array.from({ length: numPredictions }, (_, i) => ({
        timestamp: new Date(now + (i + 1) * intervalMinutes * 60 * 1000),
        predictedValue: avg,
        confidenceInterval: [avg * 0.8, avg * 1.2],
        confidence: 0.5,
      })),
      trends: {
        direction: 'stable',
        magnitude: 0,
        anomalyProbability: 0.1,
      },
      generatedAt: new Date(),
    };

    return fallbackForecast;
  }
}

/**
 * Get stored traffic pattern
 */
export async function getTrafficPattern(serviceId: string): Promise<TrafficPattern> {
  const patternData = await redis.get(`${REDIS_KEYS.PATTERN_PREFIX}${serviceId}`);
  
  if (patternData) {
    return JSON.parse(patternData);
  }

  // Analyze on demand
  return analyzeTrafficPattern(serviceId);
}

/**
 * Generate scaling recommendation
 */
export async function generateScalingRecommendation(
  serviceId: string
): Promise<ScalingRecommendation | null> {
  const config = await getScalingConfig(serviceId);
  if (!config.enabled) return null;

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return null;

  // Get current capacity (mock data - would come from Railway/K8s API)
  const currentCapacity = {
    replicas: service.config?.replicas || 1,
    cpuPerReplica: service.config?.resources?.cpu || 0.5,
    memoryPerReplica: service.config?.resources?.memory || 512,
  };

  // Get forecast
  let forecast: Forecast;
  try {
    forecast = await generateForecast(serviceId, 'requests_per_second', config.forecastHorizon);
  } catch (error) {
    console.warn(`Could not generate forecast for ${serviceId}:`, error);
    return null;
  }

  // Get traffic metrics
  const cpuHistory = await getMetricHistory(serviceId, 'cpu_usage', 1);
  const memoryHistory = await getMetricHistory(serviceId, 'memory_usage', 1);
  const requestHistory = await getMetricHistory(serviceId, 'requests_per_second', 1);

  const currentCpu = cpuHistory.length > 0 ? cpuHistory[cpuHistory.length - 1].value : 0;
  const currentMemory = memoryHistory.length > 0 ? memoryHistory[memoryHistory.length - 1].value : 0;
  const currentRequests = requestHistory.length > 0 ? requestHistory[requestHistory.length - 1].value : 0;

  // Predicted peak in forecast window
  const predictedPeak = Math.max(...forecast.predictions.map((p) => p.predictedValue));
  const predictedAvg = forecast.predictions.reduce((acc, p) => acc + p.predictedValue, 0) / forecast.predictions.length;

  // Calculate required capacity
  let recommendedReplicas = currentCapacity.replicas;
  let scalingAction: ScalingRecommendation['recommendedCapacity']['scalingAction'] = 'maintain';
  let reason = 'Traffic pattern stable, no scaling needed';

  // Predicted traffic increase
  const predictedIncrease = ((predictedPeak - currentRequests) / currentRequests) * 100;
  const minConfidence = forecast.predictions.reduce((acc, p) => Math.min(acc, p.confidence), 1);

  if (predictedIncrease > 30 && minConfidence > config.mlConfidenceThreshold) {
    // Need to scale up
    const scaleFactor = Math.ceil(predictedPeak / (currentRequests * 0.7)); // Target 70% utilization
    recommendedReplicas = Math.min(
      Math.max(scaleFactor, currentCapacity.replicas + 1),
      config.maxReplicas
    );
    scalingAction = 'scale_up';
    reason = `Predicted traffic increase of ${predictedIncrease.toFixed(0)}% in next ${config.forecastHorizon}`;
  } else if (predictedIncrease < -30 && minConfidence > config.mlConfidenceThreshold) {
    // Can scale down
    const scaleFactor = Math.floor(predictedPeak / (currentRequests * 0.7));
    recommendedReplicas = Math.max(
      Math.min(scaleFactor, currentCapacity.replicas - 1),
      config.minReplicas
    );
    if (recommendedReplicas < currentCapacity.replicas) {
      scalingAction = 'scale_down';
      reason = `Predicted traffic decrease of ${Math.abs(predictedIncrease).toFixed(0)}% in next ${config.forecastHorizon}`;
    }
  }

  // Check if already at threshold
  if (currentCpu > config.scaleUpThreshold && currentCapacity.replicas < config.maxReplicas) {
    recommendedReplicas = Math.min(currentCapacity.replicas + 1, config.maxReplicas);
    scalingAction = 'scale_up';
    reason = `CPU utilization at ${currentCpu.toFixed(0)}%, exceeds threshold of ${config.scaleUpThreshold}%`;
  } else if (currentCpu < config.scaleDownThreshold && currentCapacity.replicas > config.minReplicas) {
    recommendedReplicas = Math.max(currentCapacity.replicas - 1, config.minReplicas);
    scalingAction = 'scale_down';
    reason = `CPU utilization at ${currentCpu.toFixed(0)}%, below threshold of ${config.scaleDownThreshold}%`;
  }

  // Calculate cost impact (simplified)
  const hourlyCostPerReplica = 0.05; // $0.05 per replica per hour (example)
  const currentCost = currentCapacity.replicas * hourlyCostPerReplica;
  const predictedCost = recommendedReplicas * hourlyCostPerReplica;

  const recommendation: ScalingRecommendation = {
    serviceId,
    triggeredBy: forecast.trends.direction === 'up' ? 'predictive_forecast' : 'threshold_based',
    currentCapacity,
    recommendedCapacity: {
      replicas: recommendedReplicas,
      cpuPerReplica: currentCapacity.cpuPerReplica,
      memoryPerReplica: currentCapacity.memoryPerReplica,
      scalingAction,
      reason,
    },
    forecast,
    costImpact: {
      current: currentCost,
      predicted: predictedCost,
      delta: predictedCost - currentCost,
      deltaPercent: ((predictedCost - currentCost) / currentCost) * 100,
    },
    timing: {
      recommendAt: new Date(),
      executeBy: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    },
    confidence: minConfidence,
    risk: scalingAction === 'scale_up' ? 'low' : 'medium',
  };

  // Store recommendation
  const recId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await redis.setex(
    `${REDIS_KEYS.RECOMMENDATION_PREFIX}${serviceId}`,
    1800, // 30 minutes
    JSON.stringify({ ...recommendation, id: recId })
  );

  console.log(`📈 Scaling recommendation for ${serviceId}: ${scalingAction} to ${recommendedReplicas} replicas (${reason})`);

  return recommendation;
}

/**
 * Execute scaling action
 */
export async function executeScaling(
  serviceId: string,
  targetReplicas: number,
  triggeredBy: string
): Promise<ScalingEvent> {
  const config = await getScalingConfig(serviceId);
  
  // Check cooldown
  const lastScale = await redis.get(`${REDIS_KEYS.LAST_SCALE_PREFIX}${serviceId}`);
  if (lastScale) {
    const lastScaleTime = parseInt(lastScale);
    const secondsSinceLastScale = (Date.now() - lastScaleTime) / 1000;
    const cooldown = targetReplicas > config.minReplicas ? config.scaleUpCooldown : config.scaleDownCooldown;
    
    if (secondsSinceLastScale < cooldown) {
      throw new Error(`Cooldown active. ${Math.ceil(cooldown - secondsSinceLastScale)} seconds remaining.`);
    }
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new Error(`Service not found: ${serviceId}`);

  const currentReplicas = service.config?.replicas || 1;
  
  console.log(`🔄 Scaling ${serviceId}: ${currentReplicas} → ${targetReplicas} replicas`);

  // Record metrics before scaling
  const cpuHistory = await getMetricHistory(serviceId, 'cpu_usage', 1);
  const memoryHistory = await getMetricHistory(serviceId, 'memory_usage', 1);

  const metricsBefore = {
    cpu: cpuHistory.length > 0 ? cpuHistory[cpuHistory.length - 1].value : 0,
    memory: memoryHistory.length > 0 ? memoryHistory[memoryHistory.length - 1].value : 0,
    replicas: currentReplicas,
  };

  // Here you would call Railway or Kubernetes API to actually scale
  // For now, we just simulate
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Record event
  const event: ScalingEvent = {
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    serviceId,
    timestamp: new Date(),
    previousState: { replicas: currentReplicas },
    newState: { replicas: targetReplicas },
    triggeredBy,
    result: 'success',
    metricsBefore,
    metricsAfter: { ...metricsBefore, replicas: targetReplicas },
  };

  // Update last scale time
  await redis.setex(
    `${REDIS_KEYS.LAST_SCALE_PREFIX}${serviceId}`,
    86400,
    Date.now().toString()
  );

  // Store event
  await redis.setex(
    `${REDIS_KEYS.EVENT_PREFIX}${event.id}`,
    604800, // 7 days
    JSON.stringify(event)
  );

  // Update service config in database
  await prisma.service.update({
    where: { id: serviceId },
    data: {
      config: {
        ...service.config,
        replicas: targetReplicas,
      },
    },
  });

  console.log(`✅ Scaled ${serviceId} to ${targetReplicas} replicas`);

  return event;
}

/**
 * Get scaling configuration
 */
export async function getScalingConfig(serviceId: string): Promise<ScalingConfig> {
  const configData = await redis.get(`${REDIS_KEYS.CONFIG_PREFIX}${serviceId}`);
  
  if (configData) {
    return { ...DEFAULT_SCALING_CONFIG, ...JSON.parse(configData), serviceId };
  }

  return { ...DEFAULT_SCALING_CONFIG, serviceId };
}

/**
 * Set scaling configuration
 */
export async function setScalingConfig(
  serviceId: string,
  config: Partial<ScalingConfig>
): Promise<ScalingConfig> {
  const currentConfig = await getScalingConfig(serviceId);
  const newConfig = { ...currentConfig, ...config, serviceId };

  await redis.setex(
    `${REDIS_KEYS.CONFIG_PREFIX}${serviceId}`,
    0, // No TTL - persistent
    JSON.stringify(newConfig)
  );

  return newConfig;
}

/**
 * Get current recommendation
 */
export async function getCurrentRecommendation(serviceId: string): Promise<ScalingRecommendation | null> {
  const recData = await redis.get(`${REDIS_KEYS.RECOMMENDATION_PREFIX}${serviceId}`);
  if (!recData) return null;
  return JSON.parse(recData);
}

/**
 * Get scaling history
 */
export async function getScalingHistory(
  serviceId: string,
  limit: number = 50
): Promise<ScalingEvent[]> {
  const keys = await redis.keys(`${REDIS_KEYS.EVENT_PREFIX}*`);
  const events: ScalingEvent[] = [];

  for (const key of keys) {
    const eventData = await redis.get(key);
    if (eventData) {
      const event: ScalingEvent = JSON.parse(eventData);
      if (event.serviceId === serviceId) {
        events.push(event);
      }
    }
  }

  return events
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

/**
 * Get scaling statistics
 */
export async function getScalingStats(): Promise<{
  totalEvents: number;
  successful: number;
  failed: number;
  costSavings: number;
  avgScalingTime: number;
  byService: Record<string, number>;
}> {
  const keys = await redis.keys(`${REDIS_KEYS.EVENT_PREFIX}*`);
  const events: ScalingEvent[] = [];

  for (const key of keys) {
    const eventData = await redis.get(key);
    if (eventData) {
      events.push(JSON.parse(eventData));
    }
  }

  const successful = events.filter((e) => e.result === 'success').length;
  const failed = events.filter((e) => e.result === 'failed').length;
  
  // Estimate cost savings (simplified)
  const costSavings = events
    .filter((e) => (e.newState.replicas || 0) < (e.previousState.replicas || 0))
    .reduce((acc, e) => acc + ((e.previousState.replicas || 0) - (e.newState.replicas || 0)) * 0.05, 0);

  // Count by service
  const byService: Record<string, number> = {};
  for (const event of events) {
    byService[event.serviceId] = (byService[event.serviceId] || 0) + 1;
  }

  return {
    totalEvents: events.length,
    successful,
    failed,
    costSavings,
    avgScalingTime: 2, // Mock average scaling time in minutes
    byService,
  };
}

/**
 * Run predictive scaling for all services
 */
export async function runPredictiveScaling(): Promise<{
  analyzed: number;
  recommendations: number;
  scaled: number;
}> {
  const services = await prisma.service.findMany();
  let recommendations = 0;
  let scaled = 0;

  for (const service of services) {
    const config = await getScalingConfig(service.id);
    if (!config.enabled || !config.predictiveScaling) continue;

    try {
      const recommendation = await generateScalingRecommendation(service.id);
      
      if (recommendation && recommendation.recommendedCapacity.scalingAction !== 'maintain') {
        recommendations++;

        // Auto-execute if confidence is high and risk is low
        if (
          recommendation.confidence > config.mlConfidenceThreshold &&
          recommendation.risk === 'low' &&
          !config.costOptimization // Don't auto-execute if cost optimization is strict
        ) {
          await executeScaling(
            service.id,
            recommendation.recommendedCapacity.replicas,
            'predictive_auto'
          );
          scaled++;
        }
      }
    } catch (error) {
      console.error(`Predictive scaling failed for ${service.id}:`, error);
    }
  }

  return {
    analyzed: services.length,
    recommendations,
    scaled,
  };
}

// Export types and functions
export {
  MetricDataPoint,
  TrafficPattern,
  Forecast,
  ScalingRecommendation,
  ScalingEvent,
  ScalingConfig,
  ScalingSchedule,
};

export default {
  storeMetric,
  getMetricHistory,
  analyzeTrafficPattern,
  getTrafficPattern,
  generateForecast,
  generateScalingRecommendation,
  executeScaling,
  getScalingConfig,
  setScalingConfig,
  getCurrentRecommendation,
  getScalingHistory,
  getScalingStats,
  runPredictiveScaling,
};
