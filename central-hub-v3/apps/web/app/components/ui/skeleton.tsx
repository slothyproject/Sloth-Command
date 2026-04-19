/**
 * Loading Skeleton Components
 * Consistent loading states across the application
 */

import React from 'react';
import { cn } from '@/app/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const baseStyles = 'bg-slate-800';

  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-lg',
  };

  const animationStyles = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={cn(
        baseStyles,
        variantStyles[variant],
        animationStyles[animation],
        className
      )}
      style={style}
    />
  );
}

// Card Skeleton
interface CardSkeletonProps {
  header?: boolean;
  rows?: number;
  className?: string;
}

export function CardSkeleton({ header = true, rows = 3, className }: CardSkeletonProps) {
  return (
    <div className={cn('glass-card p-4 space-y-4', className)}>
      {header && (
        <div className="flex items-center justify-between">
          <Skeleton width="60%" height={24} />
          <Skeleton width={80} height={32} variant="rounded" />
        </div>
      )}
      <div className="space-y-3">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton width={40} height={40} variant="circular" />
            <div className="flex-1 space-y-2">
              <Skeleton width="70%" height={16} />
              <Skeleton width="40%" height={12} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Stats Grid Skeleton
interface StatsGridSkeletonProps {
  count?: number;
  className?: string;
}

export function StatsGridSkeleton({ count = 4, className }: StatsGridSkeletonProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="glass-card p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton width="60%" height={14} />
              <Skeleton width="40%" height={32} />
              <Skeleton width="50%" height={12} />
            </div>
            <Skeleton width={40} height={40} variant="rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Table Skeleton
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, columns = 4, className }: TableSkeletonProps) {
  return (
    <div className={cn('glass-card overflow-hidden', className)}>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex gap-4 pb-4 border-b border-white/10">
          {[...Array(columns)].map((_, i) => (
            <Skeleton key={i} width={`${100 / columns}%`} height={20} />
          ))}
        </div>
        {/* Rows */}
        {[...Array(rows)].map((_, rowIdx) => (
          <div key={rowIdx} className="flex gap-4 py-3">
            {[...Array(columns)].map((_, colIdx) => (
              <Skeleton
                key={colIdx}
                width={`${100 / columns}%`}
                height={16}
                animation={rowIdx % 2 === 0 ? 'pulse' : 'wave'}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Chart Skeleton
interface ChartSkeletonProps {
  height?: number;
  className?: string;
}

export function ChartSkeleton({ height = 250, className }: ChartSkeletonProps) {
  return (
    <div className={cn('glass-card p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton width={120} height={24} />
        <Skeleton width={80} height={20} />
      </div>
      <Skeleton width="100%" height={height} variant="rounded" />
    </div>
  );
}

// Timeline Skeleton
interface TimelineSkeletonProps {
  events?: number;
  className?: string;
}

export function TimelineSkeleton({ events = 5, className }: TimelineSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {[...Array(events)].map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="relative">
            <Skeleton width={40} height={40} variant="circular" />
            {i < events - 1 && (
              <div className="absolute top-10 left-5 w-px h-full bg-slate-800" />
            )}
          </div>
          <div className="flex-1 space-y-2 pb-6">
            <div className="flex items-center gap-2">
              <Skeleton width="40%" height={18} />
              <Skeleton width={60} height={16} />
            </div>
            <Skeleton width="80%" height={14} />
            <Skeleton width="60%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Form Skeleton
interface FormSkeletonProps {
  fields?: number;
  className?: string;
}

export function FormSkeleton({ fields = 4, className }: FormSkeletonProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {[...Array(fields)].map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton width={100} height={14} />
          <Skeleton width="100%" height={40} variant="rounded" />
        </div>
      ))}
      <Skeleton width={120} height={40} variant="rounded" className="mt-6" />
    </div>
  );
}

// List Skeleton
interface ListSkeletonProps {
  items?: number;
  avatar?: boolean;
  subtitle?: boolean;
  action?: boolean;
  className?: string;
}

export function ListSkeleton({
  items = 5,
  avatar = true,
  subtitle = true,
  action = true,
  className,
}: ListSkeletonProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {[...Array(items)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg bg-white/5"
        >
          {avatar && <Skeleton width={40} height={40} variant="circular" />}
          <div className="flex-1 space-y-2">
            <Skeleton width="60%" height={16} />
            {subtitle && <Skeleton width="40%" height={12} />}
          </div>
          {action && <Skeleton width={80} height={32} variant="rounded" />}
        </div>
      ))}
    </div>
  );
}

// Page Skeleton - Full page layout
interface PageSkeletonProps {
  header?: boolean;
  statsCount?: number;
  contentRows?: number;
  sidebar?: boolean;
  className?: string;
}

export function PageSkeleton({
  header = true,
  statsCount = 4,
  contentRows = 3,
  sidebar = true,
  className,
}: PageSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      {header && (
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton width={200} height={32} />
            <Skeleton width={300} height={16} />
          </div>
          <div className="flex gap-2">
            <Skeleton width={100} height={36} variant="rounded" />
            <Skeleton width={100} height={36} variant="rounded" />
          </div>
        </div>
      )}

      {/* Stats */}
      <StatsGridSkeleton count={statsCount} />

      {/* Main Content */}
      <div className={cn('grid gap-6', sidebar ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1')}>
        <div className={sidebar ? 'lg:col-span-2' : ''}>
          <CardSkeleton rows={contentRows} />
        </div>
        {sidebar && (
          <div className="space-y-4">
            <CardSkeleton rows={2} />
            <CardSkeleton rows={3} />
          </div>
        )}
      </div>
    </div>
  );
}

// Detail View Skeleton
interface DetailSkeletonProps {
  sections?: number;
  className?: string;
}

export function DetailSkeleton({ sections = 3, className }: DetailSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton width={64} height={64} variant="circular" />
        <div className="space-y-2 flex-1">
          <Skeleton width="50%" height={24} />
          <Skeleton width="30%" height={16} />
        </div>
        <Skeleton width={120} height={40} variant="rounded" />
      </div>

      {/* Sections */}
      {[...Array(sections)].map((_, i) => (
        <div key={i} className="glass-card p-4 space-y-4">
          <Skeleton width={150} height={20} />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="space-y-2">
                <Skeleton width="60%" height={12} />
                <Skeleton width="80%" height={16} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Dashboard Widget Skeleton
interface WidgetSkeletonProps {
  className?: string;
}

export function WidgetSkeleton({ className }: WidgetSkeletonProps) {
  return (
    <div className={cn('glass-card p-4 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <Skeleton width={100} height={18} />
        <Skeleton width={24} height={24} variant="circular" />
      </div>
      <Skeleton width="60%" height={36} />
      <Skeleton width="40%" height={14} />
    </div>
  );
}

// Shimmer effect wrapper
interface ShimmerProps {
  children: React.ReactNode;
  className?: string;
}

export function Shimmer({ children, className }: ShimmerProps) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {children}
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}

// Export all as Loading namespace
export const Loading = {
  Skeleton,
  Card: CardSkeleton,
  StatsGrid: StatsGridSkeleton,
  Table: TableSkeleton,
  Chart: ChartSkeleton,
  Timeline: TimelineSkeleton,
  Form: FormSkeleton,
  List: ListSkeleton,
  Page: PageSkeleton,
  Detail: DetailSkeleton,
  Widget: WidgetSkeleton,
  Shimmer,
};
