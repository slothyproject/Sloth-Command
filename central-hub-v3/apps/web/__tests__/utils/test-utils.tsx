/**
 * Test Utilities
 * Helper functions for testing components and hooks
 */

import React from 'react';
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/app/components/providers/toast-provider';

// Create a test query client
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// All providers wrapper for rendering
interface AllProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

export function AllProviders({ children, queryClient }: AllProvidersProps) {
  const client = queryClient || createTestQueryClient();
  
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );
}

// Custom render function with providers
export function render(
  ui: React.ReactElement,
  { queryClient, ...options }: { queryClient?: QueryClient } & Parameters<typeof rtlRender>[1] = {}
) {
  const user = userEvent.setup();
  
  return {
    user,
    ...rtlRender(ui, {
      wrapper: ({ children }) => (
        <AllProviders queryClient={queryClient}>{children}</AllProviders>
      ),
      ...options,
    }),
  };
}

// Wait for loading state to finish
export async function waitForLoadingToFinish() {
  const loadingElements = screen.queryAllByText(/loading|Loading.../i);
  if (loadingElements.length > 0) {
    await waitFor(() => {
      expect(screen.queryAllByText(/loading|Loading.../i)).toHaveLength(0);
    });
  }
}

// Test data generators
export const testData = {
  service: {
    id: 'service-1',
    name: 'Test Service',
    status: 'healthy' as const,
    type: 'web',
    url: 'https://example.com',
    healthScore: 95,
    cpuPercent: 45,
    memoryPercent: 60,
    diskPercent: 30,
    networkRX: 1024,
    networkTX: 2048,
    uptime: 86400,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  
  vulnerability: {
    id: 'vuln-1',
    serviceId: 'service-1',
    serviceName: 'Test Service',
    title: 'Test Vulnerability',
    description: 'This is a test vulnerability',
    severity: 'high' as const,
    status: 'open' as const,
    discoveredAt: new Date().toISOString(),
    affectedComponent: 'dependency',
    autoPatched: false,
    references: [],
  },
  
  insight: {
    id: 'insight-1',
    type: 'performance' as const,
    severity: 'warning' as const,
    title: 'High CPU Usage',
    description: 'CPU usage is consistently above 80%',
    serviceId: 'service-1',
    serviceName: 'Test Service',
    createdAt: new Date().toISOString(),
    status: 'open' as const,
    autoFixable: true,
    estimatedImpact: {
      performance: '15% improvement',
    },
  },
  
  agentPlan: {
    id: 'plan-1',
    goal: 'Deploy new service',
    agentType: 'deployer' as const,
    steps: [
      {
        id: 'step-1',
        description: 'Build application',
        status: 'completed' as const,
        dependencies: [],
      },
      {
        id: 'step-2',
        description: 'Deploy to staging',
        status: 'running' as const,
        dependencies: ['step-1'],
      },
    ],
    status: 'running' as const,
    context: {},
    metadata: {
      estimatedSteps: 5,
      estimatedDuration: 300,
      priority: 1,
      requiresApproval: false,
    },
    createdAt: new Date().toISOString(),
  },
};

// Mock API responses
export const mockApiResponses = {
  services: {
    success: {
      data: {
        data: [testData.service],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
        },
      },
    },
    empty: {
      data: {
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          pages: 0,
        },
      },
    },
  },
  
  vulnerabilities: {
    success: {
      data: {
        data: [testData.vulnerability],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
        },
      },
    },
  },
  
  insights: {
    success: {
      data: {
        data: [testData.insight],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
        },
      },
    },
  },
};

// Component test helpers
export async function fillFormField(label: string, value: string) {
  const field = screen.getByLabelText(label);
  await userEvent.clear(field);
  await userEvent.type(field, value);
}

export async function selectOption(label: string, optionText: string) {
  const select = screen.getByLabelText(label);
  await userEvent.click(select);
  const option = screen.getByText(optionText);
  await userEvent.click(option);
}

export async function clickButton(buttonText: string) {
  const button = screen.getByRole('button', { name: buttonText });
  await userEvent.click(button);
}

// Hook test wrapper
export function createHookWrapper(queryClient?: QueryClient) {
  const client = queryClient || createTestQueryClient();
  
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        {children}
      </QueryClientProvider>
    );
  };
}

// Async utilities
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// DOM utilities
export function getAllByRoleWithin(container: HTMLElement, role: string) {
  return within(container).getAllByRole(role);
}

export function queryByTextWithin(container: HTMLElement, text: string) {
  return within(container).queryByText(text);
}

// Performance testing
export async function measureRenderTime(
  component: React.ReactElement
): Promise<number> {
  const start = performance.now();
  render(component);
  const end = performance.now();
  return end - start;
}

// Accessibility testing helpers
export function checkA11yAttributes(element: HTMLElement) {
  const hasValidRole = element.getAttribute('role') !== null;
  const hasValidAriaLabel = 
    element.getAttribute('aria-label') !== null ||
    element.getAttribute('aria-labelledby') !== null;
  const hasValidTabIndex = element.getAttribute('tabindex') !== null;
  
  return {
    hasValidRole,
    hasValidAriaLabel,
    hasValidTabIndex,
    isAccessible: hasValidRole || hasValidAriaLabel,
  };
}
