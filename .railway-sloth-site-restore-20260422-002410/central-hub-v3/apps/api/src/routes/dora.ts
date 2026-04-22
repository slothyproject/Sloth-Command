/**
 * DORA Metrics API Routes
 * /api/metrics/dora/*
 * DevOps performance tracking and analysis
 */

import { Router } from 'express';
import {
  getDORAMetrics,
  getAllDORAMetrics,
  getPerformanceLevel,
  getDeploymentTrend,
} from '../services/dora-metrics';

const router = Router();

/**
 * GET /api/metrics/dora/services/:id
 * Get DORA metrics for a specific service
 */
router.get('/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = '30' } = req.query;
    
    const metrics = await getDORAMetrics(id, parseInt(days as string));
    const performanceLevel = getPerformanceLevel(metrics);
    
    res.json({
      success: true,
      data: {
        ...metrics,
        performanceLevel,
        serviceId: id,
      },
    });
  } catch (error) {
    console.error('DORA metrics error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get DORA metrics',
    });
  }
});

/**
 * GET /api/metrics/dora/overview
 * Get DORA metrics for all services
 */
router.get('/overview', async (req, res) => {
  try {
    const { days = '30' } = req.query;
    
    const allMetrics = await getAllDORAMetrics(parseInt(days as string));
    
    // Calculate aggregate stats
    const performanceLevels = {
      elite: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    
    let totalDeploymentFrequency = 0;
    let totalChangeFailureRate = 0;
    let totalMTTR = 0;
    
    for (const { metrics } of allMetrics) {
      const level = getPerformanceLevel(metrics);
      performanceLevels[level]++;
      
      totalDeploymentFrequency += metrics.deploymentFrequency.daily;
      totalChangeFailureRate += metrics.changeFailureRate.percentage;
      totalMTTR += metrics.mttr.average;
    }
    
    const count = allMetrics.length;
    
    res.json({
      success: true,
      data: {
        services: allMetrics,
        aggregate: {
          totalServices: count,
          performanceLevels,
          averageDeploymentFrequency: count > 0 ? totalDeploymentFrequency / count : 0,
          averageChangeFailureRate: count > 0 ? totalChangeFailureRate / count : 0,
          averageMTTR: count > 0 ? totalMTTR / count : 0,
        },
        period: {
          days: parseInt(days as string),
        },
      },
    });
  } catch (error) {
    console.error('DORA overview error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get DORA overview',
    });
  }
});

/**
 * GET /api/metrics/dora/services/:id/trend
 * Get deployment trend for a service
 */
router.get('/services/:id/trend', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = '30' } = req.query;
    
    const trend = await getDeploymentTrend(id, parseInt(days as string));
    
    res.json({
      success: true,
      data: {
        serviceId: id,
        trend,
        period: {
          days: parseInt(days as string),
        },
      },
    });
  } catch (error) {
    console.error('Deployment trend error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get deployment trend',
    });
  }
});

/**
 * GET /api/metrics/dora/benchmarks
 * Industry benchmarks for DORA metrics
 */
router.get('/benchmarks', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        elite: {
          deploymentFrequency: 'On-demand (multiple per day)',
          leadTime: '< 1 hour',
          changeFailureRate: '< 5%',
          mttr: '< 1 hour',
        },
        high: {
          deploymentFrequency: 'Daily',
          leadTime: '< 1 week',
          changeFailureRate: '< 15%',
          mttr: '< 1 day',
        },
        medium: {
          deploymentFrequency: 'Weekly',
          leadTime: '< 1 month',
          changeFailureRate: '< 30%',
          mttr: '< 1 week',
        },
        low: {
          deploymentFrequency: 'Monthly or less',
          leadTime: '> 1 month',
          changeFailureRate: '> 30%',
          mttr: '> 1 week',
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get benchmarks',
    });
  }
});

export default router;
