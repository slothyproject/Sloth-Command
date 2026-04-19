/**
 * Status Badge Component
 * Reusable status indicator with consistent styling across the app
 */

import React from 'react';
import { cn } from '@/app/lib/utils';

export type StatusType = 
  | 'healthy' | 'warning' | 'critical' | 'unknown' | 'offline'
  | 'success' | 'error' | 'info' | 'pending' | 'running'
  | 'completed' | 'failed' | 'cancelled' | 'approved' | 'open'
  | 'in_progress' | 'resolved' | 'dismissed' | 'active' | 'inactive';

export type StatusSize = 'sm' | 'md' | 'lg';
export type StatusVariant = 'default' | 'dot' | 'outline' | 'subtle';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: StatusSize;
  variant?: StatusVariant;
  className?: string;
  pulse?: boolean;
}

const statusConfig: Record<StatusType, { 
  label: string; 
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
}> = {
  // Health states
  healthy: {
    label: 'Healthy',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
    dotColor: 'bg-green-400',
  },
  warning: {
    label: 'Warning',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/30',
    dotColor: 'bg-yellow-400',
  },
  critical: {
    label: 'Critical',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    dotColor: 'bg-red-400',
  },
  unknown: {
    label: 'Unknown',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/20',
    borderColor: 'border-slate-500/30',
    dotColor: 'bg-slate-400',
  },
  offline: {
    label: 'Offline',
    color: 'text-slate-500',
    bgColor: 'bg-slate-600/20',
    borderColor: 'border-slate-600/30',
    dotColor: 'bg-slate-500',
  },
  // General states
  success: {
    label: 'Success',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
    dotColor: 'bg-green-400',
  },
  error: {
    label: 'Error',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    dotColor: 'bg-red-400',
  },
  info: {
    label: 'Info',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/30',
    dotColor: 'bg-cyan-400',
  },
  pending: {
    label: 'Pending',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/30',
    dotColor: 'bg-yellow-400',
  },
  running: {
    label: 'Running',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/20',
    borderColor: 'border-violet-500/30',
    dotColor: 'bg-violet-400',
  },
  // Task/Workflow states
  completed: {
    label: 'Completed',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
    dotColor: 'bg-green-400',
  },
  failed: {
    label: 'Failed',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    dotColor: 'bg-red-400',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/20',
    borderColor: 'border-slate-500/30',
    dotColor: 'bg-slate-400',
  },
  approved: {
    label: 'Approved',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/30',
    dotColor: 'bg-cyan-400',
  },
  // Issue states
  open: {
    label: 'Open',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/30',
    dotColor: 'bg-yellow-400',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/30',
    dotColor: 'bg-cyan-400',
  },
  resolved: {
    label: 'Resolved',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
    dotColor: 'bg-green-400',
  },
  dismissed: {
    label: 'Dismissed',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/20',
    borderColor: 'border-slate-500/30',
    dotColor: 'bg-slate-400',
  },
  // Activity states
  active: {
    label: 'Active',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
    dotColor: 'bg-green-400',
  },
  inactive: {
    label: 'Inactive',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/20',
    borderColor: 'border-slate-500/30',
    dotColor: 'bg-slate-400',
  },
};

const sizeConfig: Record<StatusSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function StatusBadge({
  status,
  label,
  size = 'md',
  variant = 'default',
  className,
  pulse = false,
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const displayLabel = label || config.label;

  if (variant === 'dot') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span
          className={cn(
            'inline-block rounded-full',
            size === 'sm' && 'w-2 h-2',
            size === 'md' && 'w-2.5 h-2.5',
            size === 'lg' && 'w-3 h-3',
            config.dotColor,
            pulse && 'animate-pulse'
          )}
        />
        <span
          className={cn(
            size === 'sm' && 'text-xs',
            size === 'md' && 'text-sm',
            size === 'lg' && 'text-base',
            config.color
          )}
        >
          {displayLabel}
        </span>
      </div>
    );
  }

  if (variant === 'outline') {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full font-medium border',
          sizeConfig[size],
          config.color,
          config.borderColor,
          className
        )}
      >
        {displayLabel}
      </span>
    );
  }

  if (variant === 'subtle') {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded font-medium',
          sizeConfig[size],
          config.color,
          className
        )}
      >
        {displayLabel}
      </span>
    );
  }

  // Default variant
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium border',
        sizeConfig[size],
        config.bgColor,
        config.color,
        config.borderColor,
        className
      )}
    >
      {pulse && (
        <span
          className={cn(
            'mr-1.5 inline-block rounded-full animate-pulse',
            size === 'sm' && 'w-1.5 h-1.5',
            size === 'md' && 'w-2 h-2',
            size === 'lg' && 'w-2.5 h-2.5',
            config.dotColor
          )}
        />
      )}
      {displayLabel}
    </span>
  );
}

// Status Group - for showing multiple statuses
interface StatusGroupProps {
  statuses: Array<{ status: StatusType; count: number }>;
  size?: StatusSize;
  className?: string;
}

export function StatusGroup({ statuses, size = 'sm', className }: StatusGroupProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {statuses.map(({ status, count }) => (
        count > 0 && (
          <StatusBadge
            key={status}
            status={status}
            label={`${count}`}
            size={size}
            variant="default"
          />
        )
      ))}
    </div>
  );
}

// Status Icon - Icon-only status indicator
interface StatusIconProps {
  status: StatusType;
  size?: StatusSize;
  className?: string;
  pulse?: boolean;
}

export function StatusIcon({ status, size = 'md', className, pulse = false }: StatusIconProps) {
  const config = statusConfig[status];
  
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center',
        size === 'sm' && 'w-6 h-6',
        size === 'md' && 'w-8 h-8',
        size === 'lg' && 'w-10 h-10',
        config.bgColor,
        pulse && 'animate-pulse',
        className
      )}
    >
      <div className={cn(sizeMap[size], config.dotColor, 'rounded-full')} />
    </div>
  );
}
