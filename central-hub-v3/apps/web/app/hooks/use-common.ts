/**
 * Custom Hooks
 * Utility hooks for common patterns
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ============================================================================
// DEBOUNCE & THROTTLE
// ============================================================================

/**
 * useDebounce - Delay value updates until after delay has passed
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * useDebounceCallback - Debounce a callback function
 */
export function useDebounceCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );
}

/**
 * useThrottle - Limit updates to once per interval
 */
export function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdated = useRef<number>(Date.now());

  useEffect(() => {
    const now = Date.now();
    const timeElapsed = now - lastUpdated.current;

    if (timeElapsed >= interval) {
      setThrottledValue(value);
      lastUpdated.current = now;
    } else {
      const timer = setTimeout(() => {
        setThrottledValue(value);
        lastUpdated.current = Date.now();
      }, interval - timeElapsed);

      return () => clearTimeout(timer);
    }
  }, [value, interval]);

  return throttledValue;
}

/**
 * useThrottleCallback - Throttle a callback function
 */
export function useThrottleCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  interval: number
): (...args: Parameters<T>) => void {
  const lastRun = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastRun.current >= interval) {
        callback(...args);
        lastRun.current = now;
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          callback(...args);
          lastRun.current = Date.now();
        }, interval - (now - lastRun.current));
      }
    },
    [callback, interval]
  );
}

// ============================================================================
// ASYNC ACTIONS
// ============================================================================

interface UseAsyncActionState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

interface UseAsyncActionReturn<T, Args extends unknown[]> extends UseAsyncActionState<T> {
  execute: (...args: Args) => Promise<T | null>;
  reset: () => void;
}

/**
 * useAsyncAction - Execute async actions with loading/error states
 */
export function useAsyncAction<T, Args extends unknown[] = unknown[]>(
  asyncFunction: (...args: Args) => Promise<T>,
  immediate = false
): UseAsyncActionReturn<T, Args> {
  const [state, setState] = useState<UseAsyncActionState<T>>({
    data: null,
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
  });

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      setState((prev) => ({ ...prev, isLoading: true, isError: false, isSuccess: false }));

      try {
        const data = await asyncFunction(...args);
        setState({
          data,
          error: null,
          isLoading: false,
          isSuccess: true,
          isError: false,
        });
        return data;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState({
          data: null,
          error: err,
          isLoading: false,
          isSuccess: false,
          isError: true,
        });
        return null;
      }
    },
    [asyncFunction]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isLoading: false,
      isSuccess: false,
      isError: false,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

// ============================================================================
// PAGINATION
// ============================================================================

interface UsePaginationOptions {
  totalItems: number;
  pageSize?: number;
  initialPage?: number;
  siblingCount?: number;
}

interface UsePaginationReturn {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  pageRange: (number | string)[];
  canGoPrevious: boolean;
  canGoNext: boolean;
  goToPage: (page: number) => void;
  goToPrevious: () => void;
  goToNext: () => void;
  goToFirst: () => void;
  goToLast: () => void;
  startIndex: number;
  endIndex: number;
}

/**
 * usePagination - Pagination logic with ellipsis handling
 */
export function usePagination({
  totalItems,
  pageSize = 10,
  initialPage = 1,
  siblingCount = 1,
}: UsePaginationOptions): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(initialPage);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Ensure current page is valid when total changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Generate page range with ellipsis
  const pageRange = useMemo(() => {
    const range: (number | string)[] = [];

    if (totalPages <= 7) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        range.push(i);
      }
    } else {
      // Show with ellipsis
      const leftSibling = Math.max(2, currentPage - siblingCount);
      const rightSibling = Math.min(totalPages - 1, currentPage + siblingCount);

      const showLeftEllipsis = leftSibling > 2;
      const showRightEllipsis = rightSibling < totalPages - 1;

      range.push(1); // First page

      if (showLeftEllipsis) {
        range.push('...');
      } else {
        for (let i = 2; i < leftSibling; i++) {
          range.push(i);
        }
      }

      for (let i = leftSibling; i <= rightSibling; i++) {
        range.push(i);
      }

      if (showRightEllipsis) {
        range.push('...');
      } else {
        for (let i = rightSibling + 1; i < totalPages; i++) {
          range.push(i);
        }
      }

      range.push(totalPages); // Last page
    }

    return range;
  }, [currentPage, totalPages, siblingCount]);

  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  }, [totalPages]);

  const goToPrevious = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const goToFirst = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const goToLast = useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  return {
    currentPage,
    pageSize,
    totalPages,
    pageRange,
    canGoPrevious: currentPage > 1,
    canGoNext: currentPage < totalPages,
    goToPage,
    goToPrevious,
    goToNext,
    goToFirst,
    goToLast,
    startIndex,
    endIndex,
  };
}

// ============================================================================
// REAL-TIME
// ============================================================================

interface UseRealTimeOptions {
  interval?: number;
  enabled?: boolean;
  onError?: (error: Error) => void;
}

/**
 * useRealTime - Execute callback at intervals
 */
export function useRealTime(
  callback: () => void | Promise<void>,
  options: UseRealTimeOptions = {}
): { isActive: boolean; stop: () => void; start: () => void } {
  const { interval = 5000, enabled = true, onError } = options;
  const [isActive, setIsActive] = useState(enabled);
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!isActive) return;

    const tick = async () => {
      try {
        await callbackRef.current();
      } catch (error) {
        if (onError && error instanceof Error) {
          onError(error);
        }
      }
    };

    // Execute immediately on start
    tick();

    const timer = setInterval(tick, interval);

    return () => clearInterval(timer);
  }, [isActive, interval, onError]);

  const stop = useCallback(() => setIsActive(false), []);
  const start = useCallback(() => setIsActive(true), []);

  return { isActive, stop, start };
}

// ============================================================================
// INTERSECTION OBSERVER
// ============================================================================

interface UseIntersectionOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

/**
 * useIntersection - Detect when element enters viewport
 */
export function useIntersection<T extends HTMLElement = HTMLDivElement>(
  options: UseIntersectionOptions = {}
): [(node: T | null) => void, boolean] {
  const { threshold = 0.1, rootMargin = '0px', triggerOnce = false } = options;
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const elementRef = useRef<T | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setRef = useCallback(
    (node: T | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      elementRef.current = node;

      if (node) {
        observerRef.current = new IntersectionObserver(
          ([entry]) => {
            const isVisible = entry.isIntersecting;

            if (triggerOnce) {
              if (isVisible && !hasTriggered) {
                setIsIntersecting(true);
                setHasTriggered(true);
                observerRef.current?.disconnect();
              }
            } else {
              setIsIntersecting(isVisible);
            }
          },
          { threshold, rootMargin }
        );

        observerRef.current.observe(node);
      }
    },
    [threshold, rootMargin, triggerOnce, hasTriggered]
  );

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return [setRef, isIntersecting];
}

// ============================================================================
// LOCAL STORAGE
// ============================================================================

/**
 * useLocalStorage - Persist state to localStorage
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window === 'undefined') return initialValue;
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}

// ============================================================================
// CLICK OUTSIDE
// ============================================================================

/**
 * useClickOutside - Detect clicks outside an element
 */
export function useClickOutside<T extends HTMLElement = HTMLDivElement>(
  handler: () => void
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handler]);

  return ref;
}

// ============================================================================
// PREVIOUS VALUE
// ============================================================================

/**
 * usePrevious - Get previous value of a state
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

// ============================================================================
// COUNTDOWN TIMER
// ============================================================================

interface UseCountdownReturn {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isComplete: boolean;
  formatted: string;
}

/**
 * useCountdown - Countdown to a target date
 */
export function useCountdown(targetDate: Date): UseCountdownReturn {
  const calculateTimeLeft = useCallback(() => {
    const difference = targetDate.getTime() - Date.now();

    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isComplete: true };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      isComplete: false,
    };
  }, [targetDate]);

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateTimeLeft]);

  const formatted = `${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`;

  return { ...timeLeft, formatted };
}

// ============================================================================
// HOVER
// ============================================================================

/**
 * useHover - Track hover state of an element
 */
export function useHover<T extends HTMLElement = HTMLDivElement>(): [
  React.RefObject<T | null>,
  boolean,
] {
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => setIsHovered(false);

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return [ref, isHovered];
}
