/**
 * Agentic AI API Routes
 * /api/agents/*
 * Multi-step planning and execution endpoints
 */

import { Router } from 'express';
import agenticAI, { AgentType, TaskStatus } from '../services/agentic-ai';

const router = Router();

/**
 * GET /api/agents
 * Get available agents and their capabilities
 */
router.get('/', (req, res) => {
  try {
    const agents = agenticAI.getAvailableAgents();
    
    res.json({
      success: true,
      data: agents,
    });
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get agents',
    });
  }
});

/**
 * POST /api/agents/process
 * Process a natural language request
 */
router.post('/process', async (req, res) => {
  try {
    const { request, context = {} } = req.body;
    
    if (!request) {
      return res.status(400).json({
        success: false,
        error: 'Request is required',
      });
    }

    const result = await agenticAI.processRequest(request, context);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Process request error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process request',
    });
  }
});

/**
 * POST /api/agents/plans
 * Create a new execution plan
 */
router.post('/plans', async (req, res) => {
  try {
    const { goal, agentType, context = {} } = req.body;
    
    if (!goal) {
      return res.status(400).json({
        success: false,
        error: 'Goal is required',
      });
    }

    const type = agentType && Object.values(AgentType).includes(agentType) 
      ? agentType 
      : await agenticAI.selectAgent(goal);

    const plan = await agenticAI.createPlan(goal, type, context);
    
    res.json({
      success: true,
      data: {
        planId: plan.id,
        goal: plan.goal,
        agentType: plan.agentType,
        steps: plan.steps.length,
        requiresApproval: plan.metadata.requiresApproval,
        status: plan.status,
        createdAt: plan.createdAt,
      },
    });
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create plan',
    });
  }
});

/**
 * GET /api/agents/plans
 * Get all active plans
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = await agenticAI.getActivePlans();
    
    res.json({
      success: true,
      data: plans.map((plan) => ({
        planId: plan.id,
        goal: plan.goal,
        agentType: plan.agentType,
        status: plan.status,
        progress: {
          total: plan.steps.length,
          completed: plan.steps.filter((s) => s.status === TaskStatus.COMPLETED).length,
          failed: plan.steps.filter((s) => s.status === TaskStatus.FAILED).length,
          pending: plan.steps.filter((s) => s.status === TaskStatus.PENDING).length,
        },
        createdAt: plan.createdAt,
        startedAt: plan.startedAt,
        metadata: plan.metadata,
      })),
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get plans',
    });
  }
});

/**
 * GET /api/agents/plans/:id
 * Get plan details
 */
router.get('/plans/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await agenticAI.getPlan(id);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found',
      });
    }
    
    res.json({
      success: true,
      data: plan,
    });
  } catch (error) {
    console.error('Get plan error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get plan',
    });
  }
});

/**
 * POST /api/agents/plans/:id/execute
 * Execute a plan
 */
router.post('/plans/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await agenticAI.getPlan(id);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found',
      });
    }

    // If requires approval, mark as approved first
    if (plan.metadata.requiresApproval) {
      await agenticAI.approvePlan(id, true);
    }

    // Queue for execution (async)
    await agenticAI.queuePlanExecution(id);
    
    res.json({
      success: true,
      message: `Plan ${id} queued for execution`,
      data: { planId: id, status: 'queued' },
    });
  } catch (error) {
    console.error('Execute plan error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute plan',
    });
  }
});

/**
 * POST /api/agents/plans/:id/approve
 * Approve or reject a plan
 */
router.post('/plans/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    
    if (approved === undefined) {
      return res.status(400).json({
        success: false,
        error: 'approved field is required (true/false)',
      });
    }

    const plan = await agenticAI.approvePlan(id, approved);
    
    res.json({
      success: true,
      message: `Plan ${id} ${approved ? 'approved' : 'rejected'}`,
      data: {
        planId: id,
        status: plan.status,
        approved,
      },
    });
  } catch (error) {
    console.error('Approve plan error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve plan',
    });
  }
});

/**
 * POST /api/agents/plans/:id/cancel
 * Cancel a plan
 */
router.post('/plans/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await agenticAI.cancelPlan(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found',
      });
    }
    
    res.json({
      success: true,
      message: `Plan ${id} cancelled`,
    });
  } catch (error) {
    console.error('Cancel plan error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel plan',
    });
  }
});

/**
 * POST /api/agents/plans/:id/replan
 * Replan based on new information
 */
router.post('/plans/:id/replan', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Reason for replanning is required',
      });
    }

    const plan = await agenticAI.replan(id, reason);
    
    res.json({
      success: true,
      message: `Plan ${id} replanned`,
      data: {
        planId: plan.id,
        steps: plan.steps.length,
        status: plan.status,
      },
    });
  } catch (error) {
    console.error('Replan error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to replan',
    });
  }
});

/**
 * GET /api/agents/types/:type/capabilities
 * Get capabilities for an agent type
 */
router.get('/types/:type/capabilities', (req, res) => {
  try {
    const { type } = req.params;
    
    if (!Object.values(AgentType).includes(type as AgentType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent type',
      });
    }

    const capabilities = agenticAI.getAgentCapabilities(type as AgentType);
    
    res.json({
      success: true,
      data: {
        type,
        capabilities,
      },
    });
  } catch (error) {
    console.error('Get capabilities error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get capabilities',
    });
  }
});

export default router;
