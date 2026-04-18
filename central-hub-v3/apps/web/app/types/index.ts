/**
 * Local Type Definitions
 * Mirror of @central-hub/shared-types for build compatibility
 */

// User Types
export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'user' | 'admin';
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tokens {
  access: string;
  refresh: string;
}

// Service Types
export interface Service {
  id: string;
  name: string;
  description?: string;
  railwayId?: string;
  status: ServiceStatus;
  cpuPercent?: number;
  memoryPercent?: number;
  diskPercent?: number;
  lastDeploymentAt?: string;
  lastRestartAt?: string;
  url?: string;
  repositoryUrl?: string;
  healthScore?: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export type ServiceStatus = 
  | 'healthy' 
  | 'degraded' 
  | 'unhealthy' 
  | 'paused' 
  | 'deploying' 
  | 'crashed';

export interface ServiceWithVariables extends Service {
  variables: Variable[];
}

// Variable Types
export interface Variable {
  id: string;
  serviceId: string;
  name: string;
  value: string;
  encrypted: boolean;
  category?: string;
  description?: string;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

export type VariableCategory = 
  | 'general'
  | 'database'
  | 'api'
  | 'auth'
  | 'integrations'
  | 'custom';

// Deployment Types
export interface Deployment {
  id: string;
  serviceId: string;
  status: DeploymentStatus;
  url?: string;
  logs?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export type DeploymentStatus = 
  | 'pending'
  | 'in_progress'
  | 'success'
  | 'failed'
  | 'cancelled';

// AI Intelligence Types
export interface AIInsight {
  id: string;
  serviceId: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  message: string;
  recommendation?: string;
  metric?: string;
  value?: number;
  autoFixable: boolean;
  fixedAt?: string;
  dismissedAt?: string;
  createdAt: string;
}

export type InsightType = 
  | 'performance'
  | 'cost'
  | 'reliability'
  | 'security'
  | 'anomaly'
  | 'recommendation';

export type InsightSeverity = 
  | 'critical'
  | 'warning'
  | 'suggestion'
  | 'info';

export interface AIPrediction {
  id: string;
  serviceId: string;
  metric: string;
  predictedValue: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  predictions: Array<{
    hour: number;
    value: number;
    confidence: number;
  }>;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    command?: string;
    executed?: boolean;
    result?: string;
  };
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}
