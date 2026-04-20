/**
 * Shared TypeScript Types for Central Hub
 */

// ============================================
// User Types
// ============================================

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

export interface AuthState {
  user: User | null;
  tokens: Tokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ============================================
// Service Types
// ============================================

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

// ============================================
// Variable Types
// ============================================

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

export interface VariableTemplate {
  id: string;
  name: string;
  category: VariableCategory;
  description: string;
  defaultValue?: string;
  isSecret: boolean;
}

// ============================================
// Deployment Types
// ============================================

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

// ============================================
// AI Intelligence Types
// ============================================

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

// ============================================
// Real-time Types
// ============================================

export interface RealtimeEvent {
  type: RealtimeEventType;
  timestamp: string;
  data: unknown;
}

export type RealtimeEventType = 
  | 'service:update'
  | 'service:health'
  | 'deployment:status'
  | 'deployment:log'
  | 'variable:update'
  | 'notification';

export interface ServiceHealthEvent {
  serviceId: string;
  status: ServiceStatus;
  cpuPercent: number;
  memoryPercent: number;
  timestamp: string;
}

// ============================================
// Analytics Types
// ============================================

export interface ServiceMetrics {
  serviceId: string;
  cpu: MetricDataPoint[];
  memory: MetricDataPoint[];
  requests: MetricDataPoint[];
  errors: MetricDataPoint[];
}

export interface MetricDataPoint {
  timestamp: string;
  value: number;
  unit?: string;
}

export interface CostEstimate {
  serviceId: string;
  currentMonthlyCost: number;
  predictedMonthlyCost: number;
  savingsPotential: number;
  breakdown: {
    compute: number;
    storage: number;
    bandwidth: number;
  };
}

// ============================================
// UI Types
// ============================================

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export interface ThemeConfig {
  mode: 'light' | 'dark' | 'system';
  primaryColor: string;
  accentColor: string;
}

export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  href?: string;
  children?: SidebarItem[];
  badge?: number;
}

// ============================================
// API Response Types
// ============================================

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

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// Form Types
// ============================================

export interface ServiceFormData {
  name: string;
  description?: string;
  railwayId?: string;
}

export interface VariableFormData {
  name: string;
  value: string;
  encrypted: boolean;
  category: VariableCategory;
  description?: string;
}

export interface LoginFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// ============================================
// Utility Types
// ============================================

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export type WithTimestamps<T> = T & {
  createdAt: string;
  updatedAt: string;
};
