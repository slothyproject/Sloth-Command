/**
 * AI API Routes
 * /api/ai/*
 */

import { Router } from 'express';
import aiService from '../services/ai';
import autoFixAgent from '../agents/auto-fix';

const router = Router();

/**
 * POST /api/ai/analyze/:serviceId
 * Analyze a service and generate insights
 */
router.post('/analyze/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const analysis = await aiService.analyzeService(serviceId);
    
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
    const { hours = 24 } = req.query;
    
    const prediction = await aiService.predictIssues(serviceId);
    
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
      userId: (req as any).user?.id, // If authenticated
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
    const parsed = await aiService.parseCommand(command);
    
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
