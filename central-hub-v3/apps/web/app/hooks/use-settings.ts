/**
 * Settings Hooks
 * TanStack Query hooks for application settings
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';
import type { Settings } from '@/app/types';

// Query keys
export const settingsKeys = {
  all: ['settings'] as const,
  current: () => [...settingsKeys.all, 'current'] as const,
};

// Get settings
export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.current(),
    queryFn: async () => {
      const response = await api.settings.get();
      return (response.data.data ?? response.data) as Settings;
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

// Update settings
export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Settings>) => {
      const response = await api.settings.update(data);
      return (response.data.data ?? response.data) as Settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.current() });
    },
  });
}

// Reset settings to defaults
export function useResetSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await api.settings.reset();
      return (response.data.data ?? response.data) as Settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.current() });
    },
  });
}
