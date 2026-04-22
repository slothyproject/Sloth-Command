/**
 * AI API Routes
 * /api/ai/*
 */

import { Router } from 'express';
import aiService from '../services/ai';
import autoFixAgent from '../agents/auto-fix';
import { authenticateToken } from '../middleware/auth';
import {
  deleteUserProviderConfig,
  getUserProviderStatuses,
  saveUserProviderConfig,
  type SupportedAIProvider,
} from '../services/ai-provider-config';

const router = Router();

router.use(authenticateToken);

const SUPPORTED_PROVIDERS: SupportedAIProvider[] = ['ollama', 'openai', 'anthropic'];

function isSupportedProvider(value: unknown): value is SupportedAIProvider {
  return typeof value === 'string' && SUPPORTED_PROVIDERS.includes(value as SupportedAIProvider);
}

router.get('/providers', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const providers = await getUserProviderStatuses(userId);
    res.json({ success: true, data: providers });
  } catch (error) {
    console.error('Get AI providers error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get provider configs',
    });
  }
});

router.post('/providers', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { provider, apiKey, baseUrl, model, enabled = true } = req.body;

    if (!isSupportedProvider(provider)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported provider. Expected one of: ${SUPPORTED_PROVIDERS.join(', ')}`,
      });
    }

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'apiKey is required',
      });
    }

    await saveUserProviderConfig(userId, {
      provider,
      apiKey,
      baseUrl,
      model,
      enabled: !!enabled,
    });

    res.json({
      success: true,
      message: `${provider} provider configuration saved`,
    });
  } catch (error) {
    console.error('Save AI provider error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save provider config',
    });
  }
});

router.delete('/providers/:provider', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { provider } = req.params;
    if (!isSupportedProvider(provider)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported provider. Expected one of: ${SUPPORTED_PROVIDERS.join(', ')}`,
      });
    }

    await deleteUserProviderConfig(userId, provider);
    res.json({ success: true, message: `${provider} provider config removed` });
  } catch (error) {
    console.error('Delete AI provider error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete provider config',
    });
  }
});

/**
 * POST /api/ai/analyze/:serviceId
 * Analyze a service and generate insights
 */
router.post('/analyze/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const userId = req.user?.id;
    const analysis = await aiService.analyzeService(serviceId, userId);
    
    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('AI analyze error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
    });
  }
});

/**
 * POST /api/ai/predict/:serviceId
 * Predict potential issues for a service
 */
router.post('/predict/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const userId = req.user?.id;
    const { hours = 24 } = req.query;
    
    const prediction = await aiService.predictIssues(serviceId, userId);
    
    res.json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    console.error('AI predict error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Prediction failed',
    });
  }
});

/**
 * GET /api/ai/insights/:serviceId
 * Get AI insights for a service
 */
router.get('/insights/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const insights = await aiService.getInsights(serviceId);
    
    res.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    console.error('Get insights error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get insights',
    });
  }
});

/**
 * POST /api/ai/chat
 * Chat with AI assistant
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId, serviceId } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
      });
    }

    const response = await aiService.chat(message, {
      sessionId,
      serviceId,
      userId: req.user?.id,
    });
    
    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Chat failed',
    });
  }
});

/**
 * POST /api/ai/execute
 * Execute natural language command
 */
router.post('/execute', async (req, res) => {
  try {
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({
        success: false,
        error: 'Command is required',
      });
    }

    // Parse the command
    const parsed = await aiService.parseCommand(command, req.user?.id);
    
    // TODO: Execute the parsed command
    // This would call the appropriate service based on intent
    
    res.json({
      success: true,
      data: {
        parsed,
        executed: false, // Set to true when command is executed
        result: null,
      },
    });
  } catch (error) {
    console.error('AI execute error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Command execution failed',
    });
  }
});

/**
 * POST /api/ai/fix/:insightId
 * Apply AI-suggested fix
 */
router.post('/fix/:insightId', async (req, res) => {
  try {
    const { insightId } = req.params;
    
    const result = await autoFixAgent.approveFix(insightId);
    
    res.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    console.error('AI fix error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Fix failed',
    });
  }
});

/**
 * GET /api/ai/pending-approvals
 * Get pending fixes requiring approval
 */
router.get('/pending-approvals', async (req, res) => {
  try {
    const pending = await autoFixAgent.getPendingApprovals();
    
    res.json({
      success: true,
      data: pending,
    });
  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get approvals',
    });
  }
});

/**
 * GET /api/ai/fix-history
 * Get fix history
 */
router.get('/fix-history', async (req, res) => {
  try {
    const { serviceId } = req.query;
    const history = await autoFixAgent.getFixHistory(serviceId as string);
    
    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Get fix history error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get history',
    });
  }
});

export default router;
