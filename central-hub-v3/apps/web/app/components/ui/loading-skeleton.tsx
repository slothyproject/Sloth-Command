/**
 * Loading Skeleton Components
 * Reusable skeleton loaders for different content types
 */

import { cn } from '@/app/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-slate-700/50 rounded',
        className
      )}
    />
  );
}

// Card Skeleton
export function CardSkeleton() {
  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
    </div>
  );
}

// Table Skeleton
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <Skeleton className="h-6 w-full" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Chart Skeleton
export function ChartSkeleton() {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

// Service Card Skeleton
export function ServiceCardSkeleton() {
  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded-full" />
          <div>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-32 mt-1" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      
      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-3 w-8" />
        </div>
        <div className="flex-1 space-y-2">
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-3 w-8" />
        </div>
      </div>
    </div>
  );
}

// Page Skeleton
export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      
      <ChartSkeleton />
    </div>
  );
}

// Stats Grid Skeleton
export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={cn('grid gap-4', `grid-cols-${Math.min(count, 4)}`)} style={{
      gridTemplateColumns: `repeat(${Math.min(count, 4)}, minmax(0, 1fr))`
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

// Loading Spinner
export function LoadingSpinner({ 
  size = 'md', 
  className 
}: { 
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <svg
      className={cn('animate-spin text-cyan-400', sizes[size], className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// Full Page Loader
export function FullPageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center mb-4 animate-pulse">
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <p className="text-slate-400">{message}</p>
    </div>
  );
}

// Button with Loading State
export function LoadingButton({
  loading,
  children,
  ...props
}: {
  loading: boolean;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={loading}
      className={cn(
        'btn-primary px-4 py-2 rounded-lg flex items-center justify-center gap-2',
        loading && 'opacity-70 cursor-not-allowed'
      )}
      {...props}
    >
      {loading && <LoadingSpinner size="sm" />}
      {children}
    </button>
  );
}
