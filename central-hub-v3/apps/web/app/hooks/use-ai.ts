/**
 * AI Hooks
 * TanStack Query hooks for AI operations and agentic AI
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';
import type { 
  AgentPlan, 
  AgentInfo, 
  AgentResponse,
  Service 
} from '@/app/types';

// Query keys
export const aiKeys = {
  all: ['ai'] as const,
  analysis: (serviceId: string) => [...aiKeys.all, 'analysis', serviceId] as const,
  predictions: (serviceId: string, hours: number) => [...aiKeys.all, 'predictions', serviceId, hours] as const,
  insights: (serviceId: string) => [...aiKeys.all, 'insights', serviceId] as const,
  agents: {
    all: ['agents'] as const,
    list: () => [...aiKeys.agents.all, 'list'] as const,
    plans: () => [...aiKeys.agents.all, 'plans'] as const,
    plan: (planId: string) => [...aiKeys.agents.all, 'plan', planId] as const,
  },
};

// AI Analysis types
export interface AIAnalysis {
  status: 'healthy' | 'warning' | 'critical';
  score: number;
  summary: string;
  metrics: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    recommendation: string;
  }>;
  recommendations: string[];
  lastUpdated: string;
}

// AI Prediction types
export interface AIPrediction {
  metric: string;
  current: number;
  predicted: number;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
  forecast: Array<{
    timestamp: string;
    value: number;
    confidence: [number, number];
  }>;
  alerts: string[];
}

// AI Insights types
export interface AIInsight {
  id: string;
  type: 'performance' | 'security' | 'cost' | 'reliability' | 'optimization';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  serviceId: string;
  serviceName: string;
  createdAt: string;
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  autoFixable: boolean;
  estimatedImpact: {
    savings?: string;
    performance?: string;
    reliability?: string;
  };
}

// ============================================================================
// AI ANALYSIS HOOKS
// ============================================================================

// Analyze a service
export function useAIAnalysis(serviceId: string) {
  return useQuery({
    queryKey: aiKeys.analysis(serviceId),
    queryFn: async () => {
      const response = await api.ai.analyze(serviceId);
      return response.data.data as AIAnalysis;
    },
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get AI predictions for a service
export function useAIPredictions(serviceId: string, hours = 24) {
  return useQuery({
    queryKey: aiKeys.predictions(serviceId, hours),
    queryFn: async () => {
      const response = await api.ai.predict(serviceId, hours);
      return response.data.data as AIPrediction[];
    },
    enabled: !!serviceId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Get AI insights for a service
export function useAIInsights(serviceId: string) {
  return useQuery({
    queryKey: aiKeys.insights(serviceId),
    queryFn: async () => {
      const response = await api.ai.insights(serviceId);
      return response.data.data as AIInsight[];
    },
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000,
  });
}

// Get all AI insights across services
export function useAllAIInsights(services: Service[] | undefined) {
  return useQuery({
    queryKey: [...aiKeys.all, 'all-insights'],
    queryFn: async () => {
      if (!services || services.length === 0) return [];
      
      const insightsPromises = services.map(async (service) => {
        try {
          const response = await api.ai.insights(service.id);
          const insights = response.data.data as AIInsight[];
          return insights.map(insight => ({
            ...insight,
            serviceId: service.id,
            serviceName: service.name,
          }));
        } catch {
          return [];
        }
      });
      
      const results = await Promise.all(insightsPromises);
      return results.flat().sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
    enabled: !!services && services.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// Chat with AI
export function useAIChat() {
  return useMutation({
    mutationFn: async (message: string) => {
      const response = await api.ai.chat(message);
      return response.data.data as { response: string; suggestions?: string[] };
    },
  });
}

// Fix an insight automatically
export function useAIFix() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (insightId: string) => {
      const response = await api.ai.fix(insightId);
      return response.data.data;
    },
    onSuccess: () => {
      // Invalidate all insights queries
      queryClient.invalidateQueries({ queryKey: aiKeys.all });
    },
  });
}

// ============================================================================
// AGENTIC AI HOOKS
// ============================================================================

// Get available agents
export function useAgents() {
  return useQuery({
    queryKey: aiKeys.agents.list(),
    queryFn: async () => {
      const response = await api.agents.list();
      return response.data.data as AgentInfo[];
    },
    staleTime: 60 * 60 * 1000, // 1 hour - agents don't change often
  });
}

// Process a request with agents
export function useProcessAgentRequest() {
  return useMutation({
    mutationFn: async ({ 
      request, 
      context 
    }: { 
      request: string; 
      context?: Record<string, unknown> 
    }) => {
      const response = await api.agents.processRequest(request, context);
      return response.data.data as AgentResponse;
    },
  });
}

// Get all agent plans
export function useAgentPlans() {
  return useQuery({
    queryKey: aiKeys.agents.plans(),
    queryFn: async () => {
      const response = await api.agents.getPlans();
      return response.data.data as AgentPlan[];
    },
    staleTime: 30 * 1000, // 30 seconds - plans change frequently
    refetchInterval: 30 * 1000, // Auto-refresh every 30s
  });
}

// Get specific plan details
export function useAgentPlan(planId: string) {
  return useQuery({
    queryKey: aiKeys.agents.plan(planId),
    queryFn: async () => {
      const response = await api.agents.getPlan(planId);
      return response.data.data as AgentPlan;
    },
    enabled: !!planId,
    staleTime: 10 * 1000,
    refetchInterval: 10 * 1000,
  });
}

// Create a new plan
export function useCreateAgentPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      goal, 
      agentType, 
      context 
    }: { 
      goal: string; 
      agentType?: string; 
      context?: Record<string, unknown> 
    }) => {
      const response = await api.agents.createPlan(goal, agentType as any, context);
      return response.data.data as AgentPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiKeys.agents.plans() });
    },
  });
}

// Execute a plan
export function useExecuteAgentPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (planId: string) => {
      const response = await api.agents.executePlan(planId);
      return response.data.data;
    },
    onSuccess: (_, planId) => {
      queryClient.invalidateQueries({ queryKey: aiKeys.agents.plan(planId) });
      queryClient.invalidateQueries({ queryKey: aiKeys.agents.plans() });
    },
  });
}

// Approve/reject a plan
export function useApproveAgentPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      planId, 
      approved 
    }: { 
      planId: string; 
      approved: boolean 
    }) => {
      const response = await api.agents.approvePlan(planId, approved);
      return response.data.data;
    },
    onSuccess: (_, { planId }) => {
      queryClient.invalidateQueries({ queryKey: aiKeys.agents.plan(planId) });
      queryClient.invalidateQueries({ queryKey: aiKeys.agents.plans() });
    },
  });
}

// Cancel a plan
export function useCancelAgentPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (planId: string) => {
      const response = await api.agents.cancelPlan(planId);
      return response.data.data;
    },
    onSuccess: (_, planId) => {
      queryClient.invalidateQueries({ queryKey: aiKeys.agents.plan(planId) });
      queryClient.invalidateQueries({ queryKey: aiKeys.agents.plans() });
    },
  });
}

// Replan with new information
export function useReplan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      planId, 
      reason 
    }: { 
      planId: string; 
      reason: string 
    }) => {
      const response = await api.agents.replan(planId, reason);
      return response.data.data;
    },
    onSuccess: (_, { planId }) => {
      queryClient.invalidateQueries({ queryKey: aiKeys.agents.plan(planId) });
      queryClient.invalidateQueries({ queryKey: aiKeys.agents.plans() });
    },
  });
}
