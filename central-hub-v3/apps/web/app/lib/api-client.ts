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
  // Dashboard types
  Ticket,
  TicketComment,
  ModerationCase,
  AnalyticsOverview,
  DashboardUser,
  Settings,
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

  // ============================================================================
  // AUTOMATION API
  // ============================================================================
  
  automation: {
    // Get automation status
    getStatus: () => apiClient.get('/automation/status'),
    
    // Get system health
    getHealth: () => apiClient.get('/automation/health'),
    
    // Toggle automation features
    toggleAutoHeal: () => apiClient.post('/automation/auto-heal/toggle'),
    toggleAutoScale: () => apiClient.post('/automation/auto-scale/toggle'),
    toggleAutoDeploy: () => apiClient.post('/automation/auto-deploy/toggle'),
    toggleAlerts: () => apiClient.post('/automation/alerts/toggle'),
    
    // Run automation actions
    healAll: () => apiClient.post('/automation/heal-all'),
    deployAll: (serviceIds?: string[]) => apiClient.post('/automation/deploy-all', { serviceIds }),
    restartAll: (serviceIds?: string[]) => apiClient.post('/automation/restart-all', { serviceIds }),
    syncAll: () => apiClient.post('/automation/sync-all'),
    
    // Get automation history
    getHistory: (limit?: number) => apiClient.get('/automation/history', { params: { limit } }),
    
    // Get automation rules
    getRules: () => apiClient.get('/automation/rules'),
    createRule: (rule: unknown) => apiClient.post('/automation/rules', rule),
    updateRule: (id: string, rule: unknown) => apiClient.patch(`/automation/rules/${id}`, rule),
    deleteRule: (id: string) => apiClient.delete(`/automation/rules/${id}`),
    enableRule: (id: string) => apiClient.post(`/automation/rules/${id}/enable`),
    disableRule: (id: string) => apiClient.post(`/automation/rules/${id}/disable`),
  },

  // ============================================================================
  // SECRETS API
  // ============================================================================
  
  secrets: {
    // Get all secrets
    list: () => apiClient.get('/secrets'),
    
    // Get single secret
    get: (id: string) => apiClient.get(`/secrets/${id}`),
    
    // Create secret
    create: (data: unknown) => apiClient.post('/secrets', data),
    
    // Update secret
    update: (id: string, data: unknown) => apiClient.patch(`/secrets/${id}`, data),
    
    // Delete secret
    delete: (id: string) => apiClient.delete(`/secrets/${id}`),
    
    // Rotate secret (generate new value)
    rotate: (id: string) => apiClient.post(`/secrets/${id}/rotate`),
    
    // Bulk operations
    bulkImport: (secrets: unknown[]) => apiClient.post('/secrets/bulk-import', { secrets }),
    bulkUpdate: (secrets: Record<string, string>) => apiClient.post('/secrets/bulk-update', { secrets }),
    
    // Validate secrets for a service
    validate: (serviceId: string) => apiClient.get(`/secrets/validate/${serviceId}`),
    
    // Get secret categories
    getCategories: () => apiClient.get('/secrets/categories'),
    
    // Export secrets (encrypted)
    export: () => apiClient.get('/secrets/export'),
    
    // Import secrets from file
    import: (file: unknown) => apiClient.post('/secrets/import', file),
  },

  // ============================================================================
  // DEPLOYMENTS API
  // ============================================================================
  
  deployments: {
    // Get deployment configs
    getConfigs: () => apiClient.get('/deployments/configs'),
    
    // Update deployment config
    updateConfig: (serviceId: string, config: unknown) => 
      apiClient.patch(`/deployments/configs/${serviceId}`, config),
    
    // Trigger deployment
    trigger: (serviceId: string, branch?: string) => 
      apiClient.post(`/deployments/trigger`, { serviceId, branch }),
    
    // Get deployment pipeline
    getPipeline: (pipelineId: string) => apiClient.get(`/deployments/pipeline/${pipelineId}`),
    
    // Cancel deployment
    cancel: (pipelineId: string) => apiClient.post(`/deployments/pipeline/${pipelineId}/cancel`),
    
    // Get deployment history
    getHistory: (serviceId: string, limit?: number) => 
      apiClient.get(`/deployments/history/${serviceId}`, { params: { limit } }),
    
    // Get deployment logs
    getLogs: (pipelineId: string, offset?: number) => 
      apiClient.get(`/deployments/pipeline/${pipelineId}/logs`, { params: { offset } }),
    
    // Webhook for external CI/CD
    webhook: (serviceId: string, payload: unknown) => 
      apiClient.post(`/deployments/webhook/${serviceId}`, payload),
  },

  // ============================================================================
  // TEMPLATES API
  // ============================================================================
  
  templates: {
    // Get all templates
    list: () => apiClient.get('/templates'),
    
    // Get template details
    get: (id: string) => apiClient.get(`/templates/${id}`),
    
    // Deploy from template
    deploy: (templateId: string, config: unknown) => 
      apiClient.post(`/templates/${templateId}/deploy`, config),
    
    // Create custom template
    create: (template: unknown) => apiClient.post('/templates', template),
    
    // Update template
    update: (id: string, template: unknown) => apiClient.patch(`/templates/${id}`, template),
    
    // Delete template
    delete: (id: string) => apiClient.delete(`/templates/${id}`),
  },

  // ============================================================================
  // GIT INTEGRATION API
  // ============================================================================
  
  git: {
    // List connected repositories
    listRepositories: () => apiClient.get('/git/repositories'),
    list: () => apiClient.get('/git/repositories'),
    
    // Get repository details
    getRepository: (id: string) => apiClient.get(`/git/repositories/${id}`),
    get: (id: string) => apiClient.get(`/git/repositories/${id}`),
    
    // Connect repository
    connectRepository: (data: unknown) => apiClient.post('/git/repositories', data),
    create: (data: unknown) => apiClient.post('/git/repositories', data),
    
    // Disconnect repository
    disconnectRepository: (id: string) => apiClient.delete(`/git/repositories/${id}`),
    delete: (id: string) => apiClient.delete(`/git/repositories/${id}`),
    
    // List branches
    listBranches: (repoId: string) => apiClient.get(`/git/repositories/${repoId}/branches`),
    
    // Update webhook configuration
    updateWebhook: (repoId: string, config: unknown) => 
      apiClient.patch(`/git/repositories/${repoId}/webhook`, config),
    update: (repoId: string, data: unknown) => 
      apiClient.patch(`/git/repositories/${repoId}`, data),
    
    // Test webhook
    testWebhook: (repoId: string) => apiClient.post(`/git/repositories/${repoId}/webhook/test`),
    
    // Get webhook history
    getWebhookHistory: (repoId: string, limit?: number) => 
      apiClient.get(`/git/repositories/${repoId}/webhook/history`, { params: { limit } }),
  },

  // ============================================================================
  // PIPELINE / DEPLOYMENT API
  // ============================================================================
  
  pipeline: {
    // List pipelines
    list: () => apiClient.get('/pipelines'),
    listByService: (serviceId: string) => apiClient.get(`/pipelines?serviceId=${serviceId}`),
    
    // Get pipeline details
    get: (id: string) => apiClient.get(`/pipelines/${id}`),
    
    // Trigger pipeline
    trigger: (serviceId: string, config?: unknown) => 
      apiClient.post('/pipelines', { serviceId, ...config }),
    
    // Cancel pipeline
    cancel: (id: string) => apiClient.post(`/pipelines/${id}/cancel`),
    
    // Approve pipeline (for manual approval)
    approve: (id: string) => apiClient.post(`/pipelines/${id}/approve`),
    
    // Reject pipeline
    reject: (id: string) => apiClient.post(`/pipelines/${id}/reject`),
    
    // Rollback to previous deployment
    rollback: (id: string, config: unknown) => apiClient.post(`/pipelines/${id}/rollback`, config),
    
    // Get pipeline logs
    getLogs: (id: string, offset?: number) => 
      apiClient.get(`/pipelines/${id}/logs`, { params: { offset } }),
    
    // Stream logs (WebSocket alternative - returns SSE stream)
    streamLogs: (id: string) => apiClient.get(`/pipelines/${id}/logs/stream`),
  },

  // ============================================================================
  // WEBHOOK API (Incoming webhooks from Git providers)
  // ============================================================================
  
  webhook: {
    // Process incoming webhook
    process: (payload: unknown) => apiClient.post('/webhooks/process', payload),
    
    // Get webhook status
    getStatus: (id: string) => apiClient.get(`/webhooks/${id}/status`),
    
    // Validate webhook signature
    validate: (id: string, signature: string, payload: unknown) => 
      apiClient.post(`/webhooks/${id}/validate`, { signature, payload }),
  },

  // ============================================================================
  // CI/CD CONFIG API
  // ============================================================================
  
  cicd: {
    // Get CI/CD configuration for service
    getConfig: (serviceId: string) => apiClient.get(`/cicd/config/${serviceId}`),
    
    // Update CI/CD configuration
    updateConfig: (serviceId: string, config: unknown) => 
      apiClient.put(`/cicd/config/${serviceId}`, config),
    
    // Get CI/CD status
    getStatus: (serviceId: string) => apiClient.get(`/cicd/status/${serviceId}`),
    
    // Trigger CI/CD pipeline
    trigger: (serviceId: string, config?: unknown) => 
      apiClient.post(`/cicd/trigger/${serviceId}`, config),
    
    // Get build history
    getHistory: (serviceId: string, limit?: number) =>
      apiClient.get(`/cicd/history/${serviceId}`, { params: { limit } }),
  },

  // ============================================================================
  // DISCORD SETUP API
  // ============================================================================

  discordSetup: {
    // Get all available server setup templates
    getTemplates: () => apiClient.get('/discord/setup/templates'),

    // Get a specific template by ID
    getTemplate: (templateId: string) =>
      apiClient.get(`/discord/setup/templates/${templateId}`),

    // Generate an AI-driven setup plan from a user prompt
    generatePlan: (data: { guildId: string; userPrompt: string; templateId?: string }) =>
      apiClient.post('/discord/setup/generate-plan', data),

    // Get setup plan details + current status
    getPlan: (setupRunId: string) => apiClient.get(`/discord/setup/${setupRunId}`),

    // Poll execution status
    getStatus: (setupRunId: string) =>
      apiClient.get(`/discord/setup/${setupRunId}/status`),

    // Approve the plan and begin execution
    approve: (setupRunId: string) =>
      apiClient.post(`/discord/setup/${setupRunId}/approve`),

    // Execute all remaining setup steps
    executeAll: (setupRunId: string) =>
      apiClient.post(`/discord/setup/${setupRunId}/execute-all`),

    // Rollback a completed or failed setup
    rollback: (setupRunId: string) =>
      apiClient.post(`/discord/setup/${setupRunId}/rollback`),

    // Use an AI agent to build a fully custom plan
    aiPlan: (data: { guildId: string; goal: string }) =>
      apiClient.post('/discord/setup/ai-plan', data),
  },

  // ============================================================================
  // TICKETS API
  // ============================================================================

  tickets: {
    list: (params?: {
      status?: string;
      priority?: string;
      assignedTo?: string;
      limit?: number;
      offset?: number;
    }) => apiClient.get('/tickets', { params }),
    get: (id: string) => apiClient.get(`/tickets/${id}`),
    create: (data: Partial<Ticket>) => apiClient.post('/tickets', data),
    update: (id: string, data: Partial<Ticket>) =>
      apiClient.patch(`/tickets/${id}`, data),
    delete: (id: string) => apiClient.delete(`/tickets/${id}`),
    assign: (id: string, assignedTo: string) =>
      apiClient.post(`/tickets/${id}/assign`, { assignedTo }),
    comment: (id: string, content: string) =>
      apiClient.post(`/tickets/${id}/comments`, { content }),
  },

  // ============================================================================
  // MODERATION API
  // ============================================================================

  moderation: {
    cases: (params?: {
      action?: string;
      status?: string;
      moderator?: string;
      limit?: number;
      offset?: number;
    }) => apiClient.get('/moderation/cases', { params }),
    getCase: (id: string) => apiClient.get(`/moderation/cases/${id}`),
    createCase: (data: Partial<ModerationCase>) =>
      apiClient.post('/moderation/cases', data),
    updateCase: (id: string, data: Partial<ModerationCase>) =>
      apiClient.patch(`/moderation/cases/${id}`, data),
    resolveCase: (id: string) =>
      apiClient.post(`/moderation/cases/${id}/resolve`),
    appealCase: (id: string, reason: string) =>
      apiClient.post(`/moderation/cases/${id}/appeal`, { reason }),
  },

  // ============================================================================
  // ANALYTICS API
  // ============================================================================

  analytics: {
    overview: (params?: { range?: '24h' | '7d' | '30d' | '90d' }) =>
      apiClient.get('/analytics/overview', { params }),
    messages: (params?: { range?: string }) =>
      apiClient.get('/analytics/messages', { params }),
    users: (params?: { range?: string }) =>
      apiClient.get('/analytics/users', { params }),
    commands: (params?: { range?: string }) =>
      apiClient.get('/analytics/commands', { params }),
    tickets: (params?: { range?: string }) =>
      apiClient.get('/analytics/tickets', { params }),
  },

  // ============================================================================
  // USERS API
  // ============================================================================

  users: {
    list: (params?: {
      role?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }) => apiClient.get('/users', { params }),
    get: (id: string) => apiClient.get(`/users/${id}`),
    update: (id: string, data: Partial<DashboardUser>) =>
      apiClient.patch(`/users/${id}`, data),
    updateRole: (id: string, role: string) =>
      apiClient.patch(`/users/${id}/role`, { role }),
    updateStatus: (id: string, status: string) =>
      apiClient.patch(`/users/${id}/status`, { status }),
    delete: (id: string) => apiClient.delete(`/users/${id}`),
  },

  // ============================================================================
  // SETTINGS API
  // ============================================================================

  settings: {
    get: () => apiClient.get('/settings'),
    update: (data: Partial<Settings>) => apiClient.patch('/settings', data),
    reset: () => apiClient.post('/settings/reset'),
  },

  // ============================================================================
  // AUTH API
  // ============================================================================

  auth: {
    login: (password: string) => apiClient.post('/auth/login', { password }),
    changePassword: (currentPassword: string, newPassword: string) =>
      apiClient.post('/auth/change-password', { currentPassword, newPassword }),
  },

  // ============================================================================
  // AUDIT LOGS API
  // ============================================================================

  auditLogs: {
    list: (params?: {
      limit?: number;
      offset?: number;
      action?: string;
      resourceType?: string;
      resourceId?: string;
      severity?: 'info' | 'warning' | 'error' | 'critical';
    }) => apiClient.get('/audit-logs', { params }),
  },

  // ============================================================================
  // CREDENTIALS API
  // ============================================================================

  credentials: {
    list: () => apiClient.get('/credentials'),
    create: (data: { serviceType: string; name: string; token: string; expiresAt?: string }) =>
      apiClient.post('/credentials', data),
    delete: (id: string) => apiClient.delete(`/credentials/${id}`),
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
  ModerationRule, ModerationLog, GuildAnalytics, Product, Order, UserPoints, AutoResponder,
  Ticket, TicketComment, ModerationCase, AnalyticsOverview, DashboardUser, Settings
};
