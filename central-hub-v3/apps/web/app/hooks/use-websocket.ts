/**
 * WebSocket Hook
 * Real-time data updates via WebSocket
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type WebSocketStatus = 'connecting' | 'open' | 'closing' | 'closed' | 'error';

interface UseWebSocketOptions {
  url: string;
  protocols?: string | string[];
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeat?: boolean;
  heartbeatInterval?: number;
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
}

interface UseWebSocketReturn {
  sendMessage: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void;
  sendJson: (data: unknown) => void;
  lastMessage: MessageEvent | null;
  readyState: WebSocketStatus;
  isOpen: boolean;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    url,
    protocols,
    reconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    heartbeat = false,
    heartbeatInterval = 30000,
    onOpen,
    onMessage,
    onClose,
    onError,
  } = options;

  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [readyState, setReadyState] = useState<WebSocketStatus>('closed');
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldReconnectRef = useRef(true);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setReadyState('connecting');
      
      const ws = protocols 
        ? new WebSocket(url, protocols)
        : new WebSocket(url);
      
      wsRef.current = ws;

      ws.onopen = (event) => {
        setReadyState('open');
        reconnectAttemptsRef.current = 0;
        shouldReconnectRef.current = true;
        
        // Start heartbeat
        if (heartbeat) {
          heartbeatTimerRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, heartbeatInterval);
        }
        
        onOpen?.(event);
      };

      ws.onmessage = (event) => {
        setLastMessage(event);
        onMessage?.(event);
      };

      ws.onclose = (event) => {
        setReadyState('closed');
        
        // Clear heartbeat
        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current);
          heartbeatTimerRef.current = null;
        }

        onClose?.(event);

        // Attempt reconnect
        if (shouldReconnectRef.current && reconnect) {
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++;
            reconnectTimerRef.current = setTimeout(() => {
              connect();
            }, reconnectInterval * reconnectAttemptsRef.current); // Exponential backoff
          }
        }
      };

      ws.onerror = (event) => {
        setReadyState('error');
        onError?.(event);
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setReadyState('error');
    }
  }, [url, protocols, reconnect, reconnectInterval, maxReconnectAttempts, heartbeat, heartbeatInterval, onOpen, onMessage, onClose, onError]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    
    // Clear timers
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    } else {
      console.warn('WebSocket is not open. Message not sent:', data);
    }
  }, []);

  const sendJson = useCallback((data: unknown) => {
    sendMessage(JSON.stringify(data));
  }, [sendMessage]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    sendMessage,
    sendJson,
    lastMessage,
    readyState,
    isOpen: readyState === 'open',
    connect,
    disconnect,
  };
}

// Real-time data hook with automatic revalidation
interface UseRealTimeDataOptions<T> {
  queryKey: string[];
  fetchFn: () => Promise<T>;
  wsUrl?: string;
  wsChannel?: string;
  updateOnMessage?: (data: T, message: unknown) => T;
  refreshInterval?: number;
}

export function useRealTimeData<T>(options: UseRealTimeDataOptions<T>) {
  const {
    queryKey,
    fetchFn,
    wsUrl,
    wsChannel,
    updateOnMessage,
    refreshInterval,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initial fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const result = await fetchFn();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [fetchFn]);

  // WebSocket updates
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      
      // Check if message is for our channel
      if (wsChannel && message.channel !== wsChannel) {
        return;
      }

      if (updateOnMessage && data) {
        setData((prev) => prev ? updateOnMessage(prev, message) : prev);
      } else if (message.data) {
        setData(message.data);
      }
    } catch {
      // Ignore non-JSON messages
    }
  }, [data, wsChannel, updateOnMessage]);

  const { isOpen } = useWebSocket({
    url: wsUrl || '',
    onMessage: handleMessage,
    reconnect: true,
  });

  // Fallback to polling if WebSocket not available
  useEffect(() => {
    if (isOpen || !refreshInterval) return;

    const interval = setInterval(async () => {
      try {
        const result = await fetchFn();
        setData(result);
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [isOpen, refreshInterval, fetchFn]);

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await fetchFn();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn]);

  return {
    data,
    isLoading,
    error,
    refetch,
    isConnected: isOpen,
  };
}

// Live metrics hook
interface MetricPoint {
  timestamp: number;
  value: number;
  label?: string;
}

interface UseLiveMetricsOptions {
  metric: string;
  maxPoints?: number;
  wsUrl?: string;
}

export function useLiveMetrics(options: UseLiveMetricsOptions) {
  const { metric, maxPoints = 100, wsUrl } = options;
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      
      if (message.type === 'metric' && message.metric === metric) {
        setMetrics((prev) => {
          const newPoint: MetricPoint = {
            timestamp: Date.now(),
            value: message.value,
            label: message.label,
          };
          const updated = [...prev, newPoint];
          // Keep only maxPoints
          if (updated.length > maxPoints) {
            return updated.slice(-maxPoints);
          }
          return updated;
        });
      }
    } catch {
      // Ignore non-JSON messages
    }
  }, [metric, maxPoints]);

  const { isOpen, sendJson } = useWebSocket({
    url: wsUrl || '',
    onMessage: handleMessage,
    reconnect: true,
    heartbeat: true,
  });

  // Subscribe to metric on connect
  useEffect(() => {
    if (isOpen) {
      sendJson({
        type: 'subscribe',
        metric,
      });
    }
  }, [isOpen, metric, sendJson]);

  const clear = useCallback(() => {
    setMetrics([]);
  }, []);

  const current = metrics[metrics.length - 1]?.value ?? null;
  const average = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length
    : null;

  return {
    metrics,
    current,
    average,
    isConnected: isOpen,
    clear,
  };
}
