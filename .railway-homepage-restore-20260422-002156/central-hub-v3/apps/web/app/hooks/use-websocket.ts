"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

interface PipelineUpdate {
  pipelineId: string;
  runId: string;
  status: "running" | "success" | "failed" | "cancelled" | "pending";
  stage?: {
    id: string;
    name: string;
    status: string;
    logs: string[];
  };
  progress?: number;
  message?: string;
}

interface SystemAlert {
  id: string;
  severity: "info" | "warning" | "error" | "critical";
  title: string;
  message: string;
  serviceId?: string;
  serviceName?: string;
  timestamp: string;
  acknowledged?: boolean;
}

interface ServiceHealthUpdate {
  serviceId: string;
  serviceName: string;
  status: "healthy" | "degraded" | "unhealthy";
  metrics: {
    cpu?: number;
    memory?: number;
    disk?: number;
    uptime?: number;
  };
  issues?: string[];
  timestamp: string;
}

interface AutomationEvent {
  type: "healing" | "scaling" | "backup" | "deployment";
  status: "started" | "completed" | "failed";
  serviceId?: string;
  serviceName?: string;
  details: Record<string, any>;
  timestamp: string;
}

export function useWebSocket(channel: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;

  const connect = useCallback(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "wss://central-hub-api-production.up.railway.app";
    const ws = new WebSocket(`${wsUrl}/ws/${channel}`);

    ws.onopen = () => {
      console.log(`WebSocket connected: ${channel}`);
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastMessage(message);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onclose = () => {
      console.log(`WebSocket disconnected: ${channel}`);
      setIsConnected(false);

      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        setTimeout(connect, reconnectDelay * reconnectAttempts.current);
      }
    };

    ws.onerror = (error) => {
      console.error(`WebSocket error on ${channel}:`, error);
    };

    wsRef.current = ws;
  }, [channel]);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { isConnected, lastMessage, send };
}

export function usePipelineWebSocket(pipelineId?: string) {
  const { toast } = useToast();
  const channel = pipelineId ? `pipeline:${pipelineId}` : "pipelines";
  const { isConnected, lastMessage } = useWebSocket(channel);
  const [pipelineStatus, setPipelineStatus] = useState<string | null>(null);
  const [stageLogs, setStageLogs] = useState<Record<string, string[]>>({});
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    if (lastMessage?.type === "pipeline_update") {
      const update = lastMessage.data as PipelineUpdate;
      setPipelineStatus(update.status);
      setProgress(update.progress || 0);

      if (update.stage) {
        setStageLogs((prev) => ({
          ...prev,
          [update.stage!.id]: update.stage!.logs,
        }));
      }

      if (update.status === "success") {
        toast({
          title: "Pipeline Complete",
          description: update.message || "Deployment completed successfully",
        });
      } else if (update.status === "failed") {
        toast({
          title: "Pipeline Failed",
          description: update.message || "Deployment failed",
          variant: "destructive",
        });
      }
    }
  }, [lastMessage, toast]);

  return {
    isConnected,
    pipelineStatus,
    stageLogs,
    progress,
    lastUpdate: lastMessage?.data as PipelineUpdate | undefined,
  };
}

export function useSystemAlerts() {
  const { toast } = useToast();
  const { isConnected, lastMessage } = useWebSocket("alerts");
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);

  useEffect(() => {
    if (lastMessage?.type === "alert") {
      const alert = lastMessage.data as SystemAlert;
      setAlerts((prev) => [alert, ...prev].slice(0, 100));
      setUnacknowledgedCount((prev) => prev + 1);

      // Show toast for critical alerts
      if (alert.severity === "critical" || alert.severity === "error") {
        toast({
          title: alert.title,
          description: alert.message,
          variant: alert.severity === "critical" ? "destructive" : "default",
        });
      }
    } else if (lastMessage?.type === "alert_acknowledged") {
      const { alertId } = lastMessage.data;
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
      );
      setUnacknowledgedCount((prev) => Math.max(0, prev - 1));
    }
  }, [lastMessage, toast]);

  const acknowledgeAlert = useCallback((alertId: string) => {
    // Send acknowledgement through WebSocket or API
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setUnacknowledgedCount(0);
  }, []);

  return {
    isConnected,
    alerts,
    unacknowledgedCount,
    acknowledgeAlert,
    clearAlerts,
  };
}

export function useServiceHealthRealtime(serviceId?: string) {
  const channel = serviceId ? `service:${serviceId}` : "services";
  const { isConnected, lastMessage } = useWebSocket(channel);
  const [healthStatus, setHealthStatus] = useState<Record<string, ServiceHealthUpdate>>({});

  useEffect(() => {
    if (lastMessage?.type === "health_update") {
      const update = lastMessage.data as ServiceHealthUpdate;
      setHealthStatus((prev) => ({
        ...prev,
        [update.serviceId]: update,
      }));
    }
  }, [lastMessage]);

  return {
    isConnected,
    healthStatus,
    getServiceHealth: (id: string) => healthStatus[id],
  };
}

export function useAutomationEvents() {
  const { toast } = useToast();
  const { isConnected, lastMessage } = useWebSocket("automation");
  const [events, setEvents] = useState<AutomationEvent[]>([]);
  const [activeOperations, setActiveOperations] = useState<string[]>([]);

  useEffect(() => {
    if (lastMessage?.type === "automation_event") {
      const event = lastMessage.data as AutomationEvent;
      setEvents((prev) => [event, ...prev].slice(0, 50));

      if (event.status === "started") {
        setActiveOperations((prev) => [...prev, event.type]);
        toast({
          title: `Automation Started`,
          description: `${event.type} initiated for ${event.serviceName || "system"}`,
        });
      } else if (event.status === "completed") {
        setActiveOperations((prev) => prev.filter((t) => t !== event.type));
        toast({
          title: `Automation Complete`,
          description: `${event.type} completed successfully`,
        });
      } else if (event.status === "failed") {
        setActiveOperations((prev) => prev.filter((t) => t !== event.type));
        toast({
          title: `Automation Failed`,
          description: `${event.type} failed for ${event.serviceName || "system"}`,
          variant: "destructive",
        });
      }
    }
  }, [lastMessage, toast]);

  return {
    isConnected,
    events,
    activeOperations,
    hasActiveOperations: activeOperations.length > 0,
  };
}

export function useDeploymentNotifications() {
  const { toast } = useToast();
  const { isConnected, lastMessage } = useWebSocket("deployments");

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case "deployment_started":
        toast({
          title: "🚀 Deployment Started",
          description: `Deploying ${lastMessage.data.serviceName}...`,
        });
        break;
      case "deployment_progress":
        // Could update a progress UI here
        break;
      case "deployment_complete":
        toast({
          title: "✅ Deployment Complete",
          description: `${lastMessage.data.serviceName} deployed successfully`,
        });
        break;
      case "deployment_failed":
        toast({
          title: "❌ Deployment Failed",
          description: lastMessage.data.error || "Deployment failed",
          variant: "destructive",
        });
        break;
      case "rollback_complete":
        toast({
          title: "↩️ Rollback Complete",
          description: `Rolled back to ${lastMessage.data.targetVersion}`,
        });
        break;
    }
  }, [lastMessage, toast]);

  return { isConnected };
}
