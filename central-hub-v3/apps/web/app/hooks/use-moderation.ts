/**
 * Moderation Hooks
 * TanStack Query hooks for moderation case operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';
import type { ModerationCase } from '@/app/types';

// Query keys
export const moderationKeys = {
  all: ['moderation'] as const,
  lists: () => [...moderationKeys.all, 'list'] as const,
  list: (filters: Record<string, string>) => [...moderationKeys.lists(), { filters }] as const,
  details: () => [...moderationKeys.all, 'detail'] as const,
  detail: (id: string) => [...moderationKeys.details(), id] as const,
};

// Get moderation cases
export function useModerationCases(filters?: Record<string, string>) {
  return useQuery({
    queryKey: moderationKeys.list(filters ?? {}),
    queryFn: async () => {
      const response = await api.moderation.cases({
        ...(filters?.action ? { action: filters.action } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.moderator ? { moderator: filters.moderator } : {}),
        limit: 100,
      });
      return (response.data.data ?? response.data ?? []) as ModerationCase[];
    },
  });
}

// Get single moderation case
export function useModerationCase(id: string) {
  return useQuery({
    queryKey: moderationKeys.detail(id),
    queryFn: async () => {
      const response = await api.moderation.getCase(id);
      return (response.data.data ?? response.data) as ModerationCase;
    },
    enabled: !!id,
  });
}

// Create moderation case
export function useCreateModerationCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<ModerationCase>) => {
      const response = await api.moderation.createCase(data);
      return (response.data.data ?? response.data) as ModerationCase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.lists() });
    },
  });
}

// Update moderation case
export function useUpdateModerationCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ModerationCase> }) => {
      const response = await api.moderation.updateCase(id, data);
      return (response.data.data ?? response.data) as ModerationCase;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: moderationKeys.lists() });
    },
  });
}

// Resolve moderation case
export function useResolveModerationCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.moderation.resolveCase(id);
      return response.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: moderationKeys.lists() });
    },
  });
}

// Appeal moderation case
export function useAppealModerationCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await api.moderation.appealCase(id, reason);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: moderationKeys.lists() });
    },
  });
}
