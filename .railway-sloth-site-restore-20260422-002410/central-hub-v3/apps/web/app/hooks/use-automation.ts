/**
 * Automation Hooks
 * Hooks for mission control and automation features
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';

// ============================================================================
// AUTOMATION STATUS & ACTIONS
// ============================================================================

export interface AutomationStatus {
  autoHealEnabled: boolean;
  autoScaleEnabled: boolean;
  autoDeployEnabled: boolean;
  alertsEnabled: boolean;
  activeAutomations: number;
  recentActivity: AutomationActivity[];
}

export interface AutomationActivity {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;
  serviceId?: string;
  serviceName?: string;
}

export interface SystemHealth {
  overallCpu: number;
  overallMemory: number;
  overallDisk: number;
  networkRx: number;
  networkTx: number;
  activeConnections: number;
  uptime: number;
}

const automationKeys = {
  all: ['automation'] as const,
  status: () => [...automationKeys.all, 'status'] as const,
  health: () => [...automationKeys.all, 'health'] as const,
};

// Get automation status
export function useAutomationStatus() {
  return useQuery({
    queryKey: automationKeys.status(),
    queryFn: async () => {
      const response = await api.automation?.getStatus?.() || { data: { 
        autoHealEnabled: true,
        autoScaleEnabled: false,
        autoDeployEnabled: false,
        alertsEnabled: true,
        activeAutomations: 0,
        recentActivity: []
      }};
      return response.data as AutomationStatus;
    },
    staleTime: 10000,
    refetchInterval: 30000,
  });
}

// Get system health
export function useSystemHealth() {
  return useQuery({
    queryKey: automationKeys.health(),
    queryFn: async () => {
      const response = await api.automation?.getHealth?.() || { data: {
        overallCpu: 0,
        overallMemory: 0,
        overallDisk: 0,
        networkRx: 0,
        networkTx: 0,
        activeConnections: 0,
        uptime: 0
      }};
      return response.data as SystemHealth;
    },
    staleTime: 5000,
    refetchInterval: 15000,
  });
}

// Automation actions
export function useAutomationActions() {
  const queryClient = useQueryClient();
  
  const toggleAutoHeal = useMutation({
    mutationFn: async () => {
      const response = await api.automation?.toggleAutoHeal?.() || { data: { enabled: true }};
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: automationKeys.status() });
    },
  });
  
  const toggleAutoScale = useMutation({
    mutationFn: async () => {
      const response = await api.automation?.toggleAutoScale?.() || { data: { enabled: false }};
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: automationKeys.status() });
    },
  });
  
  const toggleAutoDeploy = useMutation({
    mutationFn: async () => {
      const response = await api.automation?.toggleAutoDeploy?.() || { data: { enabled: false }};
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: automationKeys.status() });
    },
  });
  
  const toggleAlerts = useMutation({
    mutationFn: async () => {
      const response = await api.automation?.toggleAlerts?.() || { data: { enabled: true }};
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: automationKeys.status() });
    },
  });
  
  const healAll = useMutation({
    mutationFn: async () => {
      const response = await api.healing?.runAutoHeal?.() || { data: { healed: 0 }};
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['healing'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
  
  const deployAll = useMutation({
    mutationFn: async (serviceIds: string[]) => {
      const results = await Promise.all(
        serviceIds.map(id => api.services.deploy(id))
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
  
  const restartAll = useMutation({
    mutationFn: async (serviceIds: string[]) => {
      const results = await Promise.all(
        serviceIds.map(id => api.services.restart(id))
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
  
  return {
    toggleAutoHeal,
    toggleAutoScale,
    toggleAutoDeploy,
    toggleAlerts,
    healAll,
    deployAll,
    restartAll,
  };
}

// ============================================================================
// HEALING HOOKS
// ============================================================================

export interface HealingStatus {
  active: boolean;
  activeIssues: number;
  resolved: number;
  autoHealed: number;
  avgTimeToResolution: number;
  lastCheck: string;
}

export interface DetectedIssue {
  id: string;
  serviceId: string;
  serviceName: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  detectedAt: string;
  resolvedAt?: string;
  autoHealAttempted: boolean;
  diagnosis?: {
    rootCause: string;
    recommendedActions: string[];
  };
}

const healingKeys = {
  all: ['healing'] as const,
  status: () => [...healingKeys.all, 'status'] as const,
  issues: () => [...healingKeys.all, 'issues'] as const,
  issue: (id: string) => [...healingKeys.all, 'issue', id] as const,
};

// Get healing status
export function useHealingStatus() {
  return useQuery({
    queryKey: healingKeys.status(),
    queryFn: async () => {
      const response = await api.healing.getStatus();
      return response.data as HealingStatus;
    },
    staleTime: 5000,
    refetchInterval: 15000,
  });
}

// Get healing issues
export function useHealingIssues() {
  return useQuery({
    queryKey: healingKeys.issues(),
    queryFn: async () => {
      const response = await api.healing.getIssues();
      return response.data as DetectedIssue[];
    },
    staleTime: 5000,
    refetchInterval: 15000,
  });
}

// Healing mutations
export function useHealingMutations() {
  const queryClient = useQueryClient();
  
  const diagnoseIssue = useMutation({
    mutationFn: (issueId: string) => api.healing.diagnoseIssue(issueId),
    onSuccess: (_, issueId) => {
      queryClient.invalidateQueries({ queryKey: healingKeys.issue(issueId) });
    },
  });
  
  const remediateIssue = useMutation({
    mutationFn: ({ issueId, action }: { issueId: string; action: string }) =>
      api.healing.remediate(issueId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healingKeys.issues() });
      queryClient.invalidateQueries({ queryKey: healingKeys.status() });
    },
  });
  
  return {
    diagnoseIssue,
    remediateIssue,
  };
}

// ============================================================================
// SECRETS HOOKS
// ============================================================================

export interface Secret {
  id: string;
  key: string;
  value?: string;
  serviceId?: string;
  serviceName?: string;
  category: 'discord' | 'database' | 'api' | 'jwt' | 'oauth' | 'other';
  isEncrypted: boolean;
  required: boolean;
  description?: string;
  lastRotated?: string;
  createdAt: string;
  updatedAt: string;
}

const secretsKeys = {
  all: ['secrets'] as const,
  lists: () => [...secretsKeys.all, 'list'] as const,
  detail: (id: string) => [...secretsKeys.all, 'detail', id] as const,
};

// Get all secrets
export function useSecrets() {
  return useQuery({
    queryKey: secretsKeys.lists(),
    queryFn: async () => {
      const response = await api.secrets?.list?.() || { data: [] };
      return response.data as Secret[];
    },
    staleTime: 30000,
  });
}

// Get secret by ID
export function useSecret(id: string) {
  return useQuery({
    queryKey: secretsKeys.detail(id),
    queryFn: async () => {
      const response = await api.secrets?.get?.(id) || { data: null };
      return response.data as Secret;
    },
    enabled: !!id,
  });
}

// Secret mutations
export function useCreateSecret() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Omit<Secret, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.secrets?.create?.(data) || Promise.resolve({ data: { id: 'temp' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: secretsKeys.lists() });
    },
  });
}

export function useUpdateSecret() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Secret> }) =>
      api.secrets?.update?.(id, data) || Promise.resolve({ data: {} }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: secretsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: secretsKeys.detail(id) });
    },
  });
}

export function useDeleteSecret() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) =>
      api.secrets?.delete?.(id) || Promise.resolve({ data: {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: secretsKeys.lists() });
    },
  });
}

export function useRotateSecret() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) =>
      api.secrets?.rotate?.(id) || Promise.resolve({ data: {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: secretsKeys.lists() });
    },
  });
}

export function useBulkImportSecrets() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (secrets: Omit<Secret, 'id' | 'createdAt' | 'updatedAt'>[]) =>
      api.secrets?.bulkImport?.(secrets) || Promise.resolve({ data: { imported: secrets.length } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: secretsKeys.lists() });
    },
  });
}

// ============================================================================
// AUTO-DEPLOYMENT HOOKS
// ============================================================================

export interface DeploymentConfig {
  id: string;
  serviceId: string;
  serviceName: string;
  autoDeploy: boolean;
  deployBranch: string;
  requireApproval: boolean;
  stagingEnabled: boolean;
  webhookUrl?: string;
  lastDeployment?: {
    id: string;
    status: 'success' | 'failed' | 'in_progress';
    startedAt: string;
    completedAt?: string;
  };
}

export interface DeploymentPipeline {
  id: string;
  serviceId: string;
  status: 'pending' | 'building' | 'testing' | 'deploying' | 'completed' | 'failed';
  stage: string;
  progress: number;
  logs: string[];
  startedAt: string;
  estimatedCompletion?: string;
}

const deploymentKeys = {
  all: ['deployments'] as const,
  configs: () => [...deploymentKeys.all, 'configs'] as const,
  pipeline: (id: string) => [...deploymentKeys.all, 'pipeline', id] as const,
  history: (serviceId: string) => [...deploymentKeys.all, 'history', serviceId] as const,
};

// Get deployment configurations
export function useDeploymentConfigs() {
  return useQuery({
    queryKey: deploymentKeys.configs(),
    queryFn: async () => {
      const response = await api.deployments?.getConfigs?.() || { data: [] };
      return response.data as DeploymentConfig[];
    },
    staleTime: 60000,
  });
}

// Get deployment pipeline status
export function useDeploymentPipeline(pipelineId: string) {
  return useQuery({
    queryKey: deploymentKeys.pipeline(pipelineId),
    queryFn: async () => {
      const response = await api.deployments?.getPipeline?.(pipelineId) || { data: null };
      return response.data as DeploymentPipeline;
    },
    enabled: !!pipelineId,
    refetchInterval: (data) => {
      if (data?.status === 'completed' || data?.status === 'failed') return false;
      return 2000; // Poll every 2 seconds while active
    },
  });
}

// Deployment mutations
export function useDeploymentMutations() {
  const queryClient = useQueryClient();
  
  const updateConfig = useMutation({
    mutationFn: ({ serviceId, config }: { serviceId: string; config: Partial<DeploymentConfig> }) =>
      api.deployments?.updateConfig?.(serviceId, config) || Promise.resolve({ data: {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deploymentKeys.configs() });
    },
  });
  
  const triggerDeployment = useMutation({
    mutationFn: ({ serviceId, branch }: { serviceId: string; branch?: string }) =>
      api.deployments?.trigger?.(serviceId, branch) || api.services.deploy(serviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
  
  const cancelDeployment = useMutation({
    mutationFn: (pipelineId: string) =>
      api.deployments?.cancel?.(pipelineId) || Promise.resolve({ data: {} }),
    onSuccess: (_, pipelineId) => {
      queryClient.invalidateQueries({ queryKey: deploymentKeys.pipeline(pipelineId) });
    },
  });
  
  return {
    updateConfig,
    triggerDeployment,
    cancelDeployment,
  };
}

// ============================================================================
// SERVICE TEMPLATES HOOKS
// ============================================================================

export interface ServiceTemplate {
  id: string;
  name: string;
  description: string;
  type: 'discord-bot' | 'api-backend' | 'website' | 'database';
  icon: string;
  defaultConfig: {
    variables: Array<{
      key: string;
      description: string;
      required: boolean;
      category: string;
    }>;
    healthCheck?: {
      endpoint: string;
      interval: number;
    };
    healingRules?: Array<{
      condition: string;
      action: string;
    }>;
  };
  estimatedDeployTime: number;
}

const templatesKeys = {
  all: ['templates'] as const,
  lists: () => [...templatesKeys.all, 'list'] as const,
  detail: (id: string) => [...templatesKeys.all, 'detail', id] as const,
};

// Get service templates
export function useServiceTemplates() {
  return useQuery({
    queryKey: templatesKeys.lists(),
    queryFn: async () => {
      const response = await api.templates?.list?.() || { data: getDefaultTemplates() };
      return response.data as ServiceTemplate[];
    },
    staleTime: Infinity, // Templates rarely change
  });
}

// Get template by ID
export function useServiceTemplate(id: string) {
  return useQuery({
    queryKey: templatesKeys.detail(id),
    queryFn: async () => {
      const response = await api.templates?.get?.(id) || { data: null };
      return response.data as ServiceTemplate;
    },
    enabled: !!id,
  });
}

// Create service from template
export function useCreateFromTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ 
      templateId, 
      name, 
      variables 
    }: { 
      templateId: string; 
      name: string; 
      variables: Record<string, string>;
    }) =>
      api.templates?.deploy?.(templateId, { name, variables }) || 
      api.services.create({ name, templateId, variables }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

// Default templates
function getDefaultTemplates(): ServiceTemplate[] {
  return [
    {
      id: 'discord-bot',
      name: 'Discord Bot',
      description: 'Automated Discord bot with slash commands, events, and persistent storage',
      type: 'discord-bot',
      icon: '🤖',
      defaultConfig: {
        variables: [
          { key: 'DISCORD_TOKEN', description: 'Discord bot token from Developer Portal', required: true, category: 'discord' },
          { key: 'DISCORD_CLIENT_ID', description: 'Discord application client ID', required: true, category: 'discord' },
          { key: 'DISCORD_GUILD_ID', description: 'Default Discord server ID (optional)', required: false, category: 'discord' },
          { key: 'DATABASE_URL', description: 'PostgreSQL connection string', required: true, category: 'database' },
          { key: 'LOG_LEVEL', description: 'Logging level (debug, info, warn, error)', required: false, category: 'other' },
        ],
        healthCheck: {
          endpoint: '/health',
          interval: 30000,
        },
        healingRules: [
          { condition: 'process_crashed', action: 'restart' },
          { condition: 'memory_usage > 90%', action: 'restart' },
          { condition: 'discord_disconnect', action: 'reconnect' },
        ],
      },
      estimatedDeployTime: 120,
    },
    {
      id: 'api-backend',
      name: 'API Backend',
      description: 'RESTful API server with authentication, rate limiting, and database',
      type: 'api-backend',
      icon: '🔌',
      defaultConfig: {
        variables: [
          { key: 'PORT', description: 'Server port (default: 3000)', required: false, category: 'other' },
          { key: 'DATABASE_URL', description: 'Database connection string', required: true, category: 'database' },
          { key: 'JWT_SECRET', description: 'Secret key for JWT signing', required: true, category: 'jwt' },
          { key: 'API_KEY', description: 'API key for external services', required: false, category: 'api' },
          { key: 'CORS_ORIGIN', description: 'Allowed CORS origins', required: false, category: 'other' },
          { key: 'RATE_LIMIT_MAX', description: 'Max requests per window', required: false, category: 'other' },
        ],
        healthCheck: {
          endpoint: '/api/health',
          interval: 60000,
        },
        healingRules: [
          { condition: 'response_time > 5000ms', action: 'restart' },
          { condition: 'error_rate > 10%', action: 'alert' },
          { condition: 'cpu_usage > 95%', action: 'scale_up' },
        ],
      },
      estimatedDeployTime: 90,
    },
    {
      id: 'website',
      name: 'Website/Frontend',
      description: 'Next.js/React website with SSR, API routes, and static generation',
      type: 'website',
      icon: '🌐',
      defaultConfig: {
        variables: [
          { key: 'NEXT_PUBLIC_API_URL', description: 'Public API URL', required: true, category: 'api' },
          { key: 'NEXT_PUBLIC_WS_URL', description: 'WebSocket URL for real-time features', required: false, category: 'api' },
          { key: 'DATABASE_URL', description: 'Database for API routes (optional)', required: false, category: 'database' },
          { key: 'JWT_SECRET', description: 'Auth secret for API routes', required: false, category: 'jwt' },
        ],
        healthCheck: {
          endpoint: '/api/health',
          interval: 60000,
        },
        healingRules: [
          { condition: 'build_failure', action: 'rebuild' },
          { condition: '404_rate > 5%', action: 'alert' },
        ],
      },
      estimatedDeployTime: 180,
    },
  ];
}
