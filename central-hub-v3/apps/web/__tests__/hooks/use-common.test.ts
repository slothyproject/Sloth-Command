/**
 * Custom Hooks Tests
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useDebounce,
  useThrottle,
  useAsyncAction,
  usePagination,
  useLocalStorage,
  usePrevious,
} from '@/app/hooks/use-common';
import { createHookWrapper } from '@/__tests__/utils/test-utils';

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('delays value update', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      }
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated', delay: 500 });
    expect(result.current).toBe('initial');

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current).toBe('updated');
  });

  it('resets timer on value change', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'a', delay: 500 },
      }
    );

    rerender({ value: 'b', delay: 500 });
    
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe('a');

    rerender({ value: 'c', delay: 500 });
    
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe('a');

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current).toBe('c');
  });
});

describe('useThrottle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('limits update frequency', () => {
    const { result, rerender } = renderHook(
      ({ value, interval }) => useThrottle(value, interval),
      {
        initialProps: { value: 0, interval: 1000 },
      }
    );

    expect(result.current).toBe(0);

    rerender({ value: 1, interval: 1000 });
    expect(result.current).toBe(0);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(1);
  });
});

describe('useAsyncAction', () => {
  it('executes async function', async () => {
    const asyncFn = jest.fn().mockResolvedValue('success');
    const { result } = renderHook(() => useAsyncAction(asyncFn));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();

    act(() => {
      result.current.execute('arg1', 'arg2');
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBe('success');
    expect(result.current.isSuccess).toBe(true);
    expect(asyncFn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('handles errors', async () => {
    const error = new Error('Test error');
    const asyncFn = jest.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useAsyncAction(asyncFn));

    act(() => {
      result.current.execute();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.isError).toBe(true);
    expect(result.current.isSuccess).toBe(false);
  });

  it('resets state', async () => {
    const asyncFn = jest.fn().mockResolvedValue('success');
    const { result } = renderHook(() => useAsyncAction(asyncFn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toBe('success');

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
  });
});

describe('usePagination', () => {
  it('calculates pagination correctly', () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 100, pageSize: 10 })
    );

    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalPages).toBe(10);
    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.canGoNext).toBe(true);
    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(10);
  });

  it('navigates pages', () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 100, pageSize: 10 })
    );

    act(() => {
      result.current.goToNext();
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.canGoPrevious).toBe(true);

    act(() => {
      result.current.goToPrevious();
    });

    expect(result.current.currentPage).toBe(1);
  });

  it('generates page range with ellipsis', () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 100, pageSize: 10, initialPage: 5 })
    );

    // Should show: 1 ... 4 5 6 ... 10
    expect(result.current.pageRange).toContain(1);
    expect(result.current.pageRange).toContain('...');
    expect(result.current.pageRange).toContain(5);
    expect(result.current.pageRange).toContain(10);
  });

  it('clamps to valid page range', () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 50, pageSize: 10, initialPage: 3 })
    );

    act(() => {
      result.current.goToPage(100);
    });

    expect(result.current.currentPage).toBe(5);

    act(() => {
      result.current.goToPage(0);
    });

    expect(result.current.currentPage).toBe(1);
  });
});

describe('useLocalStorage', () => {
  const mockStorage = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: jest.fn((key: string) => store[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
      }),
      clear: jest.fn(() => {
        store = {};
      }),
    };
  })();

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
    });
    mockStorage.clear();
    jest.clearAllMocks();
  });

  it('reads from localStorage', () => {
    mockStorage.setItem('test-key', JSON.stringify('stored-value'));
    
    const { result } = renderHook(() =>
      useLocalStorage('test-key', 'default')
    );

    expect(result.current[0]).toBe('stored-value');
  });

  it('uses initial value when no storage', () => {
    const { result } = renderHook(() =>
      useLocalStorage('new-key', 'initial')
    );

    expect(result.current[0]).toBe('initial');
  });

  it('writes to localStorage', () => {
    const { result } = renderHook(() =>
      useLocalStorage('test-key', 'initial')
    );

    act(() => {
      result.current[1]('new-value');
    });

    expect(result.current[0]).toBe('new-value');
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'test-key',
      JSON.stringify('new-value')
    );
  });

  it('supports functional updates', () => {
    const { result } = renderHook(() =>
      useLocalStorage('test-key', 0)
    );

    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(1);
  });

  it('removes from localStorage', () => {
    const { result } = renderHook(() =>
      useLocalStorage('test-key', 'initial')
    );

    act(() => {
      result.current[2]();
    });

    expect(result.current[0]).toBe('initial');
    expect(mockStorage.removeItem).toHaveBeenCalledWith('test-key');
  });
});

describe('usePrevious', () => {
  it('returns previous value', () => {
    const { result, rerender } = renderHook(
      ({ value }) => usePrevious(value),
      {
        initialProps: { value: 0 },
      }
    );

    expect(result.current).toBeUndefined();

    rerender({ value: 1 });
    expect(result.current).toBe(0);

    rerender({ value: 2 });
    expect(result.current).toBe(1);
  });
});
