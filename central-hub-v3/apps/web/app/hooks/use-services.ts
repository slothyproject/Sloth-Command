/**
 * Service Hooks
 * TanStack Query hooks for service operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';
import type { Service, Variable, Deployment } from '@/app/types';

// Query keys
export const serviceKeys = {
  all: ['services'] as const,
  lists: () => [...serviceKeys.all, 'list'] as const,
  list: (filters: Record<string, string>) => [...serviceKeys.lists(), { filters }] as const,
  details: () => [...serviceKeys.all, 'detail'] as const,
  detail: (id: string) => [...serviceKeys.details(), id] as const,
  variables: (serviceId: string) => [...serviceKeys.detail(serviceId), 'variables'] as const,
  deployments: (serviceId: string) => [...serviceKeys.detail(serviceId), 'deployments'] as const,
};

// Get all services
export function useServices() {
  return useQuery({
    queryKey: serviceKeys.lists(),
    queryFn: async () => {
      const response = await api.services.list();
      return response.data.data as Service[];
    },
  });
}

// Get single service
export function useService(id: string) {
  return useQuery({
    queryKey: serviceKeys.detail(id),
    queryFn: async () => {
      const response = await api.services.get(id);
      return response.data.data as Service;
    },
    enabled: !!id,
  });
}

// Create service
export function useCreateService() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<Service>) => {
      const response = await api.services.create(data);
      return response.data.data as Service;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
}

// Update service
export function useUpdateService() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Service> }) => {
      const response = await api.services.update(id, data);
      return response.data.data as Service;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
}

// Delete service
export function useDeleteService() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.services.delete(id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
}

// Sync services
export function useSyncServices() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await api.services.sync();
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
}

// Deploy service
export function useDeployService() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.services.deploy(id);
      return response.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.detail(id) });
      queryClient.invalidateQueries({ 
        queryKey: serviceKeys.deployments(id) 
      });
    },
  });
}

// Restart service
export function useRestartService() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.services.restart(id);
      return response.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.detail(id) });
    },
  });
}

// Get service variables
export function useServiceVariables(serviceId: string) {
  return useQuery({
    queryKey: serviceKeys.variables(serviceId),
    queryFn: async () => {
      const response = await api.variables.list(serviceId);
      return response.data.data as Variable[];
    },
    enabled: !!serviceId,
  });
}

// Create variable
export function useCreateVariable() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      serviceId, 
      data 
    }: { 
      serviceId: string; 
      data: Partial<Variable> 
    }) => {
      const response = await api.variables.create(serviceId, data);
      return response.data.data as Variable;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: serviceKeys.variables(variables.serviceId) 
      });
    },
  });
}

// Update variable
export function useUpdateVariable() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      serviceId,
      variableId,
      data,
    }: {
      serviceId: string;
      variableId: string;
      data: Partial<Variable>;
    }) => {
      const response = await api.variables.update(serviceId, variableId, data);
      return response.data.data as Variable;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: serviceKeys.variables(variables.serviceId),
      });
    },
  });
}

// Delete variable
export function useDeleteVariable() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      serviceId,
      variableId,
    }: {
      serviceId: string;
      variableId: string;
    }) => {
      await api.variables.delete(serviceId, variableId);
      return { serviceId, variableId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: serviceKeys.variables(variables.serviceId),
      });
    },
  });
}

// Get service deployments
export function useServiceDeployments(serviceId: string) {
  return useQuery({
    queryKey: serviceKeys.deployments(serviceId),
    queryFn: async () => {
      const response = await api.deployments.list(serviceId);
      return response.data.data as Deployment[];
    },
    enabled: !!serviceId,
  });
}
