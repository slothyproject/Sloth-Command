/**
 * Ticket Hooks
 * TanStack Query hooks for ticket operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';
import type { Ticket, TicketComment } from '@/app/types';

// Query keys
export const ticketKeys = {
  all: ['tickets'] as const,
  lists: () => [...ticketKeys.all, 'list'] as const,
  list: (filters: Record<string, string>) => [...ticketKeys.lists(), { filters }] as const,
  details: () => [...ticketKeys.all, 'detail'] as const,
  detail: (id: string) => [...ticketKeys.details(), id] as const,
  comments: (ticketId: string) => [...ticketKeys.detail(ticketId), 'comments'] as const,
};

// Get all tickets
export function useTickets(filters?: Record<string, string>) {
  return useQuery({
    queryKey: ticketKeys.list(filters ?? {}),
    queryFn: async () => {
      const response = await api.tickets.list({
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.priority ? { priority: filters.priority } : {}),
        ...(filters?.assignedTo ? { assignedTo: filters.assignedTo } : {}),
        limit: 100,
      });
      return (response.data.data ?? response.data ?? []) as Ticket[];
    },
  });
}

// Get single ticket
export function useTicket(id: string) {
  return useQuery({
    queryKey: ticketKeys.detail(id),
    queryFn: async () => {
      const response = await api.tickets.get(id);
      return (response.data.data ?? response.data) as Ticket;
    },
    enabled: !!id,
  });
}

// Create ticket
export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Ticket>) => {
      const response = await api.tickets.create(data);
      return (response.data.data ?? response.data) as Ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
    },
  });
}

// Update ticket
export function useUpdateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Ticket> }) => {
      const response = await api.tickets.update(id, data);
      return (response.data.data ?? response.data) as Ticket;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
    },
  });
}

// Assign ticket
export function useAssignTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, assignedTo }: { id: string; assignedTo: string }) => {
      const response = await api.tickets.assign(id, assignedTo);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
    },
  });
}

// Add comment to ticket
export function useAddTicketComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const response = await api.tickets.comment(id, content);
      return (response.data.data ?? response.data) as TicketComment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(variables.id) });
    },
  });
}
