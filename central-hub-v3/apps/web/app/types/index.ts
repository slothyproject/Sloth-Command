/**
 * Type Definitions for Central Hub v4.0
 * Complete type coverage for all API features
 */

// ============================================================================
// BASE TYPES (Existing)
// ============================================================================

// User Types
export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'user' | 'admin';
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tokens {
  access: string;
  refresh: string;
}

// Service Types
export interface Service {
  id: string;
  name: string;
  description?: string;
  railwayId?: string;
  status: ServiceStatus;
  cpuPercent?: number;
  memoryPercent?: number;
  diskPercent?: number;
  lastDeploymentAt?: string;
  lastRestartAt?: string;
  url?: string;
  repositoryUrl?: string;
  healthScore?: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export type ServiceStatus = 
  | 'healthy' 
  | 'degraded' 
  | 'unhealthy' 
  | 'paused' 
  | 'deploying' 
  | 'crashed';

export interface ServiceWithVariables extends Service {
  variables: Variable[];
}

// Variable Types
export interface Variable {
  id: string;
  serviceId: string;
  name: string;
  value: string;
  encrypted: boolean;
  category?: string;
  description?: string;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

export type VariableCategory = 
  | 'general'
  | 'database'
  | 'api'
  | 'auth'
  | 'integrations'
  | 'custom';

// Deployment Types
export interface Deployment {
  id: string;
  serviceId: string;
  status: DeploymentStatus;
  url?: string;
  logs?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export type DeploymentStatus = 
  | 'pending'
  | 'in_progress'
  | 'success'
  | 'failed'
  | 'cancelled';

// AI Intelligence Types (Legacy)
export interface AIInsight {
  id: string;
  serviceId: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  message: string;
  recommendation?: string;
  metric?: string;
  value?: number;
  autoFixable: boolean;
  fixedAt?: string;
  dismissedAt?: string;
  createdAt: string;
}

export type InsightType = 
  | 'performance'
  | 'cost'
  | 'reliability'
  | 'security'
  | 'anomaly'
  | 'recommendation';

export type InsightSeverity = 
  | 'critical'
  | 'warning'
  | 'suggestion'
  | 'info';

export interface AIPrediction {
  id: string;
  serviceId: string;
  metric: string;
  predictedValue: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  predictions: Array<{
    hour: number;
    value: number;
    confidence: number;
  }>;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    command?: string;
    executed?: boolean;
    result?: string;
  };
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// ============================================================================
// AGENTIC AI TYPES
// ============================================================================

export type AgentType = 'infrastructure' | 'monitoring' | 'security' | 'optimization' | 'general';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface AgentStep {
  id: string;
  order: number;
  description: string;
  type: 'analysis' | 'action' | 'decision' | 'verification';
  dependencies: string[];
  status: TaskStatus;
  result?: unknown;
  error?: string;
  executedAt?: string;
  completedAt?: string;
}

export interface AgentPlan {
  id: string;
  goal: string;
  agentType: AgentType;
  steps: AgentStep[];
  status: TaskStatus;
  context: Record<string, unknown>;
  metadata: {
    estimatedSteps: number;
    estimatedDuration: number;
    priority: number;
    requiresApproval: boolean;
  };
  requiresApproval?: boolean;
  result?: {
    success?: boolean;
    message?: string;
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface AgentInfo {
  type: AgentType;
  name: string;
  description: string;
  capabilities: string[];
}

export interface AgentResponse {
  planId?: string;
  agentType?: AgentType;
  status?: TaskStatus;
  summary?: string;
  response?: string;
  suggestedActions?: string[];
  plan?: {
    id?: string;
    goal: string;
    steps?: Array<unknown>;
    requiresApproval?: boolean;
  };
}

// ============================================================================
// SECURITY AUTOMATION TYPES
// ============================================================================

export type VulnSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type VulnStatus = 'open' | 'in_progress' | 'resolved' | 'false_positive' | 'accepted_risk';
export type ScanType = 'container' | 'dependency' | 'configuration' | 'runtime' | 'full';

export interface Vulnerability {
  id: string;
  serviceId: string;
  serviceName: string;
  cveId?: string;
  title: string;
  description: string;
  severity: VulnSeverity;
  cvssScore?: number;
  affectedComponent: string;
  affectedVersion?: string;
  fixedVersion?: string;
  references: string[];
  status: VulnStatus;
  discoveredAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  remediationSteps?: string[];
  autoPatched: boolean;
  patchStatus?: 'pending' | 'in_progress' | 'completed' | 'failed';
  patchError?: string;
}

export interface SecurityScan {
  id: string;
  serviceId: string;
  scanType: ScanType;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  vulnerabilities: Vulnerability[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
  scanDuration?: number;
  scannerVersion: string;
  metadata: Record<string, unknown>;
}

export interface ComplianceCheck {
  id: string;
  serviceId: string;
  framework: string;
  rule: string;
  description: string;
  status: 'compliant' | 'non_compliant' | 'not_applicable';
  severity: VulnSeverity;
  evidence?: string;
  remediation?: string;
  checkedAt: string;
}

export interface SecurityEvent {
  id: string;
  type: 'vulnerability_detected' | 'compliance_violation' | 'anomaly' | 'patch_applied' | 'policy_violation';
  severity: VulnSeverity;
  serviceId: string;
  description: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface SecurityDashboard {
  summary: {
    totalVulnerabilities: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    open: number;
    resolved: number;
  };
  recentScans: SecurityScan[];
  recentEvents: SecurityEvent[];
  topVulnerableServices: Array<{
    serviceId: string;
    serviceName: string;
    vulnerabilityCount: number;
    criticalCount: number;
  }>;
  compliance: {
    totalChecks: number;
    passed: number;
    failed: number;
    complianceRate: number;
  };
}

export interface VulnFilters {
  serviceId?: string;
  status?: VulnStatus;
  severity?: VulnSeverity;
}

export interface EventFilters {
  serviceId?: string;
  type?: SecurityEvent['type'];
  acknowledged?: boolean;
}

export interface PatchResult {
  success: boolean;
  message: string;
  backupCreated?: boolean;
  appliedAt?: string;
}

export interface AutoPatchResult {
  scanned: number;
  patched: number;
  failed: number;
  queued: number;
}

// ============================================================================
// SELF-HEALING TYPES
// ============================================================================

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IssueType = 'crash' | 'error_spike' | 'high_latency' | 'resource_exhaustion' | 'dependency_failure' | 'config_drift' | 'security_anomaly' | 'performance_degradation';
export type HealingMode = 'auto' | 'assisted' | 'monitor';

export interface DetectedIssue {
  id: string;
  serviceId: string;
  serviceName: string;
  type: IssueType;
  severity: IssueSeverity;
  description: string;
  symptoms: string[];
  detectedAt: string;
  status: 'detected' | 'diagnosing' | 'remediating' | 'resolved' | 'failed' | 'escalated';
  metrics: {
    errorRate?: number;
    latencyP95?: number;
    cpuUsage?: number;
    memoryUsage?: number;
    requestCount?: number;
  };
  context: Record<string, unknown>;
}

export interface Diagnosis {
  issueId: string;
  rootCause: string;
  confidence: number;
  affectedServices: string[];
  possibleCauses: string[];
  recommendedActions: Array<{
    action: string;
    confidence: number;
    risk: 'low' | 'medium' | 'high';
    estimatedTimeToFix: number;
  }>;
}

export interface RemediationAction {
  id: string;
  issueId: string;
  action: string;
  type: 'restart' | 'rollback' | 'scale' | 'reconfigure' | 'isolate' | 'notify' | 'custom';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  executedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
  requiresApproval: boolean;
}

export interface HealingRule {
  name: string;
  condition: {
    metric: string;
    operator: '>' | '<' | '=' | '>=' | '<=';
    threshold: number;
    duration: number;
  };
  action: {
    type: RemediationAction['type'];
    params: Record<string, unknown>;
  };
  severity: IssueSeverity;
}

export interface HealingConfig {
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

export interface HealingStatus {
  totalIssues: number;
  resolved: number;
  failed: number;
  autoHealed: number;
  avgTimeToResolution: number;
  bySeverity: Record<IssueSeverity, number>;
  byType: Record<IssueType, number>;
  activeIssues: number;
  activeIssuesList: DetectedIssue[];
}

export interface HealthScore {
  score: number;
  factors: Array<{ name: string; impact: number; status: string }>;
  trend: 'improving' | 'degrading' | 'stable';
}

export interface HealthData {
  status: string;
  errorRate?: number;
  latencyP95?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  requestCount?: number;
  errors?: string[];
}

// ============================================================================
// PREDICTIVE SCALING TYPES
// ============================================================================

export type ForecastHorizon = '15min' | '1hour' | '6hour' | '24hour';

export interface MetricDataPoint {
  timestamp: string;
  value: number;
  metric: string;
  serviceId: string;
  tags: Record<string, string>;
}

export interface TrafficPattern {
  serviceId: string;
  pattern: 'steady' | 'cyclical' | 'trending_up' | 'trending_down' | 'spiky' | 'unpredictable';
  seasonality?: {
    hourly?: boolean;
    daily?: boolean;
    weekly?: boolean;
  };
  confidence: number;
  lastUpdated: string;
}

export interface Forecast {
  serviceId: string;
  metric: string;
  horizon: ForecastHorizon;
  predictions: Array<{
    timestamp: string;
    predictedValue: number;
    confidenceInterval: [number, number];
    confidence: number;
  }>;
  trends: {
    direction: 'up' | 'down' | 'stable';
    magnitude: number;
    anomalyProbability: number;
  };
  generatedAt: string;
}

export interface ScalingRecommendation {
  serviceId: string;
  triggeredBy: string;
  currentCapacity: {
    replicas: number;
    cpuPerReplica: number;
    memoryPerReplica: number;
  };
  recommendedCapacity: {
    replicas: number;
    cpuPerReplica: number;
    memoryPerReplica: number;
    scalingAction: 'scale_up' | 'scale_down' | 'maintain';
    reason: string;
  };
  forecast: Forecast;
  costImpact: {
    current: number;
    predicted: number;
    delta: number;
    deltaPercent: number;
  };
  timing: {
    recommendAt: string;
    executeBy: string;
    expiresAt: string;
  };
  confidence: number;
  risk: 'low' | 'medium' | 'high';
}

export interface ScalingEvent {
  id: string;
  serviceId: string;
  timestamp: string;
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
  triggeredBy: string;
  forecastId?: string;
  result: 'success' | 'partial' | 'failed';
  metricsBefore: Record<string, number>;
  metricsAfter: Record<string, number>;
}

export interface ScalingConfig {
  serviceId: string;
  enabled: boolean;
  minReplicas: number;
  maxReplicas: number;
  targetCpuUtilization: number;
  targetMemoryUtilization: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
  predictiveScaling: boolean;
  forecastHorizon: ForecastHorizon;
  mlConfidenceThreshold: number;
  costOptimization: boolean;
  customSchedules: Array<{
    name: string;
    cron: string;
    action: string;
    params: Record<string, unknown>;
    enabled: boolean;
  }>;
}

export interface ScalingStatus {
  totalEvents: number;
  successful: number;
  failed: number;
  costSavings: number;
  avgScalingTime: number;
  byService: Record<string, number>;
}

export interface PredictiveScalingResult {
  analyzed: number;
  recommendations: number;
  scaled: number;
}

// ============================================================================
// MULTI-CLOUD TYPES
// ============================================================================

export type CloudProvider = 'aws' | 'gcp' | 'azure';
export type ResourceType = 'compute' | 'storage' | 'database' | 'network' | 'serverless' | 'container' | 'load_balancer' | 'dns' | 'cdn' | 'iam';

export interface Credentials {
  accessKeyId?: string;
  secretAccessKey?: string;
  region: string;
  projectId?: string;
  subscriptionId?: string;
  tenantId?: string;
}

export interface CloudConnection {
  id: string;
  provider: CloudProvider;
  name: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  credentials: Credentials;
  metadata: {
    accountId?: string;
    accountName?: string;
    regions: string[];
    services: string[];
  };
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  healthCheck: {
    lastCheck: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
  };
}

export interface CloudResource {
  id: string;
  provider: CloudProvider;
  connectionId: string;
  type: ResourceType;
  name: string;
  region: string;
  status: 'running' | 'stopped' | 'pending' | 'error' | 'terminated';
  metadata: Record<string, unknown>;
  tags: Record<string, string>;
  costPerHour: number;
  createdAt: string;
  updatedAt: string;
  healthStatus: 'healthy' | 'warning' | 'critical';
  metrics?: {
    cpu?: number;
    memory?: number;
    networkIn?: number;
    networkOut?: number;
    diskIO?: number;
  };
}

export interface CostData {
  provider: CloudProvider;
  connectionId: string;
  period: {
    start: string;
    end: string;
  };
  total: number;
  byService: Record<string, number>;
  byRegion: Record<string, number>;
  trends: {
    daily: Array<{ date: string; amount: number }>;
    weekly: Array<{ week: string; amount: number }>;
  };
  forecast: {
    nextMonth: number;
    confidence: number;
  };
}

export interface MultiCloudDeployment {
  id: string;
  name: string;
  strategy: 'active_active' | 'active_passive' | 'multi_region' | 'hybrid';
  services: Array<{
    serviceId: string;
    primaryProvider: CloudProvider;
    failoverProviders: CloudProvider[];
    trafficSplit: Record<CloudProvider, number>;
  }>;
  healthCheck: {
    interval: number;
    timeout: number;
    thresholds: {
      latency: number;
      errorRate: number;
    };
  };
  autoFailover: boolean;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'paused' | 'failed';
}

export interface CrossCloudAnalytics {
  totalConnections: number;
  totalResources: number;
  totalMonthlyCost: number;
  byProvider: Record<CloudProvider, {
    connections: number;
    resources: number;
    cost: number;
  }>;
  recommendations: string[];
}

export interface CloudStatus {
  connections: Array<{
    id: string;
    provider: CloudProvider;
    name: string;
    status: string;
    regions: number;
  }>;
  totalResources: number;
  providerHealth: Record<CloudProvider, {
    status: string;
    latency: number;
    services: number;
  }>;
  costSummary: {
    monthly: number;
    byProvider: Record<CloudProvider, number>;
  };
}

export interface ResourceFilters {
  provider?: CloudProvider;
  type?: ResourceType;
  region?: string;
  status?: string;
}

export interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  resources: CloudResource[];
}

export interface DeploymentConfig {
  name: string;
  strategy: MultiCloudDeployment['strategy'];
  services: MultiCloudDeployment['services'];
  autoFailover?: boolean;
  healthCheckInterval?: number;
}

export interface CloudProviderInfo {
  id: CloudProvider;
  name: string;
  regions: string[];
  services: string[];
}

// ============================================================================
// KUBERNETES TYPES
// ============================================================================

export type K8sProvider = 'aws' | 'gcp' | 'azure' | 'on_premise' | 'minikube' | 'other';

export interface K8sCluster {
  id: string;
  name: string;
  provider: K8sProvider;
  version: string;
  context: string;
  kubeconfig: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  nodes: K8sNode[];
  workloads: K8sWorkload[];
  metrics: {
    cpuCapacity: number;
    cpuUsed: number;
    memoryCapacity: number;
    memoryUsed: number;
    podCapacity: number;
    podUsed: number;
  };
  health: {
    status: 'healthy' | 'warning' | 'critical';
    conditions: string[];
    lastCheck: string;
  };
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
}

export interface K8sNode {
  name: string;
  status: 'Ready' | 'NotReady' | 'SchedulingDisabled';
  role: 'master' | 'worker';
  instanceType?: string;
  capacity: {
    cpu: string;
    memory: string;
    pods: number;
  };
  allocatable: {
    cpu: string;
    memory: string;
    pods: number;
  };
  conditions: Array<{
    type: string;
    status: string;
    reason?: string;
  }>;
  labels: Record<string, string>;
  taints?: Array<{
    key: string;
    value?: string;
    effect: string;
  }>;
  age: string;
}

export type K8sWorkloadType = 'deployment' | 'statefulset' | 'daemonset' | 'job' | 'cronjob' | 'pod';

export interface K8sWorkload {
  id: string;
  clusterId: string;
  namespace: string;
  name: string;
  type: K8sWorkloadType;
  status: 'running' | 'pending' | 'failed' | 'succeeded' | 'unknown';
  replicas: {
    desired: number;
    ready: number;
    available: number;
    unavailable: number;
  };
  images: string[];
  labels: Record<string, string>;
  resources: {
    cpu: { request?: string; limit?: string };
    memory: { request?: string; limit?: string };
  };
  conditions: Array<{
    type: string;
    status: string;
    reason?: string;
  }>;
  age: string;
  pods: K8sPod[];
  strategy?: {
    type: string;
    rollingUpdate?: {
      maxSurge: string;
      maxUnavailable: string;
    };
  };
}

export interface K8sPod {
  name: string;
  namespace: string;
  status: 'Running' | 'Pending' | 'Succeeded' | 'Failed' | 'Unknown' | 'CrashLoopBackOff';
  ready: string;
  restarts: number;
  age: string;
  node?: string;
  ip?: string;
  containers: Array<{
    name: string;
    ready: boolean;
    state: string;
    image: string;
  }>;
  metrics?: {
    cpu: number;
    memory: number;
  };
}

export interface HelmRelease {
  name: string;
  namespace: string;
  chart: string;
  version: string;
  status: 'deployed' | 'failed' | 'pending' | 'superseded' | 'uninstalled';
  updated: string;
  values: Record<string, unknown>;
  revision: number;
}

export interface K8sManifest {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: Record<string, unknown>;
}

export interface ClusterMetrics {
  cpu: { usage: number; capacity: number; percentage: number };
  memory: { usage: number; capacity: number; percentage: number };
  pods: { usage: number; capacity: number; percentage: number };
  network: { in: number; out: number };
  storage: { usage: number; capacity: number };
}

export interface K8sStatus {
  totalClusters: number;
  totalNodes: number;
  totalWorkloads: number;
  totalPods: number;
  healthyClusters: number;
  byProvider: Record<string, number>;
  clusters: Array<{
    id: string;
    name: string;
    provider: K8sProvider;
    version: string;
    status: string;
    nodes: number;
    workloads: number;
    health: string;
  }>;
}

export interface DeployOptions {
  namespace?: string;
  wait?: boolean;
  timeout?: number;
}

export interface DeployResult {
  success: boolean;
  workloadId?: string;
  message: string;
}

export interface LogOptions {
  container?: string;
  lines?: number;
  previous?: boolean;
}

export interface HelmOptions {
  namespace?: string;
  version?: string;
  values?: Record<string, unknown>;
  repo?: string;
}

// ============================================================================
// CI/CD TYPES
// ============================================================================

export type CICDProvider = 'github_actions' | 'gitlab_ci' | 'jenkins' | 'circle_ci' | 'travis' | 'azure_devops';

export interface Pipeline {
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
    schedule?: string;
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
  createdAt: string;
  updatedAt: string;
  enabled: boolean;
}

export interface PipelineStage {
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

export interface PipelineJob {
  id: string;
  name: string;
  type: 'build' | 'test' | 'deploy' | 'scan' | 'notify' | 'custom';
  script: string[];
  image?: string;
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
  timeout: number;
}

export type PipelineRunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'skipped';

export interface TriggerConfig {
  type: 'push' | 'pull_request' | 'schedule' | 'manual' | 'api';
  actor: string;
  commit?: {
    sha: string;
    message: string;
    author: string;
    timestamp: string;
  };
  branch: string;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  runNumber: number;
  status: PipelineRunStatus;
  trigger: TriggerConfig;
  stages: Array<{
    id: string;
    name: string;
    status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
    startedAt?: string;
    completedAt?: string;
    duration?: number;
    jobs: Array<{
      id: string;
      name: string;
      status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
      logs: string[];
      startedAt?: string;
      completedAt?: string;
      duration?: number;
    }>;
  }>;
  startedAt: string;
  completedAt?: string;
  duration?: number;
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

export interface BuildAnalytics {
  pipelineId: string;
  period: {
    start: string;
    end: string;
  };
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  cancelledRuns: number;
  avgDuration: number;
  successRate: number;
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

export interface CICDStatus {
  totalPipelines: number;
  totalRuns: number;
  activeRuns: number;
  successRate: number;
  avgDuration: number;
  byProvider: Record<CICDProvider, number>;
}

export interface PipelineConfig {
  provider: CICDProvider;
  name: string;
  repository: Pipeline['repository'];
  stages: PipelineStage[];
  triggers?: Pipeline['triggers'];
  environmentVariables?: Record<string, string>;
  secrets?: string[];
  notifications?: Pipeline['notifications'];
  enabled?: boolean;
}

export interface WorkflowFile {
  name: string;
  on: Record<string, unknown>;
  jobs: Record<string, unknown>;
  env?: Record<string, string>;
}

export interface CICDProviderInfo {
  id: CICDProvider;
  name: string;
}

export interface CICDDeploymentConfig {
  id?: string;
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
    threshold: number;
  };
  notifications: {
    onStart: boolean;
    onSuccess: boolean;
    onFailure: boolean;
  };
}

// ============================================================================
// DISCORD ADVANCED TYPES
// ============================================================================

export type ContentViolation = 'spam' | 'harassment' | 'hate_speech' | 'nsfw' | 'scam' | 'tos_violation' | 'advertising' | 'off_topic';
export type ModerationAction = 'none' | 'warn' | 'mute' | 'kick' | 'ban' | 'delete' | 'flag';

export interface ModerationRule {
  id: string;
  guildId: string;
  name: string;
  enabled: boolean;
  violations: ContentViolation[];
  thresholds: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    maxScore: number;
  };
  action: ModerationAction;
  duration?: number;
  message?: string;
  autoDelete: boolean;
  notifyMods: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModerationLog {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  userId: string;
  username: string;
  content: string;
  violations: Array<{
    type: ContentViolation;
    confidence: number;
    severity: string;
  }>;
  action: ModerationAction;
  actionTakenBy: 'ai' | 'user' | 'system';
  moderatorId?: string;
  timestamp: string;
  appealed?: boolean;
  appealStatus?: 'pending' | 'approved' | 'rejected';
  aiAnalysis: {
    toxicityScore: number;
    spamScore: number;
    sentiment: 'positive' | 'negative' | 'neutral';
    reasoning: string;
  };
}

export interface ModerationAnalysis {
  violations: Array<{
    type: ContentViolation;
    confidence: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  overallScore: number;
  action: ModerationAction;
  reasoning: string;
}

export interface GuildAnalytics {
  guildId: string;
  period: {
    start: string;
    end: string;
  };
  members: {
    total: number;
    active: number;
    new: number;
    left: number;
    growth: number;
  };
  messages: {
    total: number;
    byChannel: Record<string, number>;
    byHour: Record<number, number>;
    byDay: Record<string, number>;
  };
  engagement: {
    avgMessagesPerUser: number;
    topUsers: Array<{
      userId: string;
      username: string;
      messages: number;
      reactions: number;
    }>;
    voiceMinutes: number;
    reactions: number;
  };
  moderation: {
    violations: number;
    actions: Record<ModerationAction, number>;
    topViolations: Array<{ type: ContentViolation; count: number }>;
  };
  trends: {
    memberGrowth: 'up' | 'down' | 'stable';
    activityTrend: 'up' | 'down' | 'stable';
    sentiment: 'positive' | 'negative' | 'neutral';
  };
  recommendations: string[];
}

export interface Product {
  id: string;
  guildId: string;
  name: string;
  description: string;
  price: number;
  currency: 'USD' | 'EUR' | 'GBP' | 'discord_nitro' | 'points';
  stock: number | 'unlimited';
  imageUrl?: string;
  category: string;
  roles?: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductConfig {
  guildId: string;
  name: string;
  description: string;
  price: number;
  currency: Product['currency'];
  stock?: number | 'unlimited';
  imageUrl?: string;
  category: string;
  roles?: string[];
  enabled?: boolean;
}

export interface Order {
  id: string;
  guildId: string;
  userId: string;
  username: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  total: number;
  currency: string;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  paymentMethod?: string;
  redeemed: boolean;
  redeemedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderConfig {
  guildId: string;
  userId: string;
  username: string;
  items: Order['items'];
  total: number;
  currency: string;
  paymentMethod?: string;
}

export interface UserPoints {
  userId: string;
  guildId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  history: Array<{
    type: 'earned' | 'spent' | 'bonus';
    amount: number;
    reason: string;
    timestamp: string;
  }>;
  lastUpdated: string;
}

export interface AutoResponder {
  id: string;
  guildId: string;
  name: string;
  trigger: {
    type: 'exact' | 'contains' | 'starts_with' | 'regex' | 'ai_intent';
    pattern: string;
    channels?: string[];
    users?: string[];
    cooldown: number;
  };
  response: {
    type: 'text' | 'embed' | 'dm' | 'reaction' | 'action';
    content: string;
    aiGenerated?: boolean;
  };
  enabled: boolean;
  usageCount: number;
  lastTriggered?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutoResponderConfig {
  guildId: string;
  name: string;
  trigger: AutoResponder['trigger'];
  response: AutoResponder['response'];
  enabled?: boolean;
}

export interface DiscordAdvancedStatus {
  moderation: {
    enabled: boolean;
    aiPowered: boolean;
    rules: number;
    logs: number;
  };
  analytics: {
    enabled: boolean;
    tracking: boolean;
  };
  commerce: {
    enabled: boolean;
    products: number;
    orders: number;
    currency: string[];
  };
  autoResponder: {
    enabled: boolean;
  };
}

export interface LogFilters {
  userId?: string;
  action?: ModerationAction;
  startDate?: string;
  endDate?: string;
}

export interface AutoResponse {
  responderName: string;
  response: string;
  type: string;
}

export interface ProcessResult {
  action: ModerationAction;
  violations: ContentViolation[];
  messageDeleted: boolean;
  userNotified: boolean;
  modsNotified: boolean;
}
