/**
 * CI/CD Integration Service
 * GitHub Actions and GitLab CI integration
 * Pipeline management, deployment automation, and build analytics
 */

import { PrismaClient } from '@prisma/client';
import { generate, generateJSON, TaskComplexity } from './llm-router';
import { redis } from './redis';
import { getQueue } from './queue';
import * as doraMetrics from './dora-metrics';

const prisma = new PrismaClient();

// CI/CD provider types
export enum CICDProvider {
  GITHUB_ACTIONS = 'github_actions',
  GITLAB_CI = 'gitlab_ci',
  JENKINS = 'jenkins',
  CIRCLE_CI = 'circle_ci',
  TRAVIS = 'travis',
  AZURE_DEVOPS = 'azure_devops',
}

// Pipeline configuration
interface PipelineConfig {
  id: string;
  provider: CICDProvider;
  name: string;
  repository: {
    url: string;
    branch: string;
    fullName: string;
  };
  triggers: {
    push: boolean;
    pullRequest: boolean;
    schedule?: string; // Cron expression
    manual: boolean;
  };
  stages: PipelineStage[];
  environmentVariables: Record<string, string>;
  secrets: string[];
  notifications: {
    slack?: string;
    discord?: string;
    email?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  enabled: boolean;
}

// Pipeline stage
interface PipelineStage {
  id: string;
  name: string;
  order: number;
  jobs: PipelineJob[];
  conditions?: {
    onSuccess?: string[];
    onFailure?: string[];
  };
  parallel: boolean;
}

// Pipeline job
interface PipelineJob {
  id: string;
  name: string;
  type: 'build' | 'test' | 'deploy' | 'scan' | 'notify' | 'custom';
  script: string[];
  image?: string; // Docker image
  artifacts?: {
    paths: string[];
    expireIn?: string;
  };
  dependencies?: string[];
  environment?: {
    name: string;
    url?: string;
  };
  allowFailure: boolean;
  timeout: number; // minutes
}

// Pipeline run/execution
interface PipelineRun {
  id: string;
  pipelineId: string;
  runNumber: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'skipped';
  trigger: {
    type: 'push' | 'pull_request' | 'schedule' | 'manual' | 'api';
    actor: string;
    commit?: {
      sha: string;
      message: string;
      author: string;
      timestamp: Date;
    };
    branch: string;
  };
  stages: Array<{
    id: string;
    name: string;
    status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
    startedAt?: Date;
    completedAt?: Date;
    duration?: number; // seconds
    jobs: Array<{
      id: string;
      name: string;
      status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
      logs: string[];
      startedAt?: Date;
      completedAt?: Date;
      duration?: number;
    }>;
  }>;
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // seconds
  artifacts?: Array<{
    name: string;
    size: number;
    url: string;
  }>;
  testResults?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    coverage?: number;
  };
  deploymentUrl?: string;
}

// Build analytics
interface BuildAnalytics {
  pipelineId: string;
  period: {
    start: Date;
    end: Date;
  };
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  cancelledRuns: number;
  avgDuration: number; // seconds
  successRate: number; // percentage
  trend: 'improving' | 'degrading' | 'stable';
  byStage: Record<string, {
    avgDuration: number;
    successRate: number;
    failures: number;
  }>;
  flakyTests: Array<{
    name: string;
    failureRate: number;
    totalRuns: number;
  }>;
  recommendations: string[];
}

// Deployment configuration
interface DeploymentConfig {
  id: string;
  pipelineId: string;
  name: string;
  environment: 'development' | 'staging' | 'production';
  strategy: 'rolling' | 'blue_green' | 'canary' | 'recreate';
  target: {
    type: 'kubernetes' | 'railway' | 'ecs' | 'vm';
    clusterId?: string;
    serviceId?: string;
    namespace?: string;
  };
  conditions: {
    autoDeploy: boolean;
    requireApproval: boolean;
    healthCheck?: {
      url: string;
      timeout: number;
      retries: number;
    };
  };
  rollback: {
    enabled: boolean;
    automatic: boolean;
    threshold: number; // error rate threshold
  };
  notifications: {
    onStart: boolean;
    onSuccess: boolean;
    onFailure: boolean;
  };
}

// GitHub Actions workflow file
interface GitHubWorkflow {
  name: string;
  on: {
    push?: { branches?: string[] };
    pull_request?: { branches?: string[] };
    schedule?: Array<{ cron: string }>;
    workflow_dispatch?: {};
  };
  jobs: Record<string, {
    name?: string;
    'runs-on': string;
    steps: Array<{
      name?: string;
      uses?: string;
      run?: string;
      with?: Record<string, any>;
      env?: Record<string, string>;
    }>;
    needs?: string[];
    if?: string;
  }>;
  env?: Record<string, string>;
}

// GitLab CI configuration
interface GitLabCI {
  stages: string[];
  variables?: Record<string, string>;
  image?: string;
  before_script?: string[];
  after_script?: string[];
  workflow?: {
    rules?: Array<{
      if?: string;
      when?: 'always' | 'never';
    }>;
  };
  [jobName: string]: any;
}

// Redis keys
const REDIS_KEYS = {
  PIPELINE_PREFIX: 'cicd:pipeline:',
  RUN_PREFIX: 'cicd:run:',
  CONFIG_PREFIX: 'cicd:config:',
  ANALYTICS_PREFIX: 'cicd:analytics:',
  LAST_RUN_PREFIX: 'cicd:lastrun:',
  ARTIFACT_PREFIX: 'cicd:artifact:',
};

/**
 * Create a pipeline configuration
 */
export async function createPipeline(
  provider: CICDProvider,
  name: string,
  repository: PipelineConfig['repository'],
  stages: PipelineStage[]
): Promise<PipelineConfig> {
  const pipelineId = `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const config: PipelineConfig = {
    id: pipelineId,
    provider,
    name,
    repository,
    triggers: {
      push: true,
      pullRequest: true,
      manual: true,
    },
    stages,
    environmentVariables: {},
    secrets: [],
    notifications: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    enabled: true,
  };

  // Store pipeline
  await redis.setex(
    `${REDIS_KEYS.PIPELINE_PREFIX}${pipelineId}`,
    0,
    JSON.stringify(config)
  );

  console.log(`🔧 Created ${provider} pipeline: ${name}`);

  return config;
}

/**
 * Get all pipelines
 */
export async function getPipelines(): Promise<PipelineConfig[]> {
  const keys = await redis.keys(`${REDIS_KEYS.PIPELINE_PREFIX}*`);
  const pipelines: PipelineConfig[] = [];

  for (const key of keys) {
    const pipelineData = await redis.get(key);
    if (pipelineData) {
      pipelines.push(JSON.parse(pipelineData));
    }
  }

  return pipelines.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Get pipeline by ID
 */
export async function getPipeline(pipelineId: string): Promise<PipelineConfig | null> {
  const pipelineData = await redis.get(`${REDIS_KEYS.PIPELINE_PREFIX}${pipelineId}`);
  if (!pipelineData) return null;
  return JSON.parse(pipelineData);
}

/**
 * Update pipeline
 */
export async function updatePipeline(
  pipelineId: string,
  updates: Partial<PipelineConfig>
): Promise<PipelineConfig | null> {
  const pipeline = await getPipeline(pipelineId);
  if (!pipeline) return null;

  Object.assign(pipeline, updates, { updatedAt: new Date() });

  await redis.setex(
    `${REDIS_KEYS.PIPELINE_PREFIX}${pipelineId}`,
    0,
    JSON.stringify(pipeline)
  );

  return pipeline;
}

/**
 * Delete pipeline
 */
export async function deletePipeline(pipelineId: string): Promise<boolean> {
  const result = await redis.del(`${REDIS_KEYS.PIPELINE_PREFIX}${pipelineId}`);
  console.log(`🗑️ Deleted pipeline: ${pipelineId}`);
  return result > 0;
}

/**
 * Trigger a pipeline run
 */
export async function triggerPipeline(
  pipelineId: string,
  trigger: PipelineRun['trigger'],
  variables?: Record<string, string>
): Promise<PipelineRun> {
  const pipeline = await getPipeline(pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${pipelineId}`);
  }

  if (!pipeline.enabled) {
    throw new Error(`Pipeline is disabled: ${pipelineId}`);
  }

  // Get run number
  const lastRunKey = `${REDIS_KEYS.LAST_RUN_PREFIX}${pipelineId}`;
  const lastRunData = await redis.get(lastRunKey);
  const lastRunNumber = lastRunData ? parseInt(lastRunData) : 0;
  const runNumber = lastRunNumber + 1;

  const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const run: PipelineRun = {
    id: runId,
    pipelineId,
    runNumber,
    status: 'pending',
    trigger,
    stages: pipeline.stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      status: 'pending',
      jobs: stage.jobs.map((job) => ({
        id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: job.name,
        status: 'pending',
        logs: [],
      })),
    })),
    startedAt: new Date(),
  };

  // Store run
  await redis.setex(
    `${REDIS_KEYS.RUN_PREFIX}${runId}`,
    604800, // 7 days
    JSON.stringify(run)
  );

  // Update last run number
  await redis.setex(lastRunKey, 0, runNumber.toString());

  console.log(`🚀 Triggered ${pipeline.provider} pipeline: ${pipeline.name} #${runNumber}`);

  // Queue for execution
  await queuePipelineRun(runId);

  return run;
}

/**
 * Queue pipeline run for async execution
 */
async function queuePipelineRun(runId: string): Promise<void> {
  const queue = getQueue('cicd-runs');
  
  await queue.add(
    'execute-pipeline',
    { runId },
    {
      attempts: 1,
      backoff: {
        type: 'fixed',
        delay: 5000,
      },
    }
  );
}

/**
 * Execute a pipeline run (simulated)
 */
export async function executePipelineRun(runId: string): Promise<PipelineRun> {
  const runData = await redis.get(`${REDIS_KEYS.RUN_PREFIX}${runId}`);
  if (!runData) {
    throw new Error(`Pipeline run not found: ${runId}`);
  }

  const run: PipelineRun = JSON.parse(runData);
  const pipeline = await getPipeline(run.pipelineId);
  
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${run.pipelineId}`);
  }

  run.status = 'running';

  // Execute stages sequentially
  for (const stage of run.stages) {
    stage.status = 'running';
    stage.startedAt = new Date();

    console.log(`▶️  Executing stage: ${stage.name}`);

    // Execute jobs
    if (stage.jobs.length > 0) {
      const jobResults = await Promise.all(
        stage.jobs.map((job) => executeJob(job, pipeline))
      );

      const allSuccess = jobResults.every((j) => j.status === 'success');
      const anyFailed = jobResults.some((j) => j.status === 'failed');

      stage.status = allSuccess ? 'success' : anyFailed ? 'failed' : 'skipped';
    } else {
      stage.status = 'success';
    }

    stage.completedAt = new Date();
    stage.duration = stage.completedAt.getTime() - (stage.startedAt?.getTime() || 0);

    // If stage failed, stop pipeline
    if (stage.status === 'failed') {
      run.status = 'failed';
      break;
    }
  }

  // Determine final status
  if (run.status !== 'failed') {
    const allStagesSuccess = run.stages.every((s) => s.status === 'success');
    run.status = allStagesSuccess ? 'success' : 'failed';
  }

  run.completedAt = new Date();
  run.duration = run.completedAt.getTime() - run.startedAt.getTime();

  // Generate test results
  if (run.status === 'success') {
    run.testResults = {
      total: Math.floor(Math.random() * 100) + 50,
      passed: Math.floor(Math.random() * 100) + 40,
      failed: Math.floor(Math.random() * 5),
      skipped: Math.floor(Math.random() * 10),
      coverage: Math.random() * 30 + 70,
    };
  }

  // Store updated run
  await redis.setex(
    `${REDIS_KEYS.RUN_PREFIX}${runId}`,
    604800,
    JSON.stringify(run)
  );

  // Record deployment for DORA metrics if successful
  if (run.status === 'success') {
    // Find service from pipeline
    const service = await prisma.service.findFirst({
      where: { repositoryUrl: { contains: pipeline.repository.fullName } },
    });

    if (service) {
      await doraMetrics.recordDeployment(service.id, 'success', {
        pipelineId: pipeline.id,
        runId: run.id,
        runNumber: run.runNumber,
        duration: run.duration,
      });
    }
  }

  // Send notifications
  await sendPipelineNotifications(pipeline, run);

  console.log(`✅ Pipeline run completed: ${run.status} (${run.duration}s)`);

  return run;
}

/**
 * Execute a single job
 */
async function executeJob(
  job: PipelineRun['stages'][0]['jobs'][0],
  pipeline: PipelineConfig
): Promise<PipelineRun['stages'][0]['jobs'][0]> {
  job.status = 'running';
  job.startedAt = new Date();

  // Simulate job execution
  const duration = Math.floor(Math.random() * 30) + 10; // 10-40 seconds
  await new Promise((resolve) => setTimeout(resolve, duration * 100));

  // 90% success rate
  const success = Math.random() > 0.1 || job.name.includes('allow_failure');

  job.status = success ? 'success' : 'failed';
  job.completedAt = new Date();
  job.duration = duration;
  job.logs = [
    `[${new Date().toISOString()}] Starting job: ${job.name}`,
    `[${new Date().toISOString()}] Running on ${pipeline.provider}`,
    `[${new Date().toISOString()}] ${success ? 'Job completed successfully' : 'Job failed'}`,
  ];

  return job;
}

/**
 * Send pipeline notifications
 */
async function sendPipelineNotifications(
  pipeline: PipelineConfig,
  run: PipelineRun
): Promise<void> {
  const { notifications } = pipeline;
  const message = `Pipeline ${pipeline.name} #${run.runNumber}: ${run.status}`;

  if (notifications.discord && (run.status === 'failed' || notifications.onSuccess)) {
    console.log(`📢 Discord notification: ${message}`);
  }

  if (notifications.slack && (run.status === 'failed' || notifications.onSuccess)) {
    console.log(`📢 Slack notification: ${message}`);
  }
}

/**
 * Get pipeline runs
 */
export async function getPipelineRuns(
  pipelineId: string,
  limit: number = 20
): Promise<PipelineRun[]> {
  const keys = await redis.keys(`${REDIS_KEYS.RUN_PREFIX}*`);
  const runs: PipelineRun[] = [];

  for (const key of keys) {
    const runData = await redis.get(key);
    if (runData) {
      const run: PipelineRun = JSON.parse(runData);
      if (run.pipelineId === pipelineId) {
        runs.push(run);
      }
    }
  }

  return runs
    .sort((a, b) => b.runNumber - a.runNumber)
    .slice(0, limit);
}

/**
 * Get pipeline run by ID
 */
export async function getPipelineRun(runId: string): Promise<PipelineRun | null> {
  const runData = await redis.get(`${REDIS_KEYS.RUN_PREFIX}${runId}`);
  if (!runData) return null;
  return JSON.parse(runData);
}

/**
 * Cancel a pipeline run
 */
export async function cancelPipelineRun(runId: string): Promise<boolean> {
  const run = await getPipelineRun(runId);
  if (!run) return false;

  if (run.status === 'running' || run.status === 'pending') {
    run.status = 'cancelled';
    run.completedAt = new Date();

    await redis.setex(
      `${REDIS_KEYS.RUN_PREFIX}${runId}`,
      604800,
      JSON.stringify(run)
    );

    console.log(`🚫 Cancelled pipeline run: ${runId}`);
    return true;
  }

  return false;
}

/**
 * Get job logs
 */
export async function getJobLogs(
  runId: string,
  jobId: string
): Promise<string[]> {
  const run = await getPipelineRun(runId);
  if (!run) return [];

  for (const stage of run.stages) {
    const job = stage.jobs.find((j) => j.id === jobId);
    if (job) {
      return job.logs;
    }
  }

  return [];
}

/**
 * Generate GitHub Actions workflow file
 */
export async function generateGitHubWorkflow(
  pipelineId: string
): Promise<GitHubWorkflow> {
  const pipeline = await getPipeline(pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${pipelineId}`);
  }

  const workflow: GitHubWorkflow = {
    name: pipeline.name,
    on: {
      push: { branches: [pipeline.repository.branch] },
      pull_request: { branches: [pipeline.repository.branch] },
    },
    jobs: {},
  };

  // Convert stages to jobs
  let needs: string[] = [];
  for (const stage of pipeline.stages) {
    for (const job of stage.jobs) {
      const jobId = job.name.toLowerCase().replace(/\s+/g, '_');
      
      workflow.jobs[jobId] = {
        name: job.name,
        'runs-on': 'ubuntu-latest',
        needs: needs.length > 0 ? [...needs] : undefined,
        steps: [],
      };

      // Add steps based on job type
      if (job.type === 'build') {
        workflow.jobs[jobId].steps.push(
          { uses: 'actions/checkout@v4' },
          { name: 'Setup Node.js', uses: 'actions/setup-node@v4', with: { 'node-version': '20' } },
          { name: 'Install dependencies', run: 'npm ci' },
          { name: 'Build', run: 'npm run build' }
        );
      } else if (job.type === 'test') {
        workflow.jobs[jobId].steps.push(
          { uses: 'actions/checkout@v4' },
          { name: 'Setup Node.js', uses: 'actions/setup-node@v4', with: { 'node-version': '20' } },
          { name: 'Install dependencies', run: 'npm ci' },
          { name: 'Run tests', run: 'npm test' }
        );
      } else if (job.type === 'deploy') {
        workflow.jobs[jobId].steps.push(
          { uses: 'actions/checkout@v4' },
          { name: 'Deploy', run: 'echo "Deploying to production..."' }
        );
      }

      needs = [jobId];
    }
  }

  return workflow;
}

/**
 * Generate GitLab CI configuration
 */
export async function generateGitLabCI(
  pipelineId: string
): Promise<GitLabCI> {
  const pipeline = await getPipeline(pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${pipelineId}`);
  }

  const gitlabci: GitLabCI = {
    stages: pipeline.stages.map((s) => s.name.toLowerCase().replace(/\s+/g, '_')),
    image: 'node:20',
  };

  // Convert stages to jobs
  for (const stage of pipeline.stages) {
    for (const job of stage.jobs) {
      const jobName = job.name.toLowerCase().replace(/\s+/g, '_');
      const stageName = stage.name.toLowerCase().replace(/\s+/g, '_');

      gitlabci[jobName] = {
        stage: stageName,
        script: job.script.length > 0 ? job.script : ['echo "Running job..."'],
        allow_failure: job.allowFailure,
        timeout: `${job.timeout} minutes`,
      };

      if (job.artifacts) {
        gitlabci[jobName].artifacts = {
          paths: job.artifacts.paths,
          expire_in: job.artifacts.expireIn || '1 week',
        };
      }
    }
  }

  return gitlabci;
}

/**
 * Create deployment configuration
 */
export async function createDeploymentConfig(
  config: Omit<DeploymentConfig, 'id'>
): Promise<DeploymentConfig> {
  const deploymentId = `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const deploymentConfig: DeploymentConfig = {
    ...config,
    id: deploymentId,
  };

  await redis.setex(
    `${REDIS_KEYS.CONFIG_PREFIX}${deploymentId}`,
    0,
    JSON.stringify(deploymentConfig)
  );

  console.log(`🚀 Created deployment config: ${config.name} (${config.environment})`);

  return deploymentConfig;
}

/**
 * Get deployment configurations
 */
export async function getDeploymentConfigs(
  pipelineId?: string
): Promise<DeploymentConfig[]> {
  const keys = await redis.keys(`${REDIS_KEYS.CONFIG_PREFIX}*`);
  const configs: DeploymentConfig[] = [];

  for (const key of keys) {
    const configData = await redis.get(key);
    if (configData) {
      const config: DeploymentConfig = JSON.parse(configData);
      if (!pipelineId || config.pipelineId === pipelineId) {
        configs.push(config);
      }
    }
  }

  return configs;
}

/**
 * Get build analytics
 */
export async function getBuildAnalytics(
  pipelineId: string,
  days: number = 30
): Promise<BuildAnalytics> {
  const runs = await getPipelineRuns(pipelineId, 100);
  const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const periodRuns = runs.filter((r) => r.startedAt >= periodStart);
  
  const successful = periodRuns.filter((r) => r.status === 'success').length;
  const failed = periodRuns.filter((r) => r.status === 'failed').length;
  const cancelled = periodRuns.filter((r) => r.status === 'cancelled').length;

  const avgDuration = periodRuns.length > 0
    ? periodRuns.reduce((acc, r) => acc + (r.duration || 0), 0) / periodRuns.length
    : 0;

  const successRate = periodRuns.length > 0
    ? (successful / periodRuns.length) * 100
    : 0;

  // Calculate trend
  const firstHalf = periodRuns.slice(0, Math.floor(periodRuns.length / 2));
  const secondHalf = periodRuns.slice(Math.floor(periodRuns.length / 2));
  
  const firstSuccessRate = firstHalf.length > 0
    ? (firstHalf.filter((r) => r.status === 'success').length / firstHalf.length) * 100
    : 0;
  const secondSuccessRate = secondHalf.length > 0
    ? (secondHalf.filter((r) => r.status === 'success').length / secondHalf.length) * 100
    : 0;

  const trend: BuildAnalytics['trend'] =
    secondSuccessRate > firstSuccessRate + 5 ? 'improving' :
    secondSuccessRate < firstSuccessRate - 5 ? 'degrading' : 'stable';

  const analytics: BuildAnalytics = {
    pipelineId,
    period: {
      start: periodStart,
      end: new Date(),
    },
    totalRuns: periodRuns.length,
    successfulRuns: successful,
    failedRuns: failed,
    cancelledRuns: cancelled,
    avgDuration,
    successRate,
    trend,
    byStage: {},
    flakyTests: [],
    recommendations: generateAnalyticsRecommendations(successRate, avgDuration, trend),
  };

  return analytics;
}

/**
 * Generate recommendations based on analytics
 */
function generateAnalyticsRecommendations(
  successRate: number,
  avgDuration: number,
  trend: string
): string[] {
  const recommendations: string[] = [];

  if (successRate < 80) {
    recommendations.push('Success rate is below 80%. Review failed builds and fix flaky tests.');
  }

  if (avgDuration > 600) { // 10 minutes
    recommendations.push('Average build time exceeds 10 minutes. Consider parallelizing jobs or optimizing build steps.');
  }

  if (trend === 'degrading') {
    recommendations.push('Build success rate is trending down. Investigate recent changes.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Build pipeline is performing well. Keep monitoring for regressions.');
  }

  return recommendations;
}

/**
 * Get CI/CD summary
 */
export async function getCICDSummary(): Promise<{
  totalPipelines: number;
  totalRuns: number;
  activeRuns: number;
  successRate: number;
  avgDuration: number;
  byProvider: Record<CICDProvider, number>;
}> {
  const pipelines = await getPipelines();
  
  let totalRuns = 0;
  let successfulRuns = 0;
  let totalDuration = 0;
  let activeRuns = 0;

  const byProvider: Record<CICDProvider, number> = {
    [CICDProvider.GITHUB_ACTIONS]: 0,
    [CICDProvider.GITLAB_CI]: 0,
    [CICDProvider.JENKINS]: 0,
    [CICDProvider.CIRCLE_CI]: 0,
    [CICDProvider.TRAVIS]: 0,
    [CICDProvider.AZURE_DEVOPS]: 0,
  };

  for (const pipeline of pipelines) {
    byProvider[pipeline.provider]++;
    
    const runs = await getPipelineRuns(pipeline.id, 50);
    totalRuns += runs.length;
    
    for (const run of runs) {
      if (run.status === 'running') activeRuns++;
      if (run.status === 'success') successfulRuns++;
      if (run.duration) totalDuration += run.duration;
    }
  }

  return {
    totalPipelines: pipelines.length,
    totalRuns,
    activeRuns,
    successRate: totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0,
    avgDuration: totalRuns > 0 ? totalDuration / totalRuns : 0,
    byProvider,
  };
}

// Export types and functions
export {
  PipelineConfig,
  PipelineStage,
  PipelineJob,
  PipelineRun,
  BuildAnalytics,
  DeploymentConfig,
  GitHubWorkflow,
  GitLabCI,
  CICDProvider,
};

export default {
  createPipeline,
  getPipelines,
  getPipeline,
  updatePipeline,
  deletePipeline,
  triggerPipeline,
  executePipelineRun,
  getPipelineRuns,
  getPipelineRun,
  cancelPipelineRun,
  getJobLogs,
  generateGitHubWorkflow,
  generateGitLabCI,
  createDeploymentConfig,
  getDeploymentConfigs,
  getBuildAnalytics,
  getCICDSummary,
  CICDProvider,
};
