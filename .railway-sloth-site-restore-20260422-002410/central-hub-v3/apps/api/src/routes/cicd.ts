/**
 * CI/CD API Routes
 * /api/cicd/*
 * Pipeline management, GitHub Actions, GitLab CI integration
 */

import { Router } from 'express';
import cicd, { CICDProvider } from '../services/cicd';

const router = Router();

/**
 * GET /api/cicd/status
 * Get CI/CD system status
 */
router.get('/status', async (req, res) => {
  try {
    const summary = await cicd.getCICDSummary();
    
    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('CI/CD status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status',
    });
  }
});

/**
 * GET /api/cicd/providers
 * Get available CI/CD providers
 */
router.get('/providers', (req, res) => {
  res.json({
    success: true,
    data: Object.values(CICDProvider).map((p) => ({
      id: p,
      name: p.replace(/_/g, ' ').toUpperCase(),
    })),
  });
});

/**
 * GET /api/cicd/pipelines
 * Get all pipelines
 */
router.get('/pipelines', async (req, res) => {
  try {
    const pipelines = await cicd.getPipelines();
    
    res.json({
      success: true,
      data: pipelines.map((p) => ({
        id: p.id,
        provider: p.provider,
        name: p.name,
        repository: p.repository,
        triggers: p.triggers,
        stages: p.stages.length,
        enabled: p.enabled,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get pipelines error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get pipelines',
    });
  }
});

/**
 * POST /api/cicd/pipelines
 * Create a new pipeline
 */
router.post('/pipelines', async (req, res) => {
  try {
    const { provider, name, repository, stages } = req.body;
    
    if (!provider || !name || !repository || !stages) {
      return res.status(400).json({
        success: false,
        error: 'provider, name, repository, and stages are required',
      });
    }

    if (!Object.values(CICDProvider).includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider',
      });
    }

    const pipeline = await cicd.createPipeline(provider, name, repository, stages);
    
    res.json({
      success: true,
      data: {
        id: pipeline.id,
        provider: pipeline.provider,
        name: pipeline.name,
        stages: pipeline.stages.length,
      },
    });
  } catch (error) {
    console.error('Create pipeline error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create pipeline',
    });
  }
});

/**
 * GET /api/cicd/pipelines/:id
 * Get pipeline details
 */
router.get('/pipelines/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pipeline = await cicd.getPipeline(id);
    
    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found',
      });
    }
    
    res.json({
      success: true,
      data: pipeline,
    });
  } catch (error) {
    console.error('Get pipeline error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get pipeline',
    });
  }
});

/**
 * PUT /api/cicd/pipelines/:id
 * Update pipeline
 */
router.put('/pipelines/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const pipeline = await cicd.updatePipeline(id, updates);
    
    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found',
      });
    }
    
    res.json({
      success: true,
      data: pipeline,
    });
  } catch (error) {
    console.error('Update pipeline error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update pipeline',
    });
  }
});

/**
 * DELETE /api/cicd/pipelines/:id
 * Delete pipeline
 */
router.delete('/pipelines/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await cicd.deletePipeline(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Pipeline deleted',
    });
  } catch (error) {
    console.error('Delete pipeline error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete pipeline',
    });
  }
});

/**
 * POST /api/cicd/pipelines/:id/trigger
 * Trigger a pipeline run
 */
router.post('/pipelines/:id/trigger', async (req, res) => {
  try {
    const { id } = req.params;
    const { trigger, variables } = req.body;
    
    const run = await cicd.triggerPipeline(id, trigger || { type: 'manual', actor: 'api', branch: 'main' }, variables);
    
    res.json({
      success: true,
      data: {
        runId: run.id,
        runNumber: run.runNumber,
        status: run.status,
        startedAt: run.startedAt,
      },
    });
  } catch (error) {
    console.error('Trigger pipeline error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger pipeline',
    });
  }
});

/**
 * GET /api/cicd/pipelines/:id/runs
 * Get pipeline runs
 */
router.get('/pipelines/:id/runs', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = '20' } = req.query;
    
    const runs = await cicd.getPipelineRuns(id, parseInt(limit as string));
    
    res.json({
      success: true,
      data: runs,
      count: runs.length,
    });
  } catch (error) {
    console.error('Get pipeline runs error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get pipeline runs',
    });
  }
});

/**
 * GET /api/cicd/runs/:runId
 * Get pipeline run details
 */
router.get('/runs/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const run = await cicd.getPipelineRun(runId);
    
    if (!run) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline run not found',
      });
    }
    
    res.json({
      success: true,
      data: run,
    });
  } catch (error) {
    console.error('Get pipeline run error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get pipeline run',
    });
  }
});

/**
 * POST /api/cicd/runs/:runId/cancel
 * Cancel a pipeline run
 */
router.post('/runs/:runId/cancel', async (req, res) => {
  try {
    const { runId } = req.params;
    const success = await cicd.cancelPipelineRun(runId);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel this run',
      });
    }
    
    res.json({
      success: true,
      message: 'Pipeline run cancelled',
    });
  } catch (error) {
    console.error('Cancel pipeline run error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel pipeline run',
    });
  }
});

/**
 * GET /api/cicd/runs/:runId/logs
 * Get job logs
 */
router.get('/runs/:runId/logs', async (req, res) => {
  try {
    const { runId } = req.params;
    const { jobId } = req.query;
    
    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'jobId is required',
      });
    }

    const logs = await cicd.getJobLogs(runId, jobId as string);
    
    res.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error) {
    console.error('Get job logs error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get job logs',
    });
  }
});

/**
 * GET /api/cicd/pipelines/:id/workflow
 * Generate workflow file
 */
router.get('/pipelines/:id/workflow', async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'github' } = req.query;
    
    let workflow;
    if (format === 'github') {
      workflow = await cicd.generateGitHubWorkflow(id);
    } else if (format === 'gitlab') {
      workflow = await cicd.generateGitLabCI(id);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Use "github" or "gitlab"',
      });
    }
    
    res.json({
      success: true,
      data: workflow,
      format,
    });
  } catch (error) {
    console.error('Generate workflow error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate workflow',
    });
  }
});

/**
 * GET /api/cicd/pipelines/:id/analytics
 * Get build analytics
 */
router.get('/pipelines/:id/analytics', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = '30' } = req.query;
    
    const analytics = await cicd.getBuildAnalytics(id, parseInt(days as string));
    
    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get analytics',
    });
  }
});

/**
 * GET /api/cicd/deployments
 * Get deployment configurations
 */
router.get('/deployments', async (req, res) => {
  try {
    const { pipelineId } = req.query;
    
    const configs = await cicd.getDeploymentConfigs(pipelineId as string);
    
    res.json({
      success: true,
      data: configs,
      count: configs.length,
    });
  } catch (error) {
    console.error('Get deployments error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get deployments',
    });
  }
});

/**
 * POST /api/cicd/deployments
 * Create deployment configuration
 */
router.post('/deployments', async (req, res) => {
  try {
    const config = await cicd.createDeploymentConfig(req.body);
    
    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Create deployment config error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create deployment config',
    });
  }
});

export default router;
