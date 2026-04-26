/**
 * Query Provider
 * TanStack Query configuration and provider setup
 */

'use client';

import React from 'react';
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
  type DefaultOptions,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Query configuration
const defaultOptions: DefaultOptions = {
  queries: {
    // Data freshness
    staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for this duration
    gcTime: 10 * 60 * 1000, // 10 minutes - keep inactive data in cache
    
    // Retry configuration
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    
    // Refetch behavior
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: true, // Refetch when network reconnects
    refetchOnMount: true, // Refetch when component mounts if stale
    
    // Network mode
    networkMode: 'online', // Only run queries when online
    
    // Error handling
    throwOnError: false, // Don't throw errors - handle them in components
    
    // Loading state
    placeholderData: (previousData: unknown) => previousData, // Use previous data while loading new
  },
  mutations: {
    // Retry configuration for mutations
    retry: 1,
    retryDelay: 1000,
    
    // Network mode
    networkMode: 'online',
    
    // Error handling
    throwOnError: false,
    
    // Optimistic updates are handled per-mutation in hooks
  },
};

// Create query cache with custom error handling
const queryCache = new QueryCache({
  onError: (error, query) => {
    console.error(`Query error [${query.queryKey.join(', ')}]:`, error);
    
    // Log to error tracking in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error tracking service
      // Example: Sentry.captureException(error, {
      //   tags: { queryKey: query.queryKey.join(', ') },
      // });
    }
  },
  onSuccess: (data, query) => {
    // Log successful queries in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Query success [${query.queryKey.join(', ')}]:`, data);
    }
  },
});

// Create mutation cache with custom handlers
const mutationCache = new MutationCache({
  onError: (error, variables, context, mutation) => {
    console.error(`Mutation error:`, error);
    
    // Log to error tracking in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error tracking service
    }
  },
  onSuccess: (data, variables, context, mutation) => {
    // Log successful mutations in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Mutation success:`, data);
    }
  },
});

// Create query client instance
function createQueryClient() {
  return new QueryClient({
    defaultOptions,
    queryCache,
    mutationCache,
  });
}

// Provider component
interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Create client once to avoid re-creating on renders
  const [queryClient] = React.useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools - only in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools 
          initialIsOpen={false} 
          position="bottom"
          buttonPosition="bottom-left"
        />
      )}
    </QueryClientProvider>
  );
}

// Export query client factory for testing
export { createQueryClient };

// Utility to invalidate queries
export function invalidateQueries(
  queryClient: QueryClient,
  queryKey: string[],
  exact = false
) {
  return queryClient.invalidateQueries({
    queryKey,
    exact,
    refetchType: 'active',
  });
}

// Utility to prefetch queries
export function prefetchQuery<T>(
  queryClient: QueryClient,
  queryKey: string[],
  fetchFn: () => Promise<T>,
  staleTime?: number
) {
  return queryClient.prefetchQuery({
    queryKey,
    queryFn: fetchFn,
    staleTime: staleTime || 5 * 60 * 1000,
  });
}

// Utility to set query data (for optimistic updates)
export function setQueryData<T>(
  queryClient: QueryClient,
  queryKey: string[],
  updater: (oldData: T | undefined) => T | undefined
) {
  return queryClient.setQueryData(queryKey, updater);
}

// Utility to get query data
export function getQueryData<T>(queryClient: QueryClient, queryKey: string[]): T | undefined {
  return queryClient.getQueryData(queryKey);
}

// Utility to cancel queries
export function cancelQueries(queryClient: QueryClient, queryKey?: string[]) {
  if (queryKey) {
    return queryClient.cancelQueries({ queryKey });
  }
  return queryClient.cancelQueries();
}
