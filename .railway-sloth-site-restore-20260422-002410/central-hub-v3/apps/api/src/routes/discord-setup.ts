/**
 * Discord Server Setup API Routes
 * /api/discord/setup/*
 * AI-driven setup, configuration, and management
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  discordSetupSafety,
  requireApprovedPlan,
  auditDiscordSetupOperation,
  rateLimitDiscordSetup,
  validateSetupConfiguration,
} from '../middleware/discord-setup-safety';
import {
  generateSetupPlan,
  getSetupPlan,
  approveAndStartSetup,
  executeSetupStep,
  executeAllRemainingSteps,
  rollbackSetup,
  getSetupStatus,
} from '../services/discord-setup';
import { getAllTemplates } from '../services/discord-setup-templates';
import { selectAgent, createPlan as createAgentPlan } from '../services/agentic-ai';

const router = Router();

/**
 * GET /api/discord/setup/templates
 * Get all available setup templates
 */
router.get('/templates', async (req, res) => {
  try {
    const templates = getAllTemplates();

    res.json({
      success: true,
      data: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        emoji: t.emoji,
        channels: t.channels.length,
        roles: t.roles.length,
        hasModeration: !!t.moderationPolicy,
        hasWelcome: !!t.welcomeSettings,
        hasLeveling: !!t.levelingSettings,
      })),
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch templates',
    });
  }
});

/**
 * GET /api/discord/setup/templates/:templateId
 * Get specific template details
 */
router.get('/templates/:templateId', async (req, res) => {
  try {
    const templates = getAllTemplates();
    const template = templates.find((t) => t.id === req.params.templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch template',
    });
  }
});

/**
 * POST /api/discord/setup/generate-plan
 * Generate a setup plan from user request
 * Body: { guildId, userPrompt, templateId? }
 */
router.post('/generate-plan', authenticateToken, async (req, res) => {
  try {
    const { guildId, userPrompt, templateId } = req.body;

    if (!guildId || !userPrompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: guildId, userPrompt',
      });
    }

    const plan = await generateSetupPlan({
      guildId,
      userPrompt,
      templateId,
    });

    res.json({
      success: true,
      data: plan,
    });
  } catch (error) {
    console.error('Error generating setup plan:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate plan',
    });
  }
});

/**
 * GET /api/discord/setup/:setupRunId
 * Get setup plan details
 */
router.get('/:setupRunId', authenticateToken, async (req, res) => {
  try {
    const plan = await getSetupPlan(req.params.setupRunId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Setup plan not found',
      });
    }

    const status = await getSetupStatus(req.params.setupRunId);

    res.json({
      success: true,
      data: {
        ...plan,
        status: status?.status,
        progress: status?.progress,
        currentStep: status?.currentStep,
        totalSteps: status?.totalSteps,
      },
    });
  } catch (error) {
    console.error('Error fetching setup plan:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch setup plan',
    });
  }
});

/**
 * POST /api/discord/setup/:setupRunId/approve
 * Approve setup plan and start execution
 */
router.post(
  '/:setupRunId/approve',
  authenticateToken,
  rateLimitDiscordSetup,
  validateSetupConfiguration,
  discordSetupSafety,
  auditDiscordSetupOperation,
  async (req, res) => {
    try {
      const setupRunId = req.params.setupRunId;
      const userId = (req as any).user.id;

      await approveAndStartSetup(setupRunId, userId);

      const status = await getSetupStatus(setupRunId);

      res.json({
        success: true,
        data: {
          message: 'Setup approved and execution started',
          status: status?.status,
          progress: status?.progress,
        },
      });
    } catch (error) {
      console.error('Error approving setup:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve setup',
      });
    }
  }
);

/**
 * POST /api/discord/setup/:setupRunId/execute-all
 * Execute all remaining setup steps
 * Requires Discord client to be injected via middleware
 */
router.post(
  '/:setupRunId/execute-all',
  authenticateToken,
  rateLimitDiscordSetup,
  requireApprovedPlan,
  discordSetupSafety,
  auditDiscordSetupOperation,
  async (req, res) => {
    try {
      const setupRunId = req.params.setupRunId;
      const client = (req as any).discordClient;

      if (!client) {
        return res.status(500).json({
          success: false,
          error: 'Discord client not available',
        });
      }

      const results = await executeAllRemainingSteps(client, setupRunId);
      const status = await getSetupStatus(setupRunId);

      const allSucceeded = results.every((r) => r.success);

      res.json({
        success: allSucceeded,
        data: {
          status: status?.status,
          progress: status?.progress,
          completedSteps: status?.executedSteps,
          totalSteps: status?.totalSteps,
          results,
        },
      });
    } catch (error) {
      console.error('Error executing setup:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute setup',
      });
    }
  }
);

/**
 * GET /api/discord/setup/:setupRunId/status
 * Get current setup execution status
 */
router.get('/:setupRunId/status', authenticateToken, async (req, res) => {
  try {
    const status = await getSetupStatus(req.params.setupRunId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Setup not found',
      });
    }

    res.json({
      success: true,
      data: {
        id: status.id,
        status: status.status,
        progress: status.progress,
        currentStep: status.currentStep,
        executedSteps: status.executedSteps,
        totalSteps: status.totalSteps,
        template: status.setupTemplate,
        createdAt: status.createdAt,
        completedAt: status.completedAt,
        steps: status.steps.map((s: any) => ({
          order: s.order,
          type: s.type,
          description: s.description,
          status: s.status,
          error: s.error,
          executedAt: s.executedAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching setup status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch setup status',
    });
  }
});

/**
 * POST /api/discord/setup/:setupRunId/rollback
 * Rollback setup to previous state
 */
router.post('/:setupRunId/rollback', authenticateToken, async (req, res) => {
  try {
    const success = await rollbackSetup(req.params.setupRunId);

    res.json({
      success,
      data: {
        message: success ? 'Setup rolled back successfully' : 'Rollback partially failed',
      },
    });
  } catch (error) {
    console.error('Error rolling back setup:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rollback setup',
    });
  }
});

/**
 * POST /api/discord/setup/ai-plan
 * Use AI agent to generate a custom setup plan
 * Body: { guildId, goal }
 */
router.post('/ai-plan', authenticateToken, async (req, res) => {
  try {
    const { guildId, goal } = req.body;

    if (!guildId || !goal) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: guildId, goal',
      });
    }

    // Select appropriate agent
    const agentType = await selectAgent(goal);

    // Create agent plan
    const agentPlan = await createAgentPlan(goal, agentType, {
      guildId,
      setupContext: 'discord_server_configuration',
    });

    res.json({
      success: true,
      data: {
        planId: agentPlan.id,
        agentType: agentPlan.agentType,
        goal: agentPlan.goal,
        steps: agentPlan.steps.length,
        estimatedDuration: agentPlan.metadata.estimatedDuration,
        requiresApproval: agentPlan.metadata.requiresApproval,
        plan: agentPlan,
      },
    });
  } catch (error) {
    console.error('Error creating AI plan:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create AI plan',
    });
  }
});

export default router;
