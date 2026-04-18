/**
 * AI Hooks
 * TanStack Query hooks for AI features
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';

interface AIInsight {
  id: string;
  serviceId: string;
  title: string;
  severity: 'critical' | 'warning' | 'suggestion' | 'info';
}

interface AIPrediction {
  id: string;
  serviceId: string;
  metric: string;
  predictedValue: number;
  confidence: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// Query keys
export const aiKeys = {
  all: ['ai'] as const,
  analyze: (serviceId: string) => [...aiKeys.all, 'analyze', serviceId] as const,
  predict: (serviceId: string) => [...aiKeys.all, 'predict', serviceId] as const,
  insights: (serviceId: string) => [...aiKeys.all, 'insights', serviceId] as const,
  chat: () => [...aiKeys.all, 'chat'] as const,
};

// Analyze service
export function useAIAnalyze(serviceId: string) {
  return useQuery({
    queryKey: aiKeys.analyze(serviceId),
    queryFn: async () => {
      const response = await api.ai.analyze(serviceId);
      return response.data.data;
    },
    enabled: !!serviceId,
  });
}

// Get predictions
export function useAIPredictions(serviceId: string, hours = 24) {
  return useQuery({
    queryKey: aiKeys.predict(serviceId),
    queryFn: async () => {
      const response = await api.ai.predict(serviceId, hours);
      return response.data.data as AIPrediction;
    },
    enabled: !!serviceId,
  });
}

// Get insights
export function useAIInsights(serviceId: string) {
  return useQuery({
    queryKey: aiKeys.insights(serviceId),
    queryFn: async () => {
      const response = await api.ai.insights(serviceId);
      return response.data.data as AIInsight[];
    },
    enabled: !!serviceId,
  });
}

// AI Chat
export function useAIChat() {
  return useMutation({
    mutationFn: async (message: string) => {
      const response = await api.ai.chat(message);
      return response.data.data as { response: string; actions?: string[] };
    },
  });
}

// Auto-fix insight
export function useAutoFixInsight() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      serviceId, 
      insightId 
    }: { 
      serviceId: string; 
      insightId: string 
    }) => {
      // This would call an API endpoint to auto-fix
      const response = await api.ai.fix(insightId);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: aiKeys.insights(variables.serviceId) 
      });
    },
  });
}
