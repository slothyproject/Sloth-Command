/**
 * Analytics Hooks
 * TanStack Query hooks for analytics operations
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';
import type { AnalyticsOverview } from '@/app/types';

// Query keys
export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: (range?: string) => [...analyticsKeys.all, 'overview', range ?? '7d'] as const,
  messages: (range?: string) => [...analyticsKeys.all, 'messages', range ?? '7d'] as const,
  users: (range?: string) => [...analyticsKeys.all, 'users', range ?? '7d'] as const,
  commands: (range?: string) => [...analyticsKeys.all, 'commands', range ?? '7d'] as const,
  tickets: (range?: string) => [...analyticsKeys.all, 'tickets', range ?? '7d'] as const,
};

// Get analytics overview
export function useAnalyticsOverview(range: '24h' | '7d' | '30d' | '90d' = '7d') {
  return useQuery({
    queryKey: analyticsKeys.overview(range),
    queryFn: async () => {
      const response = await api.analytics.overview({ range });
      return (response.data.data ?? response.data ?? {
        messages: 0,
        users: 0,
        moderationEvents: 0,
        ticketsResolved: 0,
        messagesOverTime: [],
        activityHeatmap: [],
        topCommands: [],
        ticketResolutionRate: [],
      }) as AnalyticsOverview;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get messages analytics
export function useMessagesAnalytics(range: string = '7d') {
  return useQuery({
    queryKey: analyticsKeys.messages(range),
    queryFn: async () => {
      const response = await api.analytics.messages({ range });
      return (response.data.data ?? response.data ?? []) as Array<{ time: string; messages: number; users: number }>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Get users analytics
export function useUsersAnalytics(range: string = '7d') {
  return useQuery({
    queryKey: analyticsKeys.users(range),
    queryFn: async () => {
      const response = await api.analytics.users({ range });
      return (response.data.data ?? response.data ?? []) as Array<{ time: string; users: number }>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Get commands analytics
export function useCommandsAnalytics(range: string = '7d') {
  return useQuery({
    queryKey: analyticsKeys.commands(range),
    queryFn: async () => {
      const response = await api.analytics.commands({ range });
      return (response.data.data ?? response.data ?? []) as Array<{ command: string; count: number }>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Get tickets analytics
export function useTicketsAnalytics(range: string = '7d') {
  return useQuery({
    queryKey: analyticsKeys.tickets(range),
    queryFn: async () => {
      const response = await api.analytics.tickets({ range });
      return (response.data.data ?? response.data ?? []) as Array<{ period: string; created: number; resolved: number }>;
    },
    staleTime: 5 * 60 * 1000,
  });
}
