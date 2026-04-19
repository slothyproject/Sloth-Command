/**
 * API Client
 * Axios instance with interceptors for auth and error handling
 * Extended for Central Hub v4.0 - Complete API coverage
 */

import axios from 'axios';
import { useAuthStore } from '@/app/stores/auth-store';
import type {
  // Agent types
  AgentPlan,
  AgentStep,
  AgentType,
  AgentInfo,
  AgentResponse,
  TaskStatus,
  // Security types
  Vulnerability,
  VulnFilters,
  VulnSeverity,
  VulnStatus,
  SecurityScan,
  ScanType,
  ComplianceCheck,
  SecurityEvent,
  EventFilters,
  SecurityDashboard,
  PatchResult,
  AutoPatchResult,
  // Healing types
  DetectedIssue,
  IssueSeverity,
  IssueType,
  HealingMode,
  Diagnosis,
  RemediationAction,
  HealingConfig,
  HealingRule,
  HealingStatus,
  HealthScore,
  HealthData,
  // Scaling types
  MetricDataPoint,
  TrafficPattern,
  Forecast,
  ForecastHorizon,
  ScalingRecommendation,
  ScalingEvent,
  ScalingConfig,
  ScalingStatus,
  // Cloud types
  CloudProvider,
  CloudConnection,
  CloudResource,
  ResourceType,
  CostData,
  MultiCloudDeployment,
  CrossCloudAnalytics,
  CloudStatus,
  ResourceFilters,
  Credentials,
  SyncResult,
  DeploymentConfig,
  // Kubernetes types
  K8sCluster,
  K8sNode,
  K8sWorkload,
  K8sPod,
  K8sManifest,
  HelmRelease,
  ClusterMetrics,
  K8sStatus,
  DeployOptions,
  DeployResult,
  LogOptions,
  HelmOptions,
  // CI/CD types
  CICDProvider,
  Pipeline,
  PipelineConfig,
  PipelineStage,
  PipelineJob,
  PipelineRun,
  PipelineRunStatus,
  TriggerConfig,
  BuildAnalytics,
  CICDStatus,
  DeploymentConfig as CICDDeploymentConfig,
  WorkflowFile,
  // Discord Advanced types
  ModerationRule,
  ModerationLog,
  ModerationAnalysis,
  ContentViolation,
  ModerationAction,
  GuildAnalytics,
  Product,
  ProductConfig,
  Order,
  OrderConfig,
  UserPoints,
  AutoResponder,
  AutoResponderConfig,
  DiscordAdvancedStatus,
  LogFilters,
  AutoResponse,
  ProcessResult,
} from '@/app/types';

// API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://central-hub-api-production.up.railway.app/api';

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const tokens = useAuthStore.getState().tokens;
    if (tokens?.access) {
      config.headers.Authorization = `Bearer ${tokens.access}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const authStore = useAuthStore.getState();
        await authStore.refreshToken();
        
        // Retry the original request with new token
        const newTokens = authStore.tokens;
        if (newTokens?.access) {
          originalRequest.headers.Authorization = `Bearer ${newTokens.access}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// ============================================================================
// API HELPER FUNCTIONS
// ============================================================================

export const api = {
  // Services
  services: {
    list: () => apiClient.get('/services'),
    get: (id: string) => apiClient.get(`/services/${id}`),
    create: (data: unknown) => apiClient.post('/services', data),
    update: (id: string, data: unknown) => apiClient.patch(`/services/${id}`, data),
    delete: (id: string) => apiClient.delete(`/services/${id}`),
    sync: () => apiClient.post('/services/sync'),
    deploy: (id: string) => apiClient.post(`/services/${id}/deploy`),
    restart: (id: string) => apiClient.post(`/services/${id}/restart`),
  },
  
  // Variables
  variables: {
    list: (serviceId: string) => apiClient.get(`/services/${serviceId}/variables`),
    create: (serviceId: string, data: unknown) => 
      apiClient.post(`/services/${serviceId}/variables`, data),
    update: (serviceId: string, variableId: string, data: unknown) => 
      apiClient.patch(`/services/${serviceId}/variables/${variableId}`, data),
    delete: (serviceId: string, variableId: string) => 
      apiClient.delete(`/services/${serviceId}/variables/${variableId}`),
    bulkUpdate: (serviceId: string, variables: Record<string, string>) => 
      apiClient.post(`/services/${serviceId}/variables/bulk`, { variables }),
  },
  
  // Deployments
  deployments: {
    list: (serviceId: string) => apiClient.get(`/services/${serviceId}/deployments`),
    get: (serviceId: string, deploymentId: string) => 
      apiClient.get(`/services/${serviceId}/deployments/${deploymentId}`),
    logs: (serviceId: string, deploymentId: string) => 
      apiClient.get(`/services/${serviceId}/deployments/${deploymentId}/logs`),
  },
  
  // AI
  ai: {
    analyze: (serviceId: string) => apiClient.get(`/ai/analyze/${serviceId}`),
    predict: (serviceId: string, hours = 24) =>
      apiClient.get(`/ai/predict/${serviceId}?hours=${hours}`),
    insights: (serviceId: string) => apiClient.get(`/ai/insights/${serviceId}`),
    chat: (message: string) => apiClient.post('/ai/chat', { message }),
    fix: (insightId: string) => apiClient.post(`/ai/fix/${insightId}`),
  },

  // ============================================================================
  // AGENTIC AI API
  // ============================================================================
  
  agents: {
    // Get available agents and their capabilities
    list: () => apiClient.get('/agents'),
    
    // Process a natural language request
    processRequest: (request: string, context?: Record<string, unknown>) => 
      apiClient.post('/agents/process', { request, context }),
    
    // Create a new execution plan
    createPlan: (goal: string, agentType?: AgentType, context?: Record<string, unknown>) => 
      apiClient.post('/agents/plans', { goal, agentType, context }),
    
    // Get all active plans
    getPlans: () => apiClient.get('/agents/plans'),
    
    // Get specific plan details
    getPlan: (planId: string) => apiClient.get(`/agents/plans/${planId}`),
    
    // Execute a plan
    executePlan: (planId: string) => apiClient.post(`/agents/plans/${planId}/execute`),
    
    // Approve or reject a plan
    approvePlan: (planId: string, approved: boolean) => 
      apiClient.post(`/agents/plans/${planId}/approve`, { approved }),
    
    // Cancel a plan
    cancelPlan: (planId: string) => apiClient.post(`/agents/plans/${planId}/cancel`),
    
    // Replan based on new information
    replan: (planId: string, reason: string) => 
      apiClient.post(`/agents/plans/${planId}/replan`, { reason }),
    
    // Get capabilities for an agent type
    getCapabilities: (type: AgentType) => apiClient.get(`/agents/types/${type}/capabilities`),
  },

  // ============================================================================
  // SECURITY AUTOMATION API
  // ============================================================================
  
  security: {
    // Get security dashboard overview
    getDashboard: () => apiClient.get('/security/dashboard'),
    
    // Vulnerabilities
    getVulnerabilities: (filters?: VulnFilters) => 
      apiClient.get('/security/vulnerabilities', { params: filters }),
    
    getVulnerability: (id: string) => apiClient.get(`/security/vulnerabilities/${id}`),
    
    // Apply patch for a vulnerability
    applyPatch: (id: string, options?: { backup?: boolean; testInStaging?: boolean }) => 
      apiClient.post(`/security/vulnerabilities/${id}/patch`, options),
    
    // Security scans
    getScans: (serviceId?: string, limit?: number) => 
      apiClient.get('/security/scans', { params: { serviceId, limit } }),
    
    getScan: (id: string) => apiClient.get(`/security/scans/${id}`),
    
    runScan: (serviceId: string, scanType?: ScanType) => 
      apiClient.post('/security/scans', { serviceId, scanType }),
    
    // Compliance
    runComplianceCheck: (serviceId: string, framework?: string) => 
      apiClient.post('/security/compliance/check', { serviceId, framework }),
    
    // Security events
    getEvents: (filters?: EventFilters, limit?: number) => 
      apiClient.get('/security/events', { params: { ...filters, limit } }),
    
    acknowledgeEvent: (eventId: string, acknowledgedBy: string) => 
      apiClient.post(`/security/events/${eventId}/acknowledge`, { acknowledgedBy }),
    
    // Auto-patching
    autoPatch: (serviceId?: string) => apiClient.post('/security/auto-patch', { serviceId }),
    
    // Scheduled scans
    runScheduledScans: () => apiClient.post('/security/scheduled-scan'),
  },

  // ============================================================================
  // SELF-HEALING API
  // ============================================================================
  
  healing: {
    // Get self-healing system status
    getStatus: () => apiClient.get('/healing/status'),
    
    // Issues
    getIssues: () => apiClient.get('/healing/issues'),
    
    getIssue: (id: string) => apiClient.get(`/healing/issues/${id}`),
    
    // Diagnose an issue
    diagnoseIssue: (id: string) => apiClient.post(`/healing/issues/${id}/diagnose`),
    
    // Execute remediation
    remediate: (id: string, action: string, type?: string, params?: Record<string, unknown>) => 
      apiClient.post(`/healing/issues/${id}/remediate`, { action, type, params }),
    
    // Health score
    getHealthScore: (serviceId: string) => apiClient.get(`/healing/health-score/${serviceId}`),
    
    // Configuration
    getHealingConfig: (serviceId: string) => apiClient.get(`/healing/config/${serviceId}`),
    
    setHealingConfig: (serviceId: string, config: Partial<HealingConfig>) => 
      apiClient.put(`/healing/config/${serviceId}`, config),
    
    // Manual issue detection
    detectIssues: (serviceId: string, healthData: HealthData) => 
      apiClient.post('/healing/detect', { serviceId, healthData }),
  },

  // ============================================================================
  // PREDICTIVE SCALING API
  // ============================================================================
  
  scaling: {
    // Get scaling system status
    getStatus: () => apiClient.get('/scaling/status'),
    
    // Metrics
    getMetrics: (serviceId: string, metric: string, hours?: number) => 
      apiClient.get(`/scaling/services/${serviceId}/metrics`, { params: { metric, hours } }),
    
    storeMetric: (serviceId: string, metric: string, value: number, tags?: Record<string, string>) => 
      apiClient.post(`/scaling/services/${serviceId}/metrics`, { metric, value, tags }),
    
    // Traffic patterns
    getPattern: (serviceId: string) => apiClient.get(`/scaling/services/${serviceId}/pattern`),
    
    // Forecasting
    generateForecast: (serviceId: string, metric?: string, horizon?: ForecastHorizon) => 
      apiClient.post(`/scaling/services/${serviceId}/forecast`, { metric, horizon }),
    
    // Recommendations
    getRecommendation: (serviceId: string) => apiClient.get(`/scaling/services/${serviceId}/recommendation`),
    
    generateRecommendation: (serviceId: string) => 
      apiClient.post(`/scaling/services/${serviceId}/recommendation`),
    
    // Scaling actions
    executeScaling: (serviceId: string, targetReplicas: number, triggeredBy?: string) => 
      apiClient.post(`/scaling/services/${serviceId}/scale`, { targetReplicas, triggeredBy }),
    
    // History
    getHistory: (serviceId: string, limit?: number) => 
      apiClient.get(`/scaling/services/${serviceId}/history`, { params: { limit } }),
    
    // Configuration
    getConfig: (serviceId: string) => apiClient.get(`/scaling/config/${serviceId}`),
    
    setConfig: (serviceId: string, config: Partial<ScalingConfig>) => 
      apiClient.put(`/scaling/config/${serviceId}`, config),
    
    // Run predictive scaling for all services
    runPredictive: () => apiClient.post('/scaling/run-predictive'),
  },

  // ============================================================================
  // MULTI-CLOUD API
  // ============================================================================
  
  cloud: {
    // Status
    getStatus: () => apiClient.get('/cloud/status'),
    
    // Providers
    getProviders: () => apiClient.get('/cloud/providers'),
    
    // Connections
    getConnections: () => apiClient.get('/cloud/connections'),
    
    getConnection: (id: string) => apiClient.get(`/cloud/connections/${id}`),
    
    addConnection: (provider: CloudProvider, name: string, credentials: Credentials) => 
      apiClient.post('/cloud/connections', { provider, name, credentials }),
    
    removeConnection: (id: string) => apiClient.delete(`/cloud/connections/${id}`),
    
    syncResources: (id: string) => apiClient.post(`/cloud/connections/${id}/sync`),
    
    // Resources
    getResources: (filters?: ResourceFilters) => 
      apiClient.get('/cloud/resources', { params: filters }),
    
    getResource: (id: string) => apiClient.get(`/cloud/resources/${id}`),
    
    // Cost data
    getCostData: (connectionId: string, days?: number) => 
      apiClient.get(`/cloud/connections/${connectionId}/costs`, { params: { days } }),
    
    // Analytics
    getAnalytics: () => apiClient.get('/cloud/analytics'),
    
    // Multi-cloud deployments
    getDeployments: () => apiClient.get('/cloud/deployments'),
    
    createDeployment: (deployment: DeploymentConfig) => 
      apiClient.post('/cloud/deployments', deployment),
    
    executeFailover: (id: string, from: CloudProvider, to: CloudProvider) => 
      apiClient.post(`/cloud/deployments/${id}/failover`, { from, to }),
  },

  // ============================================================================
  // KUBERNETES API
  // ============================================================================
  
  kubernetes: {
    // Status
    getStatus: () => apiClient.get('/kubernetes/status'),
    
    // Clusters
    getClusters: () => apiClient.get('/kubernetes/clusters'),
    
    getCluster: (id: string) => apiClient.get(`/kubernetes/clusters/${id}`),
    
    addCluster: (name: string, provider: string, kubeconfig: string, context?: string) => 
      apiClient.post('/kubernetes/clusters', { name, provider, kubeconfig, context }),
    
    syncCluster: (id: string) => apiClient.post(`/kubernetes/clusters/${id}/sync`),
    
    // Nodes
    getNodes: (id: string) => apiClient.get(`/kubernetes/clusters/${id}/nodes`),
    
    // Workloads
    getWorkloads: (id: string) => apiClient.get(`/kubernetes/clusters/${id}/workloads`),
    
    deployWorkload: (id: string, manifest: K8sManifest, options?: DeployOptions) => 
      apiClient.post(`/kubernetes/clusters/${id}/deploy`, { manifest, ...options }),
    
    scaleWorkload: (workloadId: string, replicas: number) => 
      apiClient.post(`/kubernetes/workloads/${workloadId}/scale`, { replicas }),
    
    deleteWorkload: (workloadId: string) => apiClient.delete(`/kubernetes/workloads/${workloadId}`),
    
    // Logs
    getLogs: (workloadId: string, lines?: number) => 
      apiClient.get(`/kubernetes/workloads/${workloadId}/logs`, { params: { lines } }),
    
    // Metrics
    getMetrics: (id: string) => apiClient.get(`/kubernetes/clusters/${id}/metrics`),
    
    // Helm
    getHelmReleases: (id: string) => apiClient.get(`/kubernetes/clusters/${id}/helm`),
    
    installHelmChart: (id: string, chart: string, releaseName: string, options?: HelmOptions) => 
      apiClient.post(`/kubernetes/clusters/${id}/helm/install`, { chart, releaseName, ...options }),
  },

  // ============================================================================
  // CI/CD API
  // ============================================================================
  
  cicd: {
    // Status
    getStatus: () => apiClient.get('/cicd/status'),
    
    // Providers
    getProviders: () => apiClient.get('/cicd/providers'),
    
    // Pipelines
    getPipelines: () => apiClient.get('/cicd/pipelines'),
    
    getPipeline: (id: string) => apiClient.get(`/cicd/pipelines/${id}`),
    
    createPipeline: (pipeline: PipelineConfig) => apiClient.post('/cicd/pipelines', pipeline),
    
    updatePipeline: (id: string, updates: Partial<Pipeline>) => 
      apiClient.put(`/cicd/pipelines/${id}`, updates),
    
    deletePipeline: (id: string) => apiClient.delete(`/cicd/pipelines/${id}`),
    
    // Pipeline runs
    triggerPipeline: (id: string, trigger: TriggerConfig, variables?: Record<string, unknown>) => 
      apiClient.post(`/cicd/pipelines/${id}/trigger`, { trigger, variables }),
    
    getPipelineRuns: (id: string, limit?: number) => 
      apiClient.get(`/cicd/pipelines/${id}/runs`, { params: { limit } }),
    
    getPipelineRun: (runId: string) => apiClient.get(`/cicd/runs/${runId}`),
    
    cancelPipelineRun: (runId: string) => apiClient.post(`/cicd/runs/${runId}/cancel`),
    
    // Logs
    getJobLogs: (runId: string, jobId: string) => 
      apiClient.get('/cicd/runs/logs', { params: { runId, jobId } }),
    
    // Workflows
    generateWorkflow: (id: string, format: 'github' | 'gitlab') => 
      apiClient.get(`/cicd/pipelines/${id}/workflow`, { params: { format } }),
    
    // Analytics
    getAnalytics: (id: string, days?: number) => 
      apiClient.get(`/cicd/pipelines/${id}/analytics`, { params: { days } }),
    
    // Deployments
    getDeploymentConfigs: (pipelineId?: string) => 
      apiClient.get('/cicd/deployments', { params: { pipelineId } }),
    
    createDeploymentConfig: (config: CICDDeploymentConfig) => 
      apiClient.post('/cicd/deployments', config),
  },

  // ============================================================================
  // DISCORD ADVANCED API
  // ============================================================================
  
  discordAdvanced: {
    // Status
    getStatus: () => apiClient.get('/discord/advanced/status'),
    
    // Moderation
    analyzeMessage: (content: string, context?: Record<string, unknown>) => 
      apiClient.post('/discord/advanced/moderation/analyze', { content, context }),
    
    getModerationRules: (guildId: string) => 
      apiClient.get('/discord/advanced/moderation/rules', { params: { guildId } }),
    
    createModerationRule: (rule: Partial<ModerationRule>) => 
      apiClient.post('/discord/advanced/moderation/rules', rule),
    
    getModerationLogs: (guildId: string, filters?: LogFilters) => 
      apiClient.get('/discord/advanced/moderation/logs', { params: { guildId, ...filters } }),
    
    processMessage: (content: string, guildId: string, userId: string, username: string, channelId: string, messageId?: string) => 
      apiClient.post('/discord/advanced/moderation/process', { 
        content, guildId, userId, username, channelId, messageId 
      }),
    
    // Analytics
    trackMessage: (guildId: string, channelId: string, userId: string, timestamp?: string) => 
      apiClient.post('/discord/advanced/analytics/track', { guildId, channelId, userId, timestamp }),
    
    getGuildAnalytics: (guildId: string, days?: number) => 
      apiClient.get(`/discord/advanced/analytics/guild/${guildId}`, { params: { days } }),
    
    // Commerce
    getProducts: (guildId: string) => 
      apiClient.get('/discord/advanced/commerce/products', { params: { guildId } }),
    
    createProduct: (product: Partial<Product>) => 
      apiClient.post('/discord/advanced/commerce/products', product),
    
    createOrder: (order: Partial<Order>) => 
      apiClient.post('/discord/advanced/commerce/orders', order),
    
    getUserPoints: (userId: string, guildId: string) => 
      apiClient.get(`/discord/advanced/commerce/points/${userId}`, { params: { guildId } }),
    
    awardPoints: (userId: string, guildId: string, amount: number, reason: string) => 
      apiClient.post('/discord/advanced/commerce/points/award', { userId, guildId, amount, reason }),
    
    // Auto-responder
    getAutoResponders: (guildId: string) => 
      apiClient.get('/discord/advanced/responders', { params: { guildId } }),
    
    createAutoResponder: (responder: Partial<AutoResponder>) => 
      apiClient.post('/discord/advanced/responders', responder),
    
    processAutoResponders: (content: string, guildId: string, channelId: string) => 
      apiClient.post('/discord/advanced/responders/process', { content, guildId, channelId }),
  },
};

// Export types for convenience
export type { 
  AgentPlan, AgentStep, AgentType, AgentInfo,
  Vulnerability, VulnSeverity, VulnStatus, SecurityScan, SecurityDashboard,
  DetectedIssue, IssueSeverity, IssueType, HealingMode, Diagnosis, HealingConfig,
  MetricDataPoint, Forecast, ForecastHorizon, ScalingRecommendation, ScalingConfig,
  CloudProvider, CloudConnection, CloudResource, ResourceType, CostData,
  K8sCluster, K8sNode, K8sWorkload, K8sPod, HelmRelease,
  CICDProvider, Pipeline, PipelineRun, BuildAnalytics,
  ModerationRule, ModerationLog, GuildAnalytics, Product, Order, UserPoints, AutoResponder
};
