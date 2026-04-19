/**
 * UI Components Index
 * Reusable UI components for Central Hub v4.0
 */

// Status Badge
export { StatusBadge, StatusGroup, StatusIcon, type StatusType, type StatusSize, type StatusVariant } from './status-badge';

// Metric Card
export { MetricCard, MetricGroup, StatCard, type TrendDirection, type MetricSize, type MetricColor } from './metric-card';

// Data Table
export { DataTable, type Column, type SortDirection } from './data-table';

// Timeline
export { Timeline, ActivityFeed, type TimelineEvent } from './timeline';

// Loading Skeletons
export { 
  Skeleton, 
  CardSkeleton, 
  StatsGridSkeleton, 
  TableSkeleton,
  ChartSkeleton,
  TimelineSkeleton,
  FormSkeleton,
  ListSkeleton,
  PageSkeleton,
  DetailSkeleton,
  WidgetSkeleton,
  Shimmer,
  Loading 
} from './skeleton';

// Error Boundary
export { 
  ErrorBoundary, 
  AsyncErrorBoundary, 
  PageError, 
  SectionError,
  logError,
  getErrorMessage 
} from './error-boundary';

// Confirmation Dialog
export { ConfirmationDialog, AlertDialog } from './confirmation-dialog';

// Chart Wrapper
export { ChartWrapper, MiniChart, StatTrend } from './chart-wrapper';
