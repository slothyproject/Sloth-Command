/**
 * Git Hooks
 * Manage repositories, webhooks, and CI/CD pipelines
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

export interface Repository {
  id: string;
  name: string;
  owner: string;
  url: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  defaultBranch: string;
  serviceId: string;
  serviceName?: string;
  webhook?: WebhookConfig;
  webhookStatus: 'active' | 'inactive' | 'error';
  lastWebhookAt?: string;
  lastWebhookStatus?: 'success' | 'failed' | 'pending';
  createdAt: string;
  updatedAt: string;
}

export interface WebhookConfig {
  id: string;
  branch: string;
  targetEnvironment: 'production' | 'staging' | 'development';
  autoDeploy: boolean;
  requireApproval: boolean;
  runTests: boolean;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  secret?: string;
  url?: string;
}

export interface DeploymentPipeline {
  id: string;
  repositoryId: string;
  serviceId: string;
  commit: {
    sha: string;
    message: string;
    author: string;
    timestamp: string;
  };
  branch: string;
  status: 'pending' | 'building' | 'testing' | 'deploying' | 'completed' | 'failed' | 'cancelled';
  stage: 'build' | 'test' | 'deploy' | 'cleanup' | 'completed';
  progress: number;
  stages: PipelineStage[];
  logs: BuildLog[];
  startedAt: string;
  completedAt?: string;
  duration?: number;
  triggeredBy: 'webhook' | 'manual' | 'schedule';
  approvedBy?: string;
  approvedAt?: string;
  rollbackAvailable: boolean;
  rollbackTo?: string;
}

export interface PipelineStage {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  logs?: string[];
}

export interface BuildLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  stage: string;
}

// ============================================================================
// REPOSITORY HOOKS
// ============================================================================

const gitKeys = {
  all: ['git'] as const,
  repositories: () => [...gitKeys.all, 'repositories'] as const,
  repository: (id: string) => [...gitKeys.all, 'repository', id] as const,
  branches: (repoId: string) => [...gitKeys.all, 'branches', repoId] as const,
};

// Get all connected repositories
export function useRepositories() {
  return useQuery({
    queryKey: gitKeys.repositories(),
    queryFn: async () => {
      const response = await api.git?.listRepositories?.() || { data: [] };
      return response.data as Repository[];
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

// Get repository by ID
export function useRepository(id: string) {
  return useQuery({
    queryKey: gitKeys.repository(id),
    queryFn: async () => {
      const response = await api.git?.getRepository?.(id) || { data: null };
      return response.data as Repository;
    },
    enabled: !!id,
  });
}

// Get repository branches
export function useRepositoryBranches(repoId: string) {
  return useQuery({
    queryKey: gitKeys.branches(repoId),
    queryFn: async () => {
      const response = await api.git?.listBranches?.(repoId) || { data: [] };
      return response.data as string[];
    },
    enabled: !!repoId,
  });
}

// ============================================================================
// REPOSITORY MUTATIONS
// ============================================================================

export function useConnectRepository() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      url,
      provider,
      serviceId,
      token,
    }: {
      url: string;
      provider: 'github' | 'gitlab' | 'bitbucket';
      serviceId: string;
      token?: string;
    }) => {
      const response = await api.git?.connectRepository?.({ url, provider, serviceId, token }) ||
        api.git?.create?.({ url, provider, serviceId, token });
      return response?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gitKeys.repositories() });
    },
  });
}

export function useDisconnectRepository() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (repoId: string) => {
      await api.git?.disconnectRepository?.(repoId) || api.git?.delete?.(repoId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gitKeys.repositories() });
    },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ repoId, config }: { repoId: string; config: WebhookConfig }) => {
      const response = await api.git?.updateWebhook?.(repoId, config) ||
        api.git?.update?.(repoId, { webhook: config });
      return response?.data;
    },
    onSuccess: (_, { repoId }) => {
      queryClient.invalidateQueries({ queryKey: gitKeys.repositories() });
      queryClient.invalidateQueries({ queryKey: gitKeys.repository(repoId) });
    },
  });
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: async (repoId: string) => {
      const response = await api.git?.testWebhook?.(repoId);
      return response?.data;
    },
  });
}

// ============================================================================
// DEPLOYMENT PIPELINE HOOKS
// ============================================================================

const pipelineKeys = {
  all: ['pipeline'] as const,
  lists: () => [...pipelineKeys.all, 'list'] as const,
  detail: (id: string) => [...pipelineKeys.all, 'detail', id] as const,
  logs: (id: string) => [...pipelineKeys.all, 'logs', id] as const,
  service: (serviceId: string) => [...pipelineKeys.all, 'service', serviceId] as const,
};

// Get all pipelines
export function usePipelines() {
  return useQuery({
    queryKey: pipelineKeys.lists(),
    queryFn: async () => {
      const response = await api.pipeline?.list?.() || { data: [] };
      return response.data as DeploymentPipeline[];
    },
    staleTime: 5000,
  });
}

// Get pipeline by ID
export function usePipeline(id: string) {
  return useQuery({
    queryKey: pipelineKeys.detail(id),
    queryFn: async () => {
      const response = await api.pipeline?.get?.(id) || { data: null };
      return response.data as DeploymentPipeline;
    },
    enabled: !!id,
    refetchInterval: 2000,
  });
}

// Get pipeline logs
export function usePipelineLogs(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: pipelineKeys.logs(id),
    queryFn: async () => {
      const response = await api.pipeline?.getLogs?.(id) || { data: [] };
      return response.data as BuildLog[];
    },
    enabled: !!id && enabled,
    refetchInterval: 1000, // Poll every second for live logs
  });
}

// Get service pipelines
export function useServicePipelines(serviceId: string) {
  return useQuery({
    queryKey: pipelineKeys.service(serviceId),
    queryFn: async () => {
      const response = await api.pipeline?.listByService?.(serviceId) || { data: [] };
      return response.data as DeploymentPipeline[];
    },
    enabled: !!serviceId,
  });
}

// ============================================================================
// PIPELINE MUTATIONS
// ============================================================================

export function useTriggerPipeline() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      serviceId,
      branch,
      commitSha,
    }: {
      serviceId: string;
      branch?: string;
      commitSha?: string;
    }) => {
      const response = await api.pipeline?.trigger?.(serviceId, { branch, commitSha }) ||
        api.services.deploy(serviceId);
      return response?.data;
    },
    onSuccess: (_, { serviceId }) => {
      queryClient.invalidateQueries({ queryKey: pipelineKeys.lists() });
      queryClient.invalidateQueries({ queryKey: pipelineKeys.service(serviceId) });
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

export function useCancelPipeline() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (pipelineId: string) => {
      await api.pipeline?.cancel?.(pipelineId);
    },
    onSuccess: (_, pipelineId) => {
      queryClient.invalidateQueries({ queryKey: pipelineKeys.detail(pipelineId) });
    },
  });
}

export function useApprovePipeline() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (pipelineId: string) => {
      const response = await api.pipeline?.approve?.(pipelineId);
      return response?.data;
    },
    onSuccess: (_, pipelineId) => {
      queryClient.invalidateQueries({ queryKey: pipelineKeys.detail(pipelineId) });
    },
  });
}

export function useRollbackPipeline() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ pipelineId, toPipelineId }: { pipelineId: string; toPipelineId: string }) => {
      const response = await api.pipeline?.rollback?.(pipelineId, { toPipelineId });
      return response?.data;
    },
    onSuccess: (_, { pipelineId }) => {
      queryClient.invalidateQueries({ queryKey: pipelineKeys.detail(pipelineId) });
    },
  });
}

// ============================================================================
// WEBHOOK HANDLING
// ============================================================================

// Hook to handle incoming webhooks (for the API route)
export function useProcessWebhook() {
  return useMutation({
    mutationFn: async (payload: {
      provider: string;
      event: string;
      repository: string;
      branch: string;
      commit: {
        sha: string;
        message: string;
        author: string;
      };
    }) => {
      const response = await api.webhook?.process?.(payload);
      return response?.data;
    },
  });
}

// ============================================================================
// CI/CD CONFIGURATION
// ============================================================================

export interface CICDConfig {
  serviceId: string;
  enabled: boolean;
  repositoryId?: string;
  branches: {
    name: string;
    autoDeploy: boolean;
    requireApproval: boolean;
    environment: 'production' | 'staging' | 'development';
  }[];
  buildCommand?: string;
  testCommand?: string;
  environmentVariables?: Record<string, string>;
  notifications?: {
    onSuccess: boolean;
    onFailure: boolean;
    channels: ('email' | 'discord' | 'slack')[];
  };
}

const cicdKeys = {
  all: ['cicd'] as const,
  config: (serviceId: string) => [...cicdKeys.all, 'config', serviceId] as const,
};

export function useCICDConfig(serviceId: string) {
  return useQuery({
    queryKey: cicdKeys.config(serviceId),
    queryFn: async () => {
      const response = await api.cicd?.getConfig?.(serviceId) || { data: null };
      return response.data as CICDConfig;
    },
    enabled: !!serviceId,
  });
}

export function useUpdateCICDConfig() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ serviceId, config }: { serviceId: string; config: CICDConfig }) => {
      const response = await api.cicd?.updateConfig?.(serviceId, config);
      return response?.data;
    },
    onSuccess: (_, { serviceId }) => {
      queryClient.invalidateQueries({ queryKey: cicdKeys.config(serviceId) });
    },
  });
}
