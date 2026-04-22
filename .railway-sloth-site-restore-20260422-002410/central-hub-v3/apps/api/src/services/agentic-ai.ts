/**
 * Agentic AI Service
 * Multi-step planning and execution system for autonomous operations
 * Supports goal decomposition, step-by-step execution, and adaptive replanning
 */

import { generate, generateJSON, TaskComplexity } from './llm-router';
import { getQueue } from './queue';
import knowledgeGraph from './knowledge-graph';
import { redis } from './redis';

// Agent types for different specializations
export enum AgentType {
  INFRASTRUCTURE = 'infrastructure',  // Manages deployments, scaling
  MONITORING = 'monitoring',         // Handles alerts, diagnostics
  SECURITY = 'security',               // Vulnerability scanning, patches
  OPTIMIZATION = 'optimization',       // Cost, performance optimization
  DISCORD_SETUP = 'discord_setup',    // Discord server configuration and setup
  GENERAL = 'general',                 // Multi-purpose agent
}

// Task execution status
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// Step types in an agent plan
interface AgentStep {
  id: string;
  order: number;
  description: string;
  type: 'analysis' | 'action' | 'decision' | 'verification';
  dependencies: string[];
  status: TaskStatus;
  result?: any;
  error?: string;
  executedAt?: Date;
  completedAt?: Date;
}

// Agent execution plan
interface AgentPlan {
  id: string;
  goal: string;
  agentType: AgentType;
  steps: AgentStep[];
  status: TaskStatus;
  context: Record<string, any>;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata: {
    estimatedSteps: number;
    estimatedDuration: number; // minutes
    priority: number;
    requiresApproval: boolean;
  };
}

// Execution context passed between steps
interface ExecutionContext {
  planId: string;
  currentStep: number;
  variables: Record<string, any>;
  results: Record<string, any>;
  history: Array<{
    stepId: string;
    action: string;
    result: any;
    timestamp: Date;
  }>;
}

// Agent configuration
interface AgentConfig {
  type: AgentType;
  name: string;
  description: string;
  systemPrompt: string;
  capabilities: string[];
  maxConcurrentTasks: number;
  autoApprove: boolean; // Can skip human approval for certain actions
}

// Agent registry
const AGENTS: Record<AgentType, AgentConfig> = {
  [AgentType.INFRASTRUCTURE]: {
    type: AgentType.INFRASTRUCTURE,
    name: 'Infrastructure Agent',
    description: 'Manages deployments, scaling, and infrastructure operations',
    systemPrompt: `You are an expert Infrastructure Agent. Your role is to manage cloud infrastructure, deployments, and scaling operations.

CAPABILITIES:
- Deploy services and manage rollouts
- Scale services up/down based on demand
- Manage service restarts and health checks
- Analyze infrastructure topology and dependencies
- Optimize resource allocation

RULES:
- Always check dependencies before making changes
- Verify services are healthy after operations
- Rollback on failure when possible
- Never delete data without explicit confirmation`,
    capabilities: [
      'deploy_service',
      'scale_service',
      'restart_service',
      'check_health',
      'analyze_dependencies',
      'optimize_resources',
    ],
    maxConcurrentTasks: 5,
    autoApprove: false,
  },
  [AgentType.MONITORING]: {
    type: AgentType.MONITORING,
    name: 'Monitoring Agent',
    description: 'Handles alerts, diagnostics, and incident response',
    systemPrompt: `You are an expert Monitoring Agent. Your role is to monitor system health, diagnose issues, and coordinate incident response.

CAPABILITIES:
- Analyze alerts and correlate events
- Run diagnostics and health checks
- Generate incident reports
- Recommend remediation actions
- Track service metrics and trends

RULES:
- Always verify the severity of alerts
- Check related services for cascade effects
- Document all findings clearly
- Escalate critical issues immediately`,
    capabilities: [
      'analyze_alert',
      'run_diagnostics',
      'check_metrics',
      'correlate_events',
      'generate_report',
      'recommend_action',
    ],
    maxConcurrentTasks: 10,
    autoApprove: true,
  },
  [AgentType.SECURITY]: {
    type: AgentType.SECURITY,
    name: 'Security Agent',
    description: 'Handles vulnerability scanning, patching, and security compliance',
    systemPrompt: `You are an expert Security Agent. Your role is to maintain security posture through scanning, patching, and compliance checks.

CAPABILITIES:
- Scan for vulnerabilities
- Apply security patches
- Check compliance status
- Analyze security configurations
- Generate security reports

RULES:
- Never skip backup before applying patches
- Test patches in staging when available
- Document all security changes
- Report critical vulnerabilities immediately`,
    capabilities: [
      'scan_vulnerabilities',
      'apply_patch',
      'check_compliance',
      'analyze_config',
      'generate_report',
      'quarantine_service',
    ],
    maxConcurrentTasks: 3,
    autoApprove: false,
  },
  [AgentType.OPTIMIZATION]: {
    type: AgentType.OPTIMIZATION,
    name: 'Optimization Agent',
    description: 'Optimizes costs, performance, and resource utilization',
    systemPrompt: `You are an expert Optimization Agent. Your role is to analyze and optimize costs, performance, and resource utilization.

CAPABILITIES:
- Analyze cost trends and spending
- Optimize resource allocation
- Identify performance bottlenecks
- Recommend right-sizing
- Generate optimization reports

RULES:
- Always provide cost/benefit analysis
- Consider performance impact of changes
- Test optimizations before production
- Monitor results after optimization`,
    capabilities: [
      'analyze_costs',
      'optimize_resources',
      'identify_bottlenecks',
      'recommend_sizing',
      'generate_report',
      'implement_changes',
    ],
    maxConcurrentTasks: 2,
    autoApprove: true,
  },
  [AgentType.DISCORD_SETUP]: {
    type: AgentType.DISCORD_SETUP,
    name: 'Discord Setup Agent',
    description: 'Configures and sets up Discord servers with opinionated best practices',
    systemPrompt: `You are an expert Discord Setup Agent. Your role is to help users configure Discord servers with best practices for different use cases.

DISCORD KNOWLEDGE:
- Role hierarchy and permissions
- Channel types: text, voice, stage, forum, announcement
- Permission overwrites and inheritance
- Bot permissions and scopes
- Moderation tools: automod, timeouts, kicks, bans
- Leveling systems and engagement
- Welcome flows and onboarding

CAPABILITIES:
- Create roles (admin, moderator, member, bot roles)
- Create channels (categories, text, voice, forums)
- Configure channel permissions and overwrites
- Setup moderation policies (warnings, mutes, bans)
- Configure welcome messages and member onboarding
- Setup leveling and XP systems
- Create ticket/support channels
- Setup auto-responders and commands
- Configure logging and audit channels

SETUP TEMPLATES:
1. COMMUNITY: Public community server with general chat, voice, forums
2. SUPPORT: Customer support with ticket system and specialized channels
3. CREATOR: Content creator community with tier roles and exclusive channels
4. GAMING: Gaming clan/community with voice channels, game-specific categories
5. PRIVATE: Private ops/staff server with restricted access
6. HYBRID: Mix of public and private areas with access tiers

RULES:
- Always suggest a template first based on use case
- Preview all changes before execution
- Create roles in safe order: admin → moderator → user roles
- Apply permissions from top to bottom in channel hierarchy
- Never grant admin permissions except to authorized roles
- Log all configuration changes
- Provide rollback metadata for each step
- Confirm with user before applying irreversible changes`,
    capabilities: [
      'suggest_template',
      'create_role',
      'create_channel',
      'configure_permissions',
      'setup_moderation',
      'setup_welcome',
      'setup_leveling',
      'create_tickets',
      'setup_autoresponse',
      'configure_logging',
      'preview_changes',
      'generate_summary',
    ],
    maxConcurrentTasks: 3,
    autoApprove: false,
  },
  [AgentType.GENERAL]: {
    type: AgentType.GENERAL,
    name: 'General Agent',
    description: 'Multi-purpose agent for general tasks and queries',
    systemPrompt: `You are a versatile General Agent capable of handling a wide range of infrastructure and operations tasks.

CAPABILITIES:
- Answer questions about infrastructure
- Provide recommendations
- Coordinate between specialized agents
- Execute simple operations
- Generate reports and summaries

RULES:
- Be concise but thorough
- Escalate to specialized agents when needed
- Always verify before destructive operations
- Provide clear actionable output`,
    capabilities: [
      'answer_question',
      'provide_recommendation',
      'coordinate_agents',
      'execute_simple',
      'generate_report',
    ],
    maxConcurrentTasks: 10,
    autoApprove: true,
  },
};

// Redis keys
const REDIS_KEYS = {
  PLAN_PREFIX: 'agent:plan:',
  EXECUTION_PREFIX: 'agent:exec:',
  QUEUE_PREFIX: 'agent:queue:',
};

/**
 * Determine which agent type is best suited for a goal
 */
export async function selectAgent(goal: string): Promise<AgentType> {
  const lowerGoal = goal.toLowerCase();
  
  // Check for Discord setup keywords
  if (lowerGoal.match(/discord|setup|configure|server|channel|role|moderation|welcome|leveling|ticket/)) {
    return AgentType.DISCORD_SETUP;
  }
  
  // Check for infrastructure keywords
  if (lowerGoal.match(/deploy|scale|restart|infrastructure|rollout/)) {
    return AgentType.INFRASTRUCTURE;
  }
  
  // Check for monitoring keywords
  if (lowerGoal.match(/alert|monitor|diagnos|incident|health|metric/)) {
    return AgentType.MONITORING;
  }
  
  // Check for security keywords
  if (lowerGoal.match(/secur|vulnerab|patch|compliance|scan/)) {
    return AgentType.SECURITY;
  }
  
  // Check for optimization keywords
  if (lowerGoal.match(/optim|cost|performance|bottleneck|utilization/)) {
    return AgentType.OPTIMIZATION;
  }
  
  return AgentType.GENERAL;
}

/**
 * Create an execution plan for a goal
 */
export async function createPlan(
  goal: string,
  agentType: AgentType = AgentType.GENERAL,
  context: Record<string, any> = {}
): Promise<AgentPlan> {
  const agent = AGENTS[agentType];
  
  // Use LLM to generate a structured plan
  const planPrompt = `Create a detailed execution plan for this goal:

GOAL: ${goal}

AGENT TYPE: ${agent.type}
AGENT CAPABILITIES: ${agent.capabilities.join(', ')}

CONTEXT: ${JSON.stringify(context, null, 2)}

Create a step-by-step plan where each step has:
1. A clear description of what to do
2. The step type (analysis, action, decision, verification)
3. Dependencies on previous steps (if any)

Respond with a JSON object matching this schema:
{
  "estimatedSteps": number,
  "estimatedDuration": number (minutes),
  "priority": number (1-10),
  "requiresApproval": boolean,
  "steps": [
    {
      "order": number,
      "description": "string",
      "type": "analysis|action|decision|verification",
      "dependencies": ["step_order_numbers"]
    }
  ]
}`;

  const planSchema = `{
    "estimatedSteps": "number",
    "estimatedDuration": "number",
    "priority": "number",
    "requiresApproval": "boolean",
    "steps": [
      {
        "order": "number",
        "description": "string",
        "type": "string (analysis|action|decision|verification)",
        "dependencies": ["number"]
      }
    ]
  }`;

  const planData = await generateJSON<{
    estimatedSteps: number;
    estimatedDuration: number;
    priority: number;
    requiresApproval: boolean;
    steps: Array<{
      order: number;
      description: string;
      type: string;
      dependencies: number[];
    }>;
  }>(planPrompt, planSchema, {
    systemPrompt: agent.systemPrompt,
    complexity: TaskComplexity.COMPLEX,
  });

  // Create the plan object
  const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const steps: AgentStep[] = planData.steps.map((step) => ({
    id: `step_${planId}_${step.order}`,
    order: step.order,
    description: step.description,
    type: step.type as AgentStep['type'],
    dependencies: step.dependencies.map((dep) => `step_${planId}_${dep}`),
    status: TaskStatus.PENDING,
  }));

  const plan: AgentPlan = {
    id: planId,
    goal,
    agentType,
    steps,
    status: TaskStatus.PENDING,
    context,
    createdAt: new Date(),
    metadata: {
      estimatedSteps: planData.estimatedSteps,
      estimatedDuration: planData.estimatedDuration,
      priority: planData.priority,
      requiresApproval: planData.requiresApproval,
    },
  };

  // Store in Redis
  await redis.setex(
    `${REDIS_KEYS.PLAN_PREFIX}${planId}`,
    86400, // 24 hours TTL
    JSON.stringify(plan)
  );

  console.log(`🤖 Created ${agentType} agent plan: ${planId} (${steps.length} steps)`);
  
  return plan;
}

/**
 * Execute a plan step by step
 */
export async function executePlan(planId: string): Promise<AgentPlan> {
  // Load plan from Redis
  const planData = await redis.get(`${REDIS_KEYS.PLAN_PREFIX}${planId}`);
  if (!planData) {
    throw new Error(`Plan not found: ${planId}`);
  }

  const plan: AgentPlan = JSON.parse(planData);
  const agent = AGENTS[plan.agentType];

  if (plan.status === TaskStatus.COMPLETED || plan.status === TaskStatus.FAILED) {
    return plan;
  }

  // Update plan status
  plan.status = TaskStatus.IN_PROGRESS;
  plan.startedAt = new Date();

  // Initialize execution context
  const executionContext: ExecutionContext = {
    planId,
    currentStep: 0,
    variables: { ...plan.context },
    results: {},
    history: [],
  };

  // Execute steps in order
  for (const step of plan.steps) {
    if (step.status === TaskStatus.COMPLETED || step.status === TaskStatus.CANCELLED) {
      continue;
    }

    // Check if dependencies are met
    const dependenciesMet = step.dependencies.every((depId) => {
      const depStep = plan.steps.find((s) => s.id === depId);
      return depStep?.status === TaskStatus.COMPLETED;
    });

    if (!dependenciesMet) {
      step.status = TaskStatus.PENDING;
      continue;
    }

    try {
      // Execute the step
      console.log(`🔄 Executing step ${step.order}: ${step.description}`);
      step.status = TaskStatus.IN_PROGRESS;
      step.executedAt = new Date();

      const result = await executeStep(step, executionContext, agent);

      // Update step with result
      step.result = result;
      step.status = TaskStatus.COMPLETED;
      step.completedAt = new Date();

      // Update execution context
      executionContext.results[step.id] = result;
      executionContext.history.push({
        stepId: step.id,
        action: step.description,
        result,
        timestamp: new Date(),
      });

      console.log(`✅ Step ${step.order} completed: ${step.description}`);
    } catch (error) {
      step.status = TaskStatus.FAILED;
      step.error = error instanceof Error ? error.message : String(error);
      
      console.error(`❌ Step ${step.order} failed: ${step.error}`);

      // Decide whether to continue or abort
      if (step.type === 'action' || step.type === 'decision') {
        plan.status = TaskStatus.FAILED;
        break;
      }
    }
  }

  // Update plan completion status
  const allCompleted = plan.steps.every((s) => s.status === TaskStatus.COMPLETED);
  const anyFailed = plan.steps.some((s) => s.status === TaskStatus.FAILED);

  if (allCompleted) {
    plan.status = TaskStatus.COMPLETED;
    plan.completedAt = new Date();
    console.log(`🎉 Plan ${planId} completed successfully`);
  } else if (anyFailed) {
    plan.status = TaskStatus.FAILED;
    plan.completedAt = new Date();
    console.log(`⚠️ Plan ${planId} failed`);
  }

  // Save updated plan
  await redis.setex(
    `${REDIS_KEYS.PLAN_PREFIX}${planId}`,
    86400,
    JSON.stringify(plan)
  );

  return plan;
}

/**
 * Execute a single step
 */
async function executeStep(
  step: AgentStep,
  context: ExecutionContext,
  agent: AgentConfig
): Promise<any> {
  const stepPrompt = `Execute this step:

STEP: ${step.description}
TYPE: ${step.type}

EXECUTION CONTEXT:
${JSON.stringify(context, null, 2)}

AVAILABLE CAPABILITIES: ${agent.capabilities.join(', ')}

Based on the step type and context, determine what action to take and provide the result.
For 'action' steps, specify the exact action to perform.
For 'analysis' steps, provide detailed findings.
For 'decision' steps, make a clear recommendation.
For 'verification' steps, confirm success or identify issues.

Respond with a JSON object:
{
  "action": "string (the action taken)",
  "result": "any (the result or output)",
  "nextSteps": ["string"] (optional follow-up actions)
}`;

  const resultSchema = `{
    "action": "string",
    "result": "any",
    "nextSteps": ["string"]
  }`;

  const response = await generateJSON<{
    action: string;
    result: any;
    nextSteps?: string[];
  }>(stepPrompt, resultSchema, {
    systemPrompt: agent.systemPrompt,
    complexity: TaskComplexity.MODERATE,
  });

  return response;
}

/**
 * Queue a plan for async execution
 */
export async function queuePlanExecution(planId: string): Promise<void> {
  const queue = getQueue('agent-execution');
  
  await queue.add(
    'execute-plan',
    { planId },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    }
  );

  console.log(`📋 Queued plan ${planId} for execution`);
}

/**
 * Get plan by ID
 */
export async function getPlan(planId: string): Promise<AgentPlan | null> {
  const planData = await redis.get(`${REDIS_KEYS.PLAN_PREFIX}${planId}`);
  if (!planData) return null;
  return JSON.parse(planData);
}

/**
 * Get all active plans
 */
export async function getActivePlans(): Promise<AgentPlan[]> {
  const keys = await redis.keys(`${REDIS_KEYS.PLAN_PREFIX}*`);
  const plans: AgentPlan[] = [];

  for (const key of keys) {
    const planData = await redis.get(key);
    if (planData) {
      const plan: AgentPlan = JSON.parse(planData);
      if (plan.status === TaskStatus.PENDING || plan.status === TaskStatus.IN_PROGRESS) {
        plans.push(plan);
      }
    }
  }

  return plans.sort((a, b) => {
    // Sort by priority (high first), then by creation time (newest first)
    const priorityDiff = b.metadata.priority - a.metadata.priority;
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Cancel a plan
 */
export async function cancelPlan(planId: string): Promise<boolean> {
  const plan = await getPlan(planId);
  if (!plan) return false;

  plan.status = TaskStatus.CANCELLED;
  plan.completedAt = new Date();

  // Mark remaining steps as cancelled
  for (const step of plan.steps) {
    if (step.status === TaskStatus.PENDING || step.status === TaskStatus.IN_PROGRESS) {
      step.status = TaskStatus.CANCELLED;
    }
  }

  await redis.setex(
    `${REDIS_KEYS.PLAN_PREFIX}${planId}`,
    86400,
    JSON.stringify(plan)
  );

  console.log(`🚫 Plan ${planId} cancelled`);
  return true;
}

/**
 * Replan - adjust plan based on new information
 */
export async function replan(
  planId: string,
  adjustmentReason: string
): Promise<AgentPlan> {
  const plan = await getPlan(planId);
  if (!plan) throw new Error(`Plan not found: ${planId}`);

  const agent = AGENTS[plan.agentType];

  const replanPrompt = `Adjust this plan based on new information:

ORIGINAL GOAL: ${plan.goal}
CURRENT PLAN STEPS:
${JSON.stringify(plan.steps, null, 2)}

COMPLETED STEPS AND RESULTS:
${JSON.stringify(
    plan.steps
      .filter((s) => s.status === TaskStatus.COMPLETED)
      .map((s) => ({ order: s.order, result: s.result })),
    null,
    2
  )}

REASON FOR ADJUSTMENT: ${adjustmentReason}

Create a revised plan. Keep completed steps as-is, and adjust remaining or add new steps.

Respond with a JSON object in the same format as the original plan.`;

  // For simplicity, we'll just add a new step to handle the adjustment
  // In a full implementation, this would use LLM to completely replan
  const newStep: AgentStep = {
    id: `step_${planId}_adjustment`,
    order: plan.steps.length + 1,
    description: `Handle adjustment: ${adjustmentReason}`,
    type: 'action',
    dependencies: plan.steps
      .filter((s) => s.status === TaskStatus.COMPLETED)
      .map((s) => s.id),
    status: TaskStatus.PENDING,
  };

  plan.steps.push(newStep);

  await redis.setex(
    `${REDIS_KEYS.PLAN_PREFIX}${planId}`,
    86400,
    JSON.stringify(plan)
  );

  console.log(`📝 Plan ${planId} replanned: ${adjustmentReason}`);
  return plan;
}

/**
 * Get agent capabilities
 */
export function getAgentCapabilities(agentType: AgentType): string[] {
  return AGENTS[agentType].capabilities;
}

/**
 * Get all available agents
 */
export function getAvailableAgents(): Array<{
  type: AgentType;
  name: string;
  description: string;
  capabilities: string[];
}> {
  return Object.values(AGENTS).map((agent) => ({
    type: agent.type,
    name: agent.name,
    description: agent.description,
    capabilities: agent.capabilities,
  }));
}

/**
 * Process a natural language request and execute it
 */
export async function processRequest(
  request: string,
  context: Record<string, any> = {}
): Promise<{
  planId: string;
  agentType: AgentType;
  status: TaskStatus;
  summary: string;
}> {
  // Select appropriate agent
  const agentType = await selectAgent(request);
  
  // Create execution plan
  const plan = await createPlan(request, agentType, context);
  
  // Queue for execution (or execute immediately if auto-approved)
  const agent = AGENTS[agentType];
  if (agent.autoApprove && !plan.metadata.requiresApproval) {
    // Execute immediately
    await executePlan(plan.id);
  } else {
    // Queue for async execution with potential human approval
    await queuePlanExecution(plan.id);
  }

  const executedPlan = await getPlan(plan.id);

  return {
    planId: plan.id,
    agentType,
    status: executedPlan?.status || TaskStatus.PENDING,
    summary: `Created ${agentType} agent plan with ${plan.steps.length} steps. ${
      agent.autoApprove && !plan.metadata.requiresApproval
        ? 'Executed automatically.'
        : 'Queued for execution (approval may be required).'
    }`,
  };
}

/**
 * Approve a plan for execution (human-in-the-loop)
 */
export async function approvePlan(
  planId: string,
  approved: boolean
): Promise<AgentPlan> {
  const plan = await getPlan(planId);
  if (!plan) throw new Error(`Plan not found: ${planId}`);

  if (approved) {
    plan.metadata.requiresApproval = false;
    await redis.setex(
      `${REDIS_KEYS.PLAN_PREFIX}${planId}`,
      86400,
      JSON.stringify(plan)
    );
    await queuePlanExecution(planId);
    console.log(`✅ Plan ${planId} approved for execution`);
  } else {
    await cancelPlan(planId);
    console.log(`❌ Plan ${planId} rejected`);
  }

  return plan;
}

export default {
  selectAgent,
  createPlan,
  executePlan,
  queuePlanExecution,
  getPlan,
  getActivePlans,
  cancelPlan,
  replan,
  getAgentCapabilities,
  getAvailableAgents,
  processRequest,
  approvePlan,
  AgentType,
  TaskStatus,
};
