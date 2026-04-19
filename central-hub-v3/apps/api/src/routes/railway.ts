/**
 * Railway API Routes
 * /api/railway/*
 */

import { Router } from 'express';
import { railwayService } from '../services/railway';

const router = Router();

/**
 * POST /api/railway/sync
 * Sync Railway services with Central Hub
 */
router.post('/sync', async (req, res) => {
  try {
    const services = await railwayService.syncServices();
    
    res.json({
      success: true,
      data: services,
      count: services.length,
    });
  } catch (error) {
    console.error('Railway sync error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    });
  }
});

/**
 * GET /api/railway/services
 * Get all Railway services
 */
router.get('/services', async (req, res) => {
  try {
    const services = await railwayService.getRailwayServices();
    
    res.json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error('Get Railway services error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get services',
    });
  }
});

/**
 * GET /api/railway/services/:serviceId/metrics
 * Get service metrics
 */
router.get('/services/:serviceId/metrics', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const metrics = await railwayService.getServiceMetrics(serviceId);
    
    res.json({
      success: true,
      data: metrics,
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
 * POST /api/railway/services/:serviceId/deploy
 * Deploy a service
 */
router.post('/services/:serviceId/deploy', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const deployment = await railwayService.deployService(serviceId);
    
    res.json({
      success: true,
      data: deployment,
    });
  } catch (error) {
    console.error('Deploy error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Deployment failed',
    });
  }
});

/**
 * POST /api/railway/services/:serviceId/restart
 * Restart a service
 */
router.post('/services/:serviceId/restart', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const success = await railwayService.restartService(serviceId);
    
    res.json({
      success,
      message: success ? 'Service restarted' : 'Failed to restart service',
    });
  } catch (error) {
    console.error('Restart error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Restart failed',
    });
  }
});

/**
 * POST /api/railway/services/:serviceId/scale
 * Scale a service
 */
router.post('/services/:serviceId/scale', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { replicas } = req.body;
    
    if (typeof replicas !== 'number' || replicas < 1) {
      return res.status(400).json({
        success: false,
        error: 'replicas must be a positive number',
      });
    }
    
    const success = await railwayService.scaleService(serviceId, replicas);
    
    res.json({
      success,
      message: success ? `Scaled to ${replicas} replicas` : 'Failed to scale',
    });
  } catch (error) {
    console.error('Scale error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Scaling failed',
    });
  }
});

/**
 * POST /api/railway/services/:serviceId/variables
 * Update environment variables
 */
router.post('/services/:serviceId/variables', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { variables } = req.body;
    
    if (!variables || typeof variables !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'variables object is required',
      });
    }
    
    const updated = await railwayService.updateVariables(serviceId, variables);
    
    res.json({
      success: true,
      data: updated,
      count: updated.length,
    });
  } catch (error) {
    console.error('Update variables error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update variables',
    });
  }
});

/**
 * GET /api/railway/services/:serviceId/variables
 * Get environment variables
 */
router.get('/services/:serviceId/variables', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const variables = await railwayService.getRailwayVariables(serviceId);
    
    res.json({
      success: true,
      data: variables,
    });
  } catch (error) {
    console.error('Get variables error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get variables',
    });
  }
});

/**
 * GET /api/railway/services/:serviceId/logs
 * Get service logs
 */
router.get('/services/:serviceId/logs', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { limit = 100 } = req.query;
    
    const logs = await railwayService.getLogs(serviceId, parseInt(limit as string));
    
    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get logs',
    });
  }
});

export default router;
