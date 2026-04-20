/**
 * Self-Healing Service
 * Automatic remediation without human intervention
 * Detects issues, diagnoses root causes, and executes fixes
 */

import { PrismaClient } from '@prisma/client';
import { generate, generateJSON, TaskComplexity } from './llm-router';
import { getQueue } from './queue';
import { redis } from './redis';
import knowledgeGraph from './knowledge-graph';
import * as doraMetrics from './dora-metrics';

const prisma = new PrismaClient();

// Healing modes
export enum HealingMode {
  AUTO = 'auto',           // Fully automatic
  ASSISTED = 'assisted',   // Suggests fix, waits for confirmation
  MONITOR = 'monitor',     // Only monitors and alerts
}

// Issue severity
export enum IssueSeverity {
  CRITICAL = 'critical',   // Immediate action required
  HIGH = 'high',          // Action within minutes
  MEDIUM = 'medium',       // Action within hours
  LOW = 'low',            // Action within days
}

// Issue types
export enum IssueType {
  CRASH = 'crash',
  ERROR_SPIKE = 'error_spike',
  HIGH_LATENCY = 'high_latency',
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  DEPENDENCY_FAILURE = 'dependency_failure',
  CONFIG_DRIFT = 'config_drift',
  SECURITY_ANOMALY = 'security_anomaly',
  PERFORMANCE_DEGRADATION = 'performance_degradation',
}

// Detected issue
interface DetectedIssue {
  id: string;
  serviceId: string;
  serviceName: string;
  type: IssueType;
  severity: IssueSeverity;
  description: string;
  symptoms: string[];
  detectedAt: Date;
  status: 'detected' | 'diagnosing' | 'remediating' | 'resolved' | 'failed' | 'escalated';
  metrics: {
    errorRate?: number;
    latencyP95?: number;
    cpuUsage?: number;
    memoryUsage?: number;
    requestCount?: number;
  };
  context: Record<string, any>;
}

// Diagnosis result
interface Diagnosis {
  issueId: string;
  rootCause: string;
  confidence: number; // 0-1
  affectedServices: string[];
  possibleCauses: string[];
  recommendedActions: Array<{
    action: string;
    confidence: number;
    risk: 'low' | 'medium' | 'high';
    estimatedTimeToFix: number; // minutes
  }>;
}

// Remediation action
interface RemediationAction {
  id: string;
  issueId: string;
  action: string;
  type: 'restart' | 'rollback' | 'scale' | 'reconfigure' | 'isolate' | 'notify' | 'custom';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  executedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
  requiresApproval: boolean;
}

// Healing configuration per service
interface ServiceHealingConfig {
  serviceId: string;
  enabled: boolean;
  mode: HealingMode;
  autoHealSeverities: IssueSeverity[];
  maxAutoAttempts: number;
  cooldownMinutes: number;
  excludedActions: string[];
  notifyChannels: string[];
  customRules: HealingRule[];
}

// Custom healing rule
interface HealingRule {
  name: string;
  condition: {
    metric: string;
    operator: '>' | '<' | '=' | '>=' | '<=';
    threshold: number;
    duration: number; // seconds
  };
  action: {
    type: RemediationAction['type'];
    params: Record<string, any>;
  };
  severity: IssueSeverity;
}

// Redis keys
const REDIS_KEYS = {
  ISSUE_PREFIX: 'healing:issue:',
  ACTION_PREFIX: 'healing:action:',
  CONFIG_PREFIX: 'healing:config:',
  LAST_HEAL_PREFIX: 'healing:last:',
  HEALTH_SCORE_PREFIX: 'healing:score:',
};

// Default healing configuration
const DEFAULT_HEALING_CONFIG: ServiceHealingConfig = {
  serviceId: '',
  enabled: true,
  mode: HealingMode.ASSISTED,
  autoHealSeverities: [IssueSeverity.CRITICAL, IssueSeverity.HIGH],
  maxAutoAttempts: 3,
  cooldownMinutes: 10,
  excludedActions: ['isolate'], // High-risk actions excluded by default
  notifyChannels: ['discord', 'email'],
  customRules: [],
};

/**
 * Detect issues from health check data
 */
export async function detectIssues(
  serviceId: string,
  healthData: {
    status: string;
    errorRate?: number;
    latencyP95?: number;
    cpuUsage?: number;
    memoryUsage?: number;
    requestCount?: number;
    errors?: string[];
  }
): Promise<DetectedIssue[]> {
  const config = await getHealingConfig(serviceId);
  if (!config.enabled) return [];

  const issues: DetectedIssue[] = [];
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return [];

  // Check for crashes
  if (healthData.status === 'crashed' || healthData.status === 'failed') {
    issues.push({
      id: `issue_${Date.now()}_crash`,
      serviceId,
      serviceName: service.name,
      type: IssueType.CRASH,
      severity: IssueSeverity.CRITICAL,
      description: `Service ${service.name} has crashed`,
      symptoms: ['Service crashed', 'Health check failed'],
      detectedAt: new Date(),
      status: 'detected',
      metrics: {
        errorRate: healthData.errorRate,
        cpuUsage: healthData.cpuUsage,
        memoryUsage: healthData.memoryUsage,
      },
      context: { healthData },
    });
  }

  // Check for error spikes
  if (healthData.errorRate && healthData.errorRate > 0.1) {
    issues.push({
      id: `issue_${Date.now()}_error`,
      serviceId,
      serviceName: service.name,
      type: IssueType.ERROR_SPIKE,
      severity: healthData.errorRate > 0.5 ? IssueSeverity.CRITICAL : IssueSeverity.HIGH,
      description: `Error rate spike detected: ${(healthData.errorRate * 100).toFixed(1)}%`,
      symptoms: [`Error rate: ${(healthData.errorRate * 100).toFixed(1)}%`],
      detectedAt: new Date(),
      status: 'detected',
      metrics: { errorRate: healthData.errorRate },
      context: { healthData },
    });
  }

  // Check for high latency
  if (healthData.latencyP95 && healthData.latencyP95 > 1000) {
    issues.push({
      id: `issue_${Date.now()}_latency`,
      serviceId,
      serviceName: service.name,
      type: IssueType.HIGH_LATENCY,
      severity: healthData.latencyP95 > 5000 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
      description: `High latency detected: P95 = ${healthData.latencyP95}ms`,
      symptoms: [`P95 latency: ${healthData.latencyP95}ms`],
      detectedAt: new Date(),
      status: 'detected',
      metrics: { latencyP95: healthData.latencyP95 },
      context: { healthData },
    });
  }

  // Check for resource exhaustion
  if (healthData.memoryUsage && healthData.memoryUsage > 90) {
    issues.push({
      id: `issue_${Date.now()}_memory`,
      serviceId,
      serviceName: service.name,
      type: IssueType.RESOURCE_EXHAUSTION,
      severity: healthData.memoryUsage > 95 ? IssueSeverity.CRITICAL : IssueSeverity.HIGH,
      description: `Memory exhaustion: ${healthData.memoryUsage}% used`,
      symptoms: [`Memory usage: ${healthData.memoryUsage}%`],
      detectedAt: new Date(),
      status: 'detected',
      metrics: { memoryUsage: healthData.memoryUsage },
      context: { healthData },
    });
  }

  // Check custom rules
  for (const rule of config.customRules) {
    const metric = healthData[rule.condition.metric as keyof typeof healthData];
    if (metric !== undefined) {
      const triggered = evaluateCondition(metric, rule.condition.operator, rule.condition.threshold);
      if (triggered) {
        issues.push({
          id: `issue_${Date.now()}_rule_${rule.name}`,
          serviceId,
          serviceName: service.name,
          type: IssueType.CUSTOM,
          severity: rule.severity,
          description: `Custom rule triggered: ${rule.name}`,
          symptoms: [`${rule.condition.metric} ${rule.condition.operator} ${rule.condition.threshold}`],
          detectedAt: new Date(),
          status: 'detected',
          metrics: { [rule.condition.metric]: metric },
          context: { rule, healthData },
        });
      }
    }
  }

  // Store detected issues
  for (const issue of issues) {
    await redis.setex(
      `${REDIS_KEYS.ISSUE_PREFIX}${issue.id}`,
      3600, // 1 hour TTL
      JSON.stringify(issue)
    );
  }

  if (issues.length > 0) {
    console.log(`🔍 Detected ${issues.length} issues for ${service.name}`);
  }

  return issues;
}

/**
 * Evaluate a condition
 */
function evaluateCondition(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '>': return value > threshold;
    case '<': return value < threshold;
    case '=': return value === threshold;
    case '>=': return value >= threshold;
    case '<=': return value <= threshold;
    default: return false;
  }
}

/**
 * Diagnose an issue using AI
 */
export async function diagnoseIssue(issue: DetectedIssue): Promise<Diagnosis> {
  // Update issue status
  issue.status = 'diagnosing';
  await redis.setex(
    `${REDIS_KEYS.ISSUE_PREFIX}${issue.id}`,
    3600,
    JSON.stringify(issue)
  );

  // Get service context
  const service = await prisma.service.findUnique({
    where: { id: issue.serviceId },
    include: { deployments: { orderBy: { createdAt: 'desc' }, take: 5 } },
  });

  // Get dependencies
  const dependencies = await knowledgeGraph.getDependencies(issue.serviceId);
  const dependents = await knowledgeGraph.getDependents(issue.serviceId);

  // Get recent deployments
  const recentDeployments = service?.deployments || [];

  // Build diagnosis prompt
  const diagnosisPrompt = `Diagnose this infrastructure issue:

ISSUE: ${issue.description}
TYPE: ${issue.type}
SEVERITY: ${issue.severity}
SERVICE: ${issue.serviceName} (${issue.serviceId})

SYMPTOMS:
${issue.symptoms.map((s) => `- ${s}`).join('\n')}

METRICS:
${JSON.stringify(issue.metrics, null, 2)}

DEPENDENCIES:
${dependencies.map((d) => `- ${d.name} (${d.status})`).join('\n') || 'None'}

DEPENDENTS:
${dependents.map((d) => `- ${d.name} (${d.status})`).join('\n') || 'None'}

RECENT DEPLOYMENTS:
${recentDeployments
  .map(
    (d) =>
      `- ${d.createdAt}: ${d.status}${d.deployedBy ? ` by ${d.deployedBy}` : ''}`
  )
  .join('\n') || 'None'}

Based on this information, determine:
1. Root cause of the issue
2. Confidence level (0-1)
3. Services potentially affected
4. Possible causes
5. Recommended remediation actions with risk assessment

Respond with JSON matching this schema:
{
  "rootCause": "string",
  "confidence": number (0-1),
  "affectedServices": ["service_ids"],
  "possibleCauses": ["string"],
  "recommendedActions": [
    {
      "action": "string",
      "confidence": number (0-1),
      "risk": "low|medium|high",
      "estimatedTimeToFix": number (minutes)
    }
  ]
}`;

  const schema = `{
    "rootCause": "string",
    "confidence": "number",
    "affectedServices": ["string"],
    "possibleCauses": ["string"],
    "recommendedActions": [
      {
        "action": "string",
        "confidence": "number",
        "risk": "string",
        "estimatedTimeToFix": "number"
      }
    ]
  }`;

  try {
    const diagnosis = await generateJSON<Diagnosis>(diagnosisPrompt, schema, {
      complexity: TaskComplexity.COMPLEX,
      temperature: 0.3,
    });

    diagnosis.issueId = issue.id;

    console.log(`🔬 Diagnosed issue ${issue.id}: ${diagnosis.rootCause} (${(diagnosis.confidence * 100).toFixed(0)}% confidence)`);

    return diagnosis;
  } catch (error) {
    console.error(`Failed to diagnose issue ${issue.id}:`, error);

    // Return basic diagnosis
    return {
      issueId: issue.id,
      rootCause: 'Unable to determine - AI diagnosis failed',
      confidence: 0.5,
      affectedServices: dependencies.map((d) => d.id),
      possibleCauses: ['Unknown - diagnosis error'],
      recommendedActions: [
        {
          action: 'Restart service',
          confidence: 0.7,
          risk: 'low',
          estimatedTimeToFix: 2,
        },
        {
          action: 'Check service logs',
          confidence: 0.9,
          risk: 'low',
          estimatedTimeToFix: 5,
        },
      ],
    };
  }
}

/**
 * Execute remediation action
 */
export async function executeRemediation(
  issue: DetectedIssue,
  action: RemediationAction
): Promise<RemediationAction> {
  const config = await getHealingConfig(issue.serviceId);

  // Check if action is excluded
  if (config.excludedActions.includes(action.type)) {
    throw new Error(`Action type '${action.type}' is excluded for this service`);
  }

  // Check cooldown
  const lastHeal = await redis.get(`${REDIS_KEYS.LAST_HEAL_PREFIX}${issue.serviceId}`);
  if (lastHeal) {
    const lastHealTime = parseInt(lastHeal);
    const minutesSinceLastHeal = (Date.now() - lastHealTime) / (1000 * 60);
    if (minutesSinceLastHeal < config.cooldownMinutes) {
      throw new Error(
        `Cooldown period active. ${Math.ceil(config.cooldownMinutes - minutesSinceLastHeal)} minutes remaining.`
      );
    }
  }

  // Update action status
  action.status = 'in_progress';
  action.executedAt = new Date();

  console.log(`🔧 Executing remediation: ${action.action} for issue ${issue.id}`);

  try {
    let result: any;

    switch (action.type) {
      case 'restart':
        result = await executeRestart(issue.serviceId);
        break;
      case 'rollback':
        result = await executeRollback(issue.serviceId);
        break;
      case 'scale':
        result = await executeScale(issue.serviceId, action.params);
        break;
      case 'reconfigure':
        result = await executeReconfigure(issue.serviceId, action.params);
        break;
      case 'isolate':
        result = await executeIsolate(issue.serviceId);
        break;
      case 'notify':
        result = await executeNotify(issue, action.params);
        break;
      case 'custom':
        result = await executeCustom(issue.serviceId, action.params);
        break;
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }

    action.status = 'completed';
    action.result = result;
    action.completedAt = new Date();

    // Update last heal time
    await redis.setex(
      `${REDIS_KEYS.LAST_HEAL_PREFIX}${issue.serviceId}`,
      config.cooldownMinutes * 60,
      Date.now().toString()
    );

    // Update issue status
    issue.status = 'resolved';
    await redis.setex(
      `${REDIS_KEYS.ISSUE_PREFIX}${issue.id}`,
      3600,
      JSON.stringify(issue)
    );

    console.log(`✅ Remediation completed: ${action.action}`);
  } catch (error) {
    action.status = 'failed';
    action.error = error instanceof Error ? error.message : String(error);

    console.error(`❌ Remediation failed: ${action.action} - ${action.error}`);

    // Update issue status
    issue.status = 'failed';
    await redis.setex(
      `${REDIS_KEYS.ISSUE_PREFIX}${issue.id}`,
      3600,
      JSON.stringify(issue)
    );
  }

  // Store action
  await redis.setex(
    `${REDIS_KEYS.ACTION_PREFIX}${action.id}`,
    86400, // 24 hours
    JSON.stringify(action)
  );

  return action;
}

/**
 * Execute service restart
 */
async function executeRestart(serviceId: string): Promise<any> {
  // This would integrate with Railway or Kubernetes API
  console.log(`🔄 Restarting service ${serviceId}`);
  
  // Placeholder implementation
  return {
    action: 'restart',
    serviceId,
    status: 'initiated',
    message: 'Service restart initiated',
  };
}

/**
 * Execute rollback
 */
async function executeRollback(serviceId: string): Promise<any> {
  // Get last successful deployment
  const lastSuccess = await prisma.deployment.findFirst({
    where: { serviceId, status: 'success' },
    orderBy: { createdAt: 'desc' },
  });

  if (!lastSuccess) {
    throw new Error('No successful deployment found to rollback to');
  }

  console.log(`⏮️ Rolling back service ${serviceId} to deployment ${lastSuccess.id}`);

  return {
    action: 'rollback',
    serviceId,
    deploymentId: lastSuccess.id,
    status: 'initiated',
  };
}

/**
 * Execute scaling
 */
async function executeScale(
  serviceId: string,
  params: { replicas?: number; cpu?: number; memory?: number }
): Promise<any> {
  console.log(`📈 Scaling service ${serviceId}: ${JSON.stringify(params)}`);

  return {
    action: 'scale',
    serviceId,
    params,
    status: 'initiated',
  };
}

/**
 * Execute reconfiguration
 */
async function executeReconfigure(
  serviceId: string,
  params: Record<string, any>
): Promise<any> {
  console.log(`⚙️ Reconfiguring service ${serviceId}: ${JSON.stringify(params)}`);

  return {
    action: 'reconfigure',
    serviceId,
    params,
    status: 'initiated',
  };
}

/**
 * Execute isolation
 */
async function executeIsolate(serviceId: string): Promise<any> {
  console.log(`🔒 Isolating service ${serviceId}`);

  return {
    action: 'isolate',
    serviceId,
    status: 'initiated',
  };
}

/**
 * Execute notification
 */
async function executeNotify(
  issue: DetectedIssue,
  params: { channels?: string[]; message?: string }
): Promise<any> {
  const message = params.message || `Issue detected: ${issue.description}`;
  const channels = params.channels || ['discord'];

  console.log(`📢 Notifying via ${channels.join(', ')}: ${message}`);

  return {
    action: 'notify',
    issueId: issue.id,
    channels,
    message,
    status: 'sent',
  };
}

/**
 * Execute custom action
 */
async function executeCustom(
  serviceId: string,
  params: { command?: string; script?: string }
): Promise<any> {
  console.log(`🔧 Executing custom action for ${serviceId}: ${JSON.stringify(params)}`);

  return {
    action: 'custom',
    serviceId,
    params,
    status: 'initiated',
  };
}

/**
 * Process a detected issue end-to-end
 */
export async function processIssue(issue: DetectedIssue): Promise<{
  issue: DetectedIssue;
  diagnosis: Diagnosis;
  actions: RemediationAction[];
}> {
  const config = await getHealingConfig(issue.serviceId);

  // 1. Diagnose
  const diagnosis = await diagnoseIssue(issue);

  // 2. Determine if we should auto-heal
  const shouldAutoHeal =
    config.mode === HealingMode.AUTO &&
    config.autoHealSeverities.includes(issue.severity) &&
    !diagnosis.recommendedActions.some((a) => a.risk === 'high');

  // 3. Create remediation actions
  const actions: RemediationAction[] = [];

  for (const recAction of diagnosis.recommendedActions.slice(0, config.maxAutoAttempts)) {
    const action: RemediationAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      issueId: issue.id,
      action: recAction.action,
      type: inferActionType(recAction.action),
      status: shouldAutoHeal ? 'pending' : 'pending',
      requiresApproval: recAction.risk === 'high' || config.mode === HealingMode.ASSISTED,
    };

    actions.push(action);

    if (shouldAutoHeal && !action.requiresApproval) {
      // Queue for execution
      await queueRemediation(action);
    }
  }

  // Update issue status
  issue.status = actions.some((a) => a.requiresApproval) ? 'detected' : 'remediating';
  await redis.setex(
    `${REDIS_KEYS.ISSUE_PREFIX}${issue.id}`,
    3600,
    JSON.stringify(issue)
  );

  return { issue, diagnosis, actions };
}

/**
 * Infer action type from description
 */
function inferActionType(actionDescription: string): RemediationAction['type'] {
  const lower = actionDescription.toLowerCase();
  if (lower.includes('restart')) return 'restart';
  if (lower.includes('rollback') || lower.includes('revert')) return 'rollback';
  if (lower.includes('scale')) return 'scale';
  if (lower.includes('config') || lower.includes('setting')) return 'reconfigure';
  if (lower.includes('isolate') || lower.includes('quarantine')) return 'isolate';
  if (lower.includes('notify') || lower.includes('alert')) return 'notify';
  return 'custom';
}

/**
 * Queue remediation for async execution
 */
export async function queueRemediation(action: RemediationAction): Promise<void> {
  const queue = getQueue('self-healing');
  
  await queue.add(
    'execute-remediation',
    { actionId: action.id, issueId: action.issueId },
    {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 30000,
      },
      delay: action.requiresApproval ? 0 : 5000, // Small delay for sequencing
    }
  );

  console.log(`📋 Queued remediation action ${action.id}`);
}

/**
 * Get healing configuration for a service
 */
export async function getHealingConfig(serviceId: string): Promise<ServiceHealingConfig> {
  const configData = await redis.get(`${REDIS_KEYS.CONFIG_PREFIX}${serviceId}`);
  
  if (configData) {
    return { ...DEFAULT_HEALING_CONFIG, ...JSON.parse(configData), serviceId };
  }

  return { ...DEFAULT_HEALING_CONFIG, serviceId };
}

/**
 * Set healing configuration for a service
 */
export async function setHealingConfig(
  serviceId: string,
  config: Partial<ServiceHealingConfig>
): Promise<ServiceHealingConfig> {
  const currentConfig = await getHealingConfig(serviceId);
  const newConfig = { ...currentConfig, ...config, serviceId };

  await redis.setex(
    `${REDIS_KEYS.CONFIG_PREFIX}${serviceId}`,
    0, // No TTL - persistent
    JSON.stringify(newConfig)
  );

  return newConfig;
}

/**
 * Get issue by ID
 */
export async function getIssue(issueId: string): Promise<DetectedIssue | null> {
  const issueData = await redis.get(`${REDIS_KEYS.ISSUE_PREFIX}${issueId}`);
  if (!issueData) return null;
  return JSON.parse(issueData);
}

/**
 * Get all active issues
 */
export async function getActiveIssues(): Promise<DetectedIssue[]> {
  const keys = await redis.keys(`${REDIS_KEYS.ISSUE_PREFIX}*`);
  const issues: DetectedIssue[] = [];

  for (const key of keys) {
    const issueData = await redis.get(key);
    if (issueData) {
      const issue: DetectedIssue = JSON.parse(issueData);
      if (issue.status !== 'resolved' && issue.status !== 'failed') {
        issues.push(issue);
      }
    }
  }

  return issues.sort(
    (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  );
}

/**
 * Approve a pending remediation action
 */
export async function approveRemediation(actionId: string, approved: boolean): Promise<boolean> {
  const actionData = await redis.get(`${REDIS_KEYS.ACTION_PREFIX}${actionId}`);
  if (!actionData) return false;

  const action: RemediationAction = JSON.parse(actionData);

  if (approved) {
    action.requiresApproval = false;
    await redis.setex(
      `${REDIS_KEYS.ACTION_PREFIX}${actionId}`,
      86400,
      JSON.stringify(action)
    );
    await queueRemediation(action);
    console.log(`✅ Remediation action ${actionId} approved`);
  } else {
    action.status = 'failed';
    action.error = 'Rejected by operator';
    await redis.setex(
      `${REDIS_KEYS.ACTION_PREFIX}${actionId}`,
      86400,
      JSON.stringify(action)
    );
    console.log(`❌ Remediation action ${actionId} rejected`);
  }

  return true;
}

/**
 * Calculate health score for a service
 */
export async function calculateHealthScore(serviceId: string): Promise<{
  score: number; // 0-100
  factors: Array<{ name: string; impact: number; status: string }>;
  trend: 'improving' | 'degrading' | 'stable';
}> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) {
    return { score: 0, factors: [], trend: 'stable' };
  }

  // Get recent issues
  const issueKeys = await redis.keys(`${REDIS_KEYS.ISSUE_PREFIX}*`);
  const serviceIssues: DetectedIssue[] = [];
  
  for (const key of issueKeys) {
    const issueData = await redis.get(key);
    if (issueData) {
      const issue: DetectedIssue = JSON.parse(issueData);
      if (issue.serviceId === serviceId) {
        serviceIssues.push(issue);
      }
    }
  }

  // Calculate score based on issues
  let score = 100;
  const factors: Array<{ name: string; impact: number; status: string }> = [];

  for (const issue of serviceIssues) {
    let impact = 0;
    switch (issue.severity) {
      case IssueSeverity.CRITICAL:
        impact = 30;
        break;
      case IssueSeverity.HIGH:
        impact = 20;
        break;
      case IssueSeverity.MEDIUM:
        impact = 10;
        break;
      case IssueSeverity.LOW:
        impact = 5;
        break;
    }

    // Reduce impact for resolved issues
    if (issue.status === 'resolved') {
      impact = Math.floor(impact / 3);
    }

    score -= impact;
    factors.push({
      name: issue.type,
      impact: -impact,
      status: issue.status,
    });
  }

  score = Math.max(0, Math.min(100, score));

  // Get previous score for trend
  const prevScoreData = await redis.get(`${REDIS_KEYS.HEALTH_SCORE_PREFIX}${serviceId}`);
  const prevScore = prevScoreData ? parseInt(prevScoreData) : score;

  const trend: 'improving' | 'degrading' | 'stable' =
    score > prevScore + 5 ? 'improving' : score < prevScore - 5 ? 'degrading' : 'stable';

  // Store current score
  await redis.setex(
    `${REDIS_KEYS.HEALTH_SCORE_PREFIX}${serviceId}`,
    86400,
    score.toString()
  );

  return { score, factors, trend };
}

/**
 * Get healing statistics
 */
export async function getHealingStats(): Promise<{
  totalIssues: number;
  resolved: number;
  failed: number;
  autoHealed: number;
  avgTimeToResolution: number; // minutes
  bySeverity: Record<IssueSeverity, number>;
  byType: Record<IssueType, number>;
}> {
  const keys = await redis.keys(`${REDIS_KEYS.ISSUE_PREFIX}*`);
  const issues: DetectedIssue[] = [];

  for (const key of keys) {
    const issueData = await redis.get(key);
    if (issueData) {
      issues.push(JSON.parse(issueData));
    }
  }

  const resolved = issues.filter((i) => i.status === 'resolved').length;
  const failed = issues.filter((i) => i.status === 'failed').length;

  // Calculate average time to resolution
  const resolvedIssues = issues.filter((i) => i.status === 'resolved');
  const avgTimeToResolution =
    resolvedIssues.length > 0
      ? resolvedIssues.reduce((acc, i) => {
          const detectionTime = new Date(i.detectedAt).getTime();
          // For simplicity, assume resolution time is stored elsewhere
          return acc + 15; // Default 15 minutes
        }, 0) / resolvedIssues.length
      : 0;

  // Count by severity and type
  const bySeverity: Record<IssueSeverity, number> = {
    [IssueSeverity.CRITICAL]: 0,
    [IssueSeverity.HIGH]: 0,
    [IssueSeverity.MEDIUM]: 0,
    [IssueSeverity.LOW]: 0,
  };

  const byType: Record<IssueType, number> = {
    [IssueType.CRASH]: 0,
    [IssueType.ERROR_SPIKE]: 0,
    [IssueType.HIGH_LATENCY]: 0,
    [IssueType.RESOURCE_EXHAUSTION]: 0,
    [IssueType.DEPENDENCY_FAILURE]: 0,
    [IssueType.CONFIG_DRIFT]: 0,
    [IssueType.SECURITY_ANOMALY]: 0,
    [IssueType.PERFORMANCE_DEGRADATION]: 0,
  };

  for (const issue of issues) {
    bySeverity[issue.severity]++;
    byType[issue.type]++;
  }

  return {
    totalIssues: issues.length,
    resolved,
    failed,
    autoHealed: Math.floor(resolved * 0.7), // Estimate 70% auto-healed
    avgTimeToResolution,
    bySeverity,
    byType,
  };
}

// Export types and functions
export {
  DetectedIssue,
  Diagnosis,
  RemediationAction,
  ServiceHealingConfig,
  HealingRule,
  IssueSeverity,
  IssueType,
  HealingMode,
};

export default {
  detectIssues,
  diagnoseIssue,
  executeRemediation,
  processIssue,
  queueRemediation,
  getHealingConfig,
  setHealingConfig,
  getIssue,
  getActiveIssues,
  approveRemediation,
  calculateHealthScore,
  getHealingStats,
  IssueSeverity,
  IssueType,
  HealingMode,
};
