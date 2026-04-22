/**
 * Self-Healing API Routes
 * /api/healing/*
 * Automatic remediation and issue management
 */

import { Router } from 'express';
import selfHealing, { IssueSeverity, HealingMode } from '../services/self-healing';

const router = Router();

/**
 * GET /api/healing/status
 * Get self-healing system status
 */
router.get('/status', async (req, res) => {
  try {
    const stats = await selfHealing.getHealingStats();
    const activeIssues = await selfHealing.getActiveIssues();
    
    res.json({
      success: true,
      data: {
        ...stats,
        activeIssues: activeIssues.length,
        activeIssuesList: activeIssues.map((issue) => ({
          id: issue.id,
          serviceId: issue.serviceId,
          serviceName: issue.serviceName,
          type: issue.type,
          severity: issue.severity,
          status: issue.status,
          detectedAt: issue.detectedAt,
        })),
      },
    });
  } catch (error) {
    console.error('Healing status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get healing status',
    });
  }
});

/**
 * GET /api/healing/issues
 * Get all active issues
 */
router.get('/issues', async (req, res) => {
  try {
    const issues = await selfHealing.getActiveIssues();
    
    res.json({
      success: true,
      data: issues,
      count: issues.length,
    });
  } catch (error) {
    console.error('Get issues error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get issues',
    });
  }
});

/**
 * GET /api/healing/issues/:id
 * Get issue details
 */
router.get('/issues/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const issue = await selfHealing.getIssue(id);
    
    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found',
      });
    }
    
    res.json({
      success: true,
      data: issue,
    });
  } catch (error) {
    console.error('Get issue error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get issue',
    });
  }
});

/**
 * POST /api/healing/issues/:id/diagnose
 * Diagnose an issue
 */
router.post('/issues/:id/diagnose', async (req, res) => {
  try {
    const { id } = req.params;
    const issue = await selfHealing.getIssue(id);
    
    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found',
      });
    }

    const diagnosis = await selfHealing.diagnoseIssue(issue);
    
    res.json({
      success: true,
      data: diagnosis,
    });
  } catch (error) {
    console.error('Diagnose issue error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to diagnose issue',
    });
  }
});

/**
 * POST /api/healing/issues/:id/remediate
 * Execute remediation for an issue
 */
router.post('/issues/:id/remediate', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, type = 'custom', params = {} } = req.body;
    
    if (!action) {
      return res.status(400).json({
        success: false,
        error: 'action is required',
      });
    }

    const issue = await selfHealing.getIssue(id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found',
      });
    }

    const remediationAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      issueId: id,
      action,
      type,
      status: 'pending' as const,
      requiresApproval: false,
      params,
    };

    const result = await selfHealing.executeRemediation(issue, remediationAction);
    
    res.json({
      success: result.status === 'completed',
      data: result,
    });
  } catch (error) {
    console.error('Remediate error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remediate',
    });
  }
});

/**
 * GET /api/healing/config/:serviceId
 * Get healing configuration for a service
 */
router.get('/config/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const config = await selfHealing.getHealingConfig(serviceId);
    
    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Get healing config error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get healing config',
    });
  }
});

/**
 * PUT /api/healing/config/:serviceId
 * Update healing configuration
 */
router.put('/config/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { enabled, mode, autoHealSeverities, maxAutoAttempts, cooldownMinutes } = req.body;
    
    const config = await selfHealing.setHealingConfig(serviceId, {
      enabled,
      mode,
      autoHealSeverities,
      maxAutoAttempts,
      cooldownMinutes,
    });
    
    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Update healing config error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update healing config',
    });
  }
});

/**
 * GET /api/healing/health-score/:serviceId
 * Get health score for a service
 */
router.get('/health-score/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const score = await selfHealing.calculateHealthScore(serviceId);
    
    res.json({
      success: true,
      data: score,
    });
  } catch (error) {
    console.error('Health score error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get health score',
    });
  }
});

/**
 * POST /api/healing/detect
 * Manually trigger issue detection
 */
router.post('/detect', async (req, res) => {
  try {
    const { serviceId, healthData } = req.body;
    
    if (!serviceId || !healthData) {
      return res.status(400).json({
        success: false,
        error: 'serviceId and healthData are required',
      });
    }

    const issues = await selfHealing.detectIssues(serviceId, healthData);
    
    // Process detected issues
    const processed = [];
    for (const issue of issues) {
      const result = await selfHealing.processIssue(issue);
      processed.push(result);
    }
    
    res.json({
      success: true,
      data: {
        detected: issues.length,
        processed: processed.length,
        issues: issues.map((i) => ({
          id: i.id,
          type: i.type,
          severity: i.severity,
          description: i.description,
        })),
      },
    });
  } catch (error) {
    console.error('Detect issues error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to detect issues',
    });
  }
});

export default router;
