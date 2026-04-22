/**
 * Services Hooks Tests
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useServices, useService, useCreateService } from '@/app/hooks/use-services';
import { createHookWrapper, mockApiResponses } from '@/__tests__/utils/test-utils';

// Mock the API client
jest.mock('@/app/lib/api-client', () => ({
  api: {
    services: {
      list: jest.fn(),
      get: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { api } from '@/app/lib/api-client';

describe('useServices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches services successfully', async () => {
    (api.services.list as jest.Mock).mockResolvedValueOnce(mockApiResponses.services.success);

    const { result } = renderHook(() => useServices(), {
      wrapper: createHookWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for success
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].name).toBe('Test Service');
  });

  it('handles error state', async () => {
    const error = new Error('Failed to fetch');
    (api.services.list as jest.Mock).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useServices(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error);
  });

  it('returns empty array when no services', async () => {
    (api.services.list as jest.Mock).mockResolvedValueOnce(mockApiResponses.services.empty);

    const { result } = renderHook(() => useServices(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(0);
  });
});

describe('useService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches single service', async () => {
    const service = mockApiResponses.services.success.data.data[0];
    (api.services.get as jest.Mock).mockResolvedValueOnce({
      data: { data: service },
    });

    const { result } = renderHook(() => useService('service-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe('service-1');
    expect(result.current.data?.name).toBe('Test Service');
  });

  it('does not fetch when id is empty', () => {
    (api.services.get as jest.Mock).mockResolvedValueOnce({});

    const { result } = renderHook(() => useService(''), {
      wrapper: createHookWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.services.get).not.toHaveBeenCalled();
  });
});

describe('useCreateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates service successfully', async () => {
    const newService = { name: 'New Service', type: 'web' };
    const createdService = { id: 'new-id', ...newService };
    
    (api.services.create as jest.Mock).mockResolvedValueOnce({
      data: { data: createdService },
    });

    const { result } = renderHook(() => useCreateService(), {
      wrapper: createHookWrapper(),
    });

    // Initially not loading
    expect(result.current.isPending).toBe(false);

    // Execute mutation
    result.current.mutate(newService);

    // Wait for success
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.services.create).toHaveBeenCalledWith(newService);
    expect(result.current.data).toEqual(createdService);
  });

  it('handles creation error', async () => {
    const error = new Error('Creation failed');
    (api.services.create as jest.Mock).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useCreateService(), {
      wrapper: createHookWrapper(),
    });

    result.current.mutate({ name: 'Test' });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error);
  });
});
