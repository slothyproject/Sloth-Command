/**
 * AI Service
 * Multi-LLM AI Service with automatic failover
 * Uses Ollama (primary), OpenAI (fallback), Anthropic (backup)
 * Provides analysis, predictions, chat, and automation
 */

import { PrismaClient, Service, AIInsight } from '@prisma/client';
import llmRouter, { TaskComplexity, GenerateResult } from './llm-router';

const prisma = new PrismaClient();

// Re-export types for backward compatibility
interface AnalysisResult {
  insights: Array<{
    title: string;
    description: string;
    severity: 'critical' | 'warning' | 'suggestion' | 'info';
    category: 'performance' | 'security' | 'cost' | 'reliability';
    autoFixable: boolean;
    fixAction?: {
      type: string;
      parameters: Record<string, any>;
    };
  }>;
  summary: string;
  confidence: number;
  provider?: string; // Which LLM provider was used
  latency?: number; // Response time in ms
}

interface ParsedCommand {
  intent: string;
  action: string;
  service?: string;
  parameters: Record<string, any>;
  confidence: number;
}

interface AnalysisResult {
  insights: Array<{
    title: string;
    description: string;
    severity: 'critical' | 'warning' | 'suggestion' | 'info';
    category: 'performance' | 'security' | 'cost' | 'reliability';
    autoFixable: boolean;
    fixAction?: {
      type: string;
      parameters: Record<string, any>;
    };
  }>;
  summary: string;
  confidence: number;
}

interface ParsedCommand {
  intent: string;
  action: string;
  service?: string;
  parameters: Record<string, any>;
  confidence: number;
}

/**
 * Generate text using multi-LLM router with automatic failover
 * Primary: Ollama Cloud → OpenAI → Anthropic
 */
async function generateWithFallback(
  prompt: string,
  complexity: TaskComplexity = TaskComplexity.MODERATE,
  systemPrompt?: string,
  temperature: number = 0.7
): Promise<GenerateResult> {
  return llmRouter.generate(prompt, {
    complexity,
    systemPrompt,
    temperature,
    fallbackEnabled: true,
    trackUsage: true,
  });
}

/**
 * Analyze a service and generate insights
 */
export async function analyzeService(serviceId: string): Promise<AnalysisResult> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: {
      variables: true,
      deployments: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!service) {
    throw new Error(`Service ${serviceId} not found`);
  }

  // Gather recent metrics
  const recentMetrics = await prisma.metric.findMany({
    where: {
      serviceId,
      timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
    },
    orderBy: { timestamp: 'desc' },
  });

  // Calculate averages
  const cpuMetrics = recentMetrics.filter(m => m.metricType === 'cpu');
  const avgCpu = cpuMetrics.length > 0
    ? cpuMetrics.reduce((sum, m) => sum + m.value, 0) / cpuMetrics.length
    : service.cpuUsage || 0;

  const memoryMetrics = recentMetrics.filter(m => m.metricType === 'memory');
  const avgMemory = memoryMetrics.length > 0
    ? memoryMetrics.reduce((sum, m) => sum + m.value, 0) / memoryMetrics.length
    : service.memoryUsage || 0;

  // Build context for AI
  const context = `
Service: ${service.name}
Platform: ${service.platform}
Status: ${service.status}
CPU Usage: ${avgCpu.toFixed(1)}%
Memory Usage: ${avgMemory.toFixed(1)}%
Last Deploy: ${service.lastDeploy ? new Date(service.lastDeploy).toISOString() : 'Never'}

Recent Deployments:
${service.deployments.map(d => `- ${d.status} at ${new Date(d.createdAt).toISOString()}: ${d.error || 'OK'}`).join('\n')}

Environment Variables (${service.variables.length} total):
${service.variables.map(v => `- ${v.name}: ${v.isSecret ? '***' : v.value}`).join('\n')}

Configuration:
${JSON.stringify(service.config, null, 2)}
`;

  const systemPrompt = `You are an expert DevOps AI assistant analyzing a service. 
Provide actionable insights in JSON format with the following structure:
{
  "insights": [
    {
      "title": "Brief title",
      "description": "Detailed explanation",
      "severity": "critical|warning|suggestion|info",
      "category": "performance|security|cost|reliability",
      "autoFixable": true/false,
      "fixAction": { "type": "restart|updateVariable|scale|deploy", "parameters": {} }
    }
  ],
  "summary": "Overall assessment",
  "confidence": 0.0-1.0
}

Be thorough but practical. Only suggest auto-fixes for safe operations.`;

  try {
    // Use structured JSON generation via LLM router
    const schema = `{
      "insights": [
        {
          "title": "string",
          "description": "string",
          "severity": "critical|warning|suggestion|info",
          "category": "performance|security|cost|reliability",
          "autoFixable": "boolean",
          "fixAction": { "type": "string", "parameters": {} }
        }
      ],
      "summary": "string",
      "confidence": "number 0.0-1.0"
    }`;
    
    const result = await llmRouter.generateJSON<AnalysisResult>(
      `Analyze this service and provide insights:\n\n${context}`,
      schema,
      {
        complexity: TaskComplexity.COMPLEX,
        systemPrompt,
        temperature: 0.3,
      }
    );

    // Store insights in database
    for (const insight of result.insights) {
      await prisma.aIInsight.create({
        data: {
          serviceId,
          title: insight.title,
          description: insight.description,
          severity: insight.severity,
          category: insight.category,
          autoFixable: insight.autoFixable,
          fixAction: insight.fixAction || null,
          confidence: result.confidence,
          modelUsed: 'multi-llm-router', // Track that we used the router
        },
      });
    }

    // Update service last analyzed
    await prisma.service.update({
      where: { id: serviceId },
      data: { lastAnalyzed: new Date() },
    });

    return result;
  } catch (error) {
    console.error('Service analysis failed:', error);
    
    // Return fallback analysis
    return {
      insights: [{
        title: 'Analysis Failed',
        description: `Could not complete AI analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'info',
        category: 'reliability',
        autoFixable: false,
      }],
      summary: 'Analysis could not be completed due to an error.',
      confidence: 0,
    };
  }
}

/**
 * Predict potential issues before they happen
 */
export async function predictIssues(serviceId: string): Promise<AnalysisResult> {
  // Get historical metrics (last 7 days)
  const historicalMetrics = await prisma.metric.findMany({
    where: {
      serviceId,
      timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { timestamp: 'asc' },
  });

  if (historicalMetrics.length < 10) {
    return {
      insights: [{
        title: 'Insufficient Data',
        description: 'Need at least 7 days of metrics for prediction.',
        severity: 'info',
        category: 'reliability',
        autoFixable: false,
      }],
      summary: 'Not enough historical data for predictions.',
      confidence: 0,
    };
  }

  // Format metrics for AI
  const metricsData = historicalMetrics.map(m => ({
    type: m.metricType,
    value: m.value,
    timestamp: m.timestamp.toISOString(),
  }));

  const systemPrompt = `You are a predictive analytics AI. Based on historical metrics, predict potential issues.
Return JSON with predictions and their likelihood:
{
  "insights": [
    {
      "title": "Predicted issue",
      "description": "Why this might happen",
      "severity": "warning|suggestion",
      "category": "performance|reliability",
      "autoFixable": true/false,
      "fixAction": { "type": "...", "parameters": {} }
    }
  ],
  "summary": "Overall prediction summary",
  "confidence": 0.0-1.0
}`;

  try {
    const schema = `{
      "insights": [
        {
          "title": "string",
          "description": "string",
          "severity": "warning|suggestion",
          "category": "performance|reliability",
          "autoFixable": "boolean",
          "fixAction": { "type": "string", "parameters": {} }
        }
      ],
      "summary": "string",
      "confidence": "number 0.0-1.0"
    }`;
    
    return await llmRouter.generateJSON<AnalysisResult>(
      `Historical metrics for prediction:\n${JSON.stringify(metricsData.slice(-50), null, 2)}`,
      schema,
      {
        complexity: TaskComplexity.COMPLEX,
        systemPrompt,
        temperature: 0.4,
      }
    );
  } catch (error) {
    console.error('Prediction failed:', error);
    return {
      insights: [],
      summary: 'Prediction unavailable',
      confidence: 0,
    };
  }
}

/**
 * Chat with AI assistant
 */
export async function chat(
  message: string,
  context?: { serviceId?: string; sessionId?: string; userId?: string }
): Promise<{ response: string; actions?: string[] }> {
  // Load conversation history if session exists
  let history: string[] = [];
  if (context?.sessionId) {
    const conversations = await prisma.aIConversation.findMany({
      where: { sessionId: context.sessionId },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });
    history = conversations.map(c => `${c.role}: ${c.content}`);
  }

  // Get service context if specified
  let serviceContext = '';
  if (context?.serviceId) {
    const service = await prisma.service.findUnique({
      where: { id: context.serviceId },
    });
    if (service) {
      serviceContext = `\nCurrent Service Context:\nName: ${service.name}\nStatus: ${service.status}\nPlatform: ${service.platform}\n`;
    }
  }

  const systemPrompt = `You are Central Hub AI, an intelligent DevOps assistant. You help manage Railway services, Discord bots, and websites.

Available Actions:
- restart [service]: Restart a service
- deploy [service]: Deploy latest version
- scale [service] [count]: Scale service instances
- update [service] [variable] [value]: Update environment variable
- analyze [service]: Analyze service health
- status: Show overall system status

Respond conversationally but professionally. If the user wants to perform an action, indicate it clearly.`;

  const fullPrompt = `${history.join('\n')}${serviceContext}\nUser: ${message}\nAssistant:`;

  try {
    const result = await llmRouter.generate(
      fullPrompt,
      {
        complexity: TaskComplexity.SIMPLE,
        systemPrompt,
        temperature: 0.8,
      }
    );
    
    const response = result.response;

    // Store conversation
    if (context?.sessionId) {
      await prisma.aIConversation.createMany({
        data: [
          {
            sessionId: context.sessionId,
            role: 'user',
            content: message,
            serviceId: context.serviceId,
            userId: context.userId,
          },
          {
            sessionId: context.sessionId,
            role: 'assistant',
            content: response,
            serviceId: context.serviceId,
            userId: context.userId,
          },
        ],
      });
    }

    // Parse actions from response
    const actions: string[] = [];
    const actionMatches = response.match(/\b(restart|deploy|scale|update|analyze)\s+[\w-]+/gi);
    if (actionMatches) {
      actions.push(...actionMatches);
    }

    return { response, actions };
  } catch (error) {
    console.error('Chat failed:', error);
    return {
      response: 'I apologize, but I am unable to process your request at the moment. Please try again later.',
      actions: [],
    };
  }
}

/**
 * Parse natural language command into structured action
 */
export async function parseCommand(naturalCommand: string): Promise<ParsedCommand> {
  const systemPrompt = `Parse the natural language command into a structured action.
Return ONLY JSON in this exact format:
{
  "intent": "restart|deploy|scale|update|analyze|status|help|unknown",
  "action": "specific action description",
  "service": "service name or null",
  "parameters": { "key": "value" },
  "confidence": 0.0-1.0
}

Examples:
- "restart the discord bot" → {"intent": "restart", "action": "restart", "service": "discord", "parameters": {}, "confidence": 0.95}
- "scale website to 3 instances" → {"intent": "scale", "action": "scale", "service": "website", "parameters": {"replicas": 3}, "confidence": 0.9}
- "what's wrong with api" → {"intent": "analyze", "action": "analyze", "service": "api", "parameters": {}, "confidence": 0.85}
- "deploy token vault" → {"intent": "deploy", "action": "deploy", "service": "token-vault", "parameters": {}, "confidence": 0.9}`;

  try {
    const schema = `{
      "intent": "restart|deploy|scale|update|analyze|status|help|unknown",
      "action": "string",
      "service": "string or null",
      "parameters": {},
      "confidence": "number 0.0-1.0"
    }`;
    
    return await llmRouter.generateJSON<ParsedCommand>(
      `Parse this command: "${naturalCommand}"`,
      schema,
      {
        complexity: TaskComplexity.SIMPLE,
        systemPrompt,
        temperature: 0.2,
      }
    );
  } catch (error) {
    console.error('Command parsing failed:', error);
    return {
      intent: 'unknown',
      action: 'unknown',
      service: null,
      parameters: {},
      confidence: 0,
    };
  }
}

/**
 * Generate fix for an issue
 */
export async function generateFix(
  serviceId: string,
  issue: AIInsight
): Promise<{ fix: string; action: any; safe: boolean }> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { variables: true },
  });

  if (!service) {
    throw new Error('Service not found');
  }

  const context = `
Service: ${service.name}
Issue: ${issue.title}
Description: ${issue.description}
Severity: ${issue.severity}
Current Status: ${service.status}
Variables: ${service.variables.map(v => v.name).join(', ')}
`;

  const systemPrompt = `Generate a fix for this issue. Return JSON:
{
  "fix": "Description of what to do",
  "action": { "type": "restart|updateVariable|scale|deploy", "parameters": {} },
  "safe": true/false
}

A fix is SAFE if it's a restart, environment variable update, or scaling operation.
A fix is UNSAFE if it involves data deletion, major config changes, or downtime.`;

  try {
    const schema = `{
      "fix": "string",
      "action": { "type": "string", "parameters": {} },
      "safe": "boolean"
    }`;
    
    return await llmRouter.generateJSON<{ fix: string; action: any; safe: boolean }>(
      `Generate fix for:\n${context}`,
      schema,
      {
        complexity: TaskComplexity.MODERATE,
        systemPrompt,
        temperature: 0.3,
      }
    );
  } catch (error) {
    console.error('Fix generation failed:', error);
    return {
      fix: 'Unable to generate automatic fix',
      action: null,
      safe: false,
    };
  }
}

/**
 * Get AI insights for a service
 */
export async function getInsights(serviceId: string): Promise<AIInsight[]> {
  return prisma.aIInsight.findMany({
    where: { serviceId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

/**
 * Execute AI-suggested fix
 */
export async function executeFix(insightId: string): Promise<boolean> {
  const insight = await prisma.aIInsight.findUnique({
    where: { id: insightId },
  });

  if (!insight || !insight.autoFixable || insight.fixed) {
    return false;
  }

  // TODO: This will be implemented in the auto-fix agent
  // For now, just mark as fixed
  await prisma.aIInsight.update({
    where: { id: insightId },
    data: {
      fixed: true,
      fixedAt: new Date(),
      fixedBy: 'ai-agent',
    },
  });

  return true;
}

// Export service functions
export const aiService = {
  analyzeService,
  predictIssues,
  chat,
  parseCommand,
  generateFix,
  getInsights,
  executeFix,
};

// Re-export LLM router utilities for external use
export { llmRouter, TaskComplexity };
export type { GenerateResult as LLMGenerateResult } from './llm-router';

export default aiService;
