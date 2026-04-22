/**
 * Knowledge Graph API Routes
 * /api/knowledge/*
 * Provides graph-based infrastructure insights
 */

import { Router } from 'express';
import knowledgeGraph from '../services/knowledge-graph';

const router = Router();

/**
 * GET /api/knowledge/services
 * Get all services with their relationships
 */
router.get('/services', async (req, res) => {
  try {
    const topology = await knowledgeGraph.getTopology();
    
    res.json({
      success: true,
      data: topology,
    });
  } catch (error) {
    console.error('Knowledge graph services error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get topology',
    });
  }
});

/**
 * GET /api/knowledge/services/:id/dependencies
 * Get what a service depends on
 */
router.get('/services/:id/dependencies', async (req, res) => {
  try {
    const { id } = req.params;
    const dependencies = await knowledgeGraph.getDependencies(id);
    
    res.json({
      success: true,
      data: dependencies,
    });
  } catch (error) {
    console.error('Get dependencies error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get dependencies',
    });
  }
});

/**
 * GET /api/knowledge/services/:id/dependents
 * Get what depends on this service
 */
router.get('/services/:id/dependents', async (req, res) => {
  try {
    const { id } = req.params;
    const dependents = await knowledgeGraph.getDependents(id);
    
    res.json({
      success: true,
      data: dependents,
    });
  } catch (error) {
    console.error('Get dependents error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get dependents',
    });
  }
});

/**
 * GET /api/knowledge/services/:id/blast-radius
 * Find all services affected if this service fails
 */
router.get('/services/:id/blast-radius', async (req, res) => {
  try {
    const { id } = req.params;
    const { depth = '3' } = req.query;
    
    const affectedServices = await knowledgeGraph.findBlastRadius(
      id,
      parseInt(depth as string)
    );
    
    res.json({
      success: true,
      data: {
        serviceId: id,
        affectedCount: affectedServices.length,
        affectedServices,
        maxDepth: parseInt(depth as string),
      },
    });
  } catch (error) {
    console.error('Blast radius error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate blast radius',
    });
  }
});

/**
 * GET /api/knowledge/circular-dependencies
 * Find circular dependencies in the infrastructure
 */
router.get('/circular-dependencies', async (req, res) => {
  try {
    const cycles = await knowledgeGraph.findCircularDependencies();
    
    res.json({
      success: true,
      data: {
        hasCycles: cycles.length > 0,
        count: cycles.length,
        cycles,
      },
    });
  } catch (error) {
    console.error('Circular dependencies error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to find circular dependencies',
    });
  }
});

/**
 * GET /api/knowledge/critical-services
 * Get the most critical services (most dependents)
 */
router.get('/critical-services', async (req, res) => {
  try {
    const criticalServices = await knowledgeGraph.getCriticalServices();
    
    res.json({
      success: true,
      data: criticalServices,
    });
  } catch (error) {
    console.error('Critical services error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get critical services',
    });
  }
});

/**
 * POST /api/knowledge/sync
 * Sync infrastructure from database to knowledge graph
 */
router.post('/sync', async (req, res) => {
  try {
    // This would typically sync from Prisma services
    // For now, return placeholder
    res.json({
      success: true,
      message: 'Knowledge graph sync initiated',
    });
  } catch (error) {
    console.error('Knowledge sync error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync knowledge graph',
    });
  }
});

/**
 * POST /api/knowledge/dependencies
 * Create dependency relationships
 */
router.post('/dependencies', async (req, res) => {
  try {
    const { fromServiceId, toServiceId, type = 'depends_on' } = req.body;
    
    if (!fromServiceId || !toServiceId) {
      return res.status(400).json({
        success: false,
        error: 'fromServiceId and toServiceId are required',
      });
    }
    
    await knowledgeGraph.createDependency(fromServiceId, toServiceId, type);
    
    res.json({
      success: true,
      message: `Dependency created: ${fromServiceId} ${type} ${toServiceId}`,
    });
  } catch (error) {
    console.error('Create dependency error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create dependency',
    });
  }
});

/**
 * GET /api/knowledge/health
 * Check Neo4j connection health
 */
router.get('/health', async (req, res) => {
  try {
    const healthy = await knowledgeGraph.checkNeo4jHealth();
    
    res.json({
      success: true,
      healthy,
      status: healthy ? 'connected' : 'disconnected',
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      healthy: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
});

export default router;
