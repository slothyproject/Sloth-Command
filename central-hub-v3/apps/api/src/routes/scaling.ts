/**
 * Predictive Scaling API Routes
 * /api/scaling/*
 * ML-based traffic forecasting and scaling management
 */

import { Router } from 'express';
import predictiveScaling from '../services/predictive-scaling';

const router = Router();

/**
 * GET /api/scaling/status
 * Get predictive scaling system status
 */
router.get('/status', async (req, res) => {
  try {
    const stats = await predictiveScaling.getScalingStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Scaling status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get scaling status',
    });
  }
});

/**
 * GET /api/scaling/services/:serviceId/metrics
 * Get metric history for a service
 */
router.get('/services/:serviceId/metrics', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { metric = 'requests_per_second', hours = '24' } = req.query;
    
    const metrics = await predictiveScaling.getMetricHistory(
      serviceId,
      metric as string,
      parseInt(hours as string)
    );
    
    res.json({
      success: true,
      data: {
        serviceId,
        metric,
        hours: parseInt(hours as string),
        count: metrics.length,
        metrics,
      },
    });
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get metrics',
    });
  }
});

/**
 * POST /api/scaling/services/:serviceId/metrics
 * Store a metric data point
 */
router.post('/services/:serviceId/metrics', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { metric, value, tags = {} } = req.body;
    
    if (!metric || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'metric and value are required',
      });
    }

    await predictiveScaling.storeMetric({
      serviceId,
      metric,
      value,
      timestamp: new Date(),
      tags,
    });
    
    res.json({
      success: true,
      message: 'Metric stored',
    });
  } catch (error) {
    console.error('Store metric error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to store metric',
    });
  }
});

/**
 * GET /api/scaling/services/:serviceId/pattern
 * Get traffic pattern analysis
 */
router.get('/services/:serviceId/pattern', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const pattern = await predictiveScaling.getTrafficPattern(serviceId);
    
    res.json({
      success: true,
      data: pattern,
    });
  } catch (error) {
    console.error('Get pattern error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get traffic pattern',
    });
  }
});

/**
 * POST /api/scaling/services/:serviceId/forecast
 * Generate traffic forecast
 */
router.post('/services/:serviceId/forecast', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { metric = 'requests_per_second', horizon = '1hour' } = req.body;
    
    const forecast = await predictiveScaling.generateForecast(
      serviceId,
      metric,
      horizon as any
    );
    
    res.json({
      success: true,
      data: forecast,
    });
  } catch (error) {
    console.error('Generate forecast error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate forecast',
    });
  }
});

/**
 * GET /api/scaling/services/:serviceId/recommendation
 * Get current scaling recommendation
 */
router.get('/services/:serviceId/recommendation', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const recommendation = await predictiveScaling.getCurrentRecommendation(serviceId);
    
    if (!recommendation) {
      return res.json({
        success: true,
        data: null,
        message: 'No active recommendation for this service',
      });
    }
    
    res.json({
      success: true,
      data: recommendation,
    });
  } catch (error) {
    console.error('Get recommendation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get recommendation',
    });
  }
});

/**
 * POST /api/scaling/services/:serviceId/recommendation
 * Generate new scaling recommendation
 */
router.post('/services/:serviceId/recommendation', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const recommendation = await predictiveScaling.generateScalingRecommendation(serviceId);
    
    if (!recommendation) {
      return res.json({
        success: true,
        data: null,
        message: 'No scaling needed for this service',
      });
    }
    
    res.json({
      success: true,
      data: recommendation,
    });
  } catch (error) {
    console.error('Generate recommendation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate recommendation',
    });
  }
});

/**
 * POST /api/scaling/services/:serviceId/scale
 * Execute scaling action
 */
router.post('/services/:serviceId/scale', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { targetReplicas, triggeredBy = 'manual' } = req.body;
    
    if (targetReplicas === undefined) {
      return res.status(400).json({
        success: false,
        error: 'targetReplicas is required',
      });
    }

    const event = await predictiveScaling.executeScaling(
      serviceId,
      parseInt(targetReplicas),
      triggeredBy
    );
    
    res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error('Execute scaling error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute scaling',
    });
  }
});

/**
 * GET /api/scaling/services/:serviceId/history
 * Get scaling history for a service
 */
router.get('/services/:serviceId/history', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { limit = '50' } = req.query;
    
    const history = await predictiveScaling.getScalingHistory(
      serviceId,
      parseInt(limit as string)
    );
    
    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error) {
    console.error('Get scaling history error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get scaling history',
    });
  }
});

/**
 * GET /api/scaling/config/:serviceId
 * Get scaling configuration
 */
router.get('/config/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const config = await predictiveScaling.getScalingConfig(serviceId);
    
    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Get scaling config error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get scaling config',
    });
  }
});

/**
 * PUT /api/scaling/config/:serviceId
 * Update scaling configuration
 */
router.put('/config/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const {
      enabled,
      minReplicas,
      maxReplicas,
      targetCpuUtilization,
      predictiveScaling,
      forecastHorizon,
    } = req.body;
    
    const config = await predictiveScaling.setScalingConfig(serviceId, {
      enabled,
      minReplicas,
      maxReplicas,
      targetCpuUtilization,
      predictiveScaling,
      forecastHorizon,
    });
    
    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Update scaling config error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update scaling config',
    });
  }
});

/**
 * POST /api/scaling/run-predictive
 * Run predictive scaling for all services
 */
router.post('/run-predictive', async (req, res) => {
  try {
    const result = await predictiveScaling.runPredictiveScaling();
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Run predictive scaling error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run predictive scaling',
    });
  }
});

export default router;
