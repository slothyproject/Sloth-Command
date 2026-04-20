/**
 * Timeline Component
 * Display chronological events with rich details
 */

import React from 'react';
import { cn } from '@/app/lib/utils';
import { StatusBadge, type StatusType } from './status-badge';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description?: string;
  status?: StatusType;
  icon?: React.ReactNode;
  color?: 'cyan' | 'violet' | 'green' | 'red' | 'yellow' | 'slate';
  metadata?: Array<{ label: string; value: string }>;
  actions?: Array<{ label: string; onClick: () => void; variant?: 'primary' | 'secondary' | 'danger' }>;
}

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
  loading?: boolean;
  emptyMessage?: string;
  showTimeMarkers?: boolean;
  groupByDate?: boolean;
}

const colorConfig = {
  cyan: 'bg-cyan-500',
  violet: 'bg-violet-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
  slate: 'bg-slate-500',
};

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function formatDateHeader(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (eventDate.getTime() === today.getTime()) return 'Today';
  if (eventDate.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function Timeline({
  events,
  className,
  loading = false,
  emptyMessage = 'No events to display',
  showTimeMarkers = true,
  groupByDate = true,
}: TimelineProps) {
  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-slate-800 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-800 rounded w-3/4" />
              <div className="h-3 bg-slate-800 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  // Group events by date
  const groupedEvents = groupByDate
    ? events.reduce((acc, event) => {
        const dateKey = formatDateHeader(event.timestamp);
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(event);
        return acc;
      }, {} as Record<string, TimelineEvent[]>)
    : { '': events };

  return (
    <div className={cn('space-y-8', className)}>
      {Object.entries(groupedEvents).map(([dateKey, dateEvents]) => (
        <div key={dateKey} className="space-y-4">
          {groupByDate && dateKey && (
            <div className="sticky top-0 z-10 py-2 bg-slate-950/80 backdrop-blur">
              <span className="text-sm font-medium text-slate-400 px-4">{dateKey}</span>
            </div>
          )}

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-white/10" />

            <div className="space-y-4">
              {dateEvents.map((event, index) => (
                <TimelineItem
                  key={event.id}
                  event={event}
                  showTimeMarker={showTimeMarkers}
                  isLast={index === dateEvents.length - 1}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineItem({
  event,
  showTimeMarker,
  isLast,
}: {
  event: TimelineEvent;
  showTimeMarker: boolean;
  isLast: boolean;
}) {
  const color = event.color || 'cyan';

  return (
    <div className="relative flex gap-4 pl-4">
      {/* Icon / Status indicator */}
      <div className="relative z-10 shrink-0">
        {event.icon ? (
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center',
              colorConfig[color],
              'bg-opacity-20'
            )}
          >
            <div className={cn('w-5 h-5', `text-${color}-400`)}>{event.icon}</div>
          </div>
        ) : event.status ? (
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
            <StatusIcon status={event.status} />
          </div>
        ) : (
          <div className={cn('w-3 h-3 rounded-full mt-3.5', colorConfig[color])} />
        )}

        {/* Connector line to next item */}
        {!isLast && !event.icon && !event.status && (
          <div className="absolute top-6 left-1.5 w-px h-full bg-white/10" />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 pb-4', !isLast && 'border-b border-white/5')}
>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Title and time */}
            <div className="flex items-center gap-3 flex-wrap">
              <h4 className="font-medium text-white">{event.title}</h4>
              {showTimeMarker && (
                <span className="text-xs text-slate-500">
                  {formatTimeAgo(event.timestamp)}
                </span>
              )}
              {event.status && (
                <StatusBadge status={event.status} size="sm" variant="default" />
              )}
            </div>

            {/* Description */}
            {event.description && (
              <p className="text-sm text-slate-400 mt-1">{event.description}</p>
            )}

            {/* Metadata */}
            {event.metadata && event.metadata.length > 0 && (
              <div className="flex items-center gap-4 mt-2 text-xs">
                {event.metadata.map((item, idx) => (
                  <span key={idx} className="text-slate-500">
                    <span className="text-slate-400">{item.label}:</span>{' '}
                    {item.value}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          {event.actions && event.actions.length > 0 && (
            <div className="flex items-center gap-2 ml-4 shrink-0">
              {event.actions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={action.onClick}
                  className={cn(
                    'px-3 py-1.5 rounded text-sm transition-colors',
                    action.variant === 'danger' &&
                      'bg-red-500/20 text-red-400 hover:bg-red-500/30',
                    action.variant === 'primary' &&
                      'bg-violet-500/20 text-violet-400 hover:bg-violet-500/30',
                    (!action.variant || action.variant === 'secondary') &&
                      'bg-white/5 text-slate-400 hover:bg-white/10'
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Status icon mapping
function StatusIcon({ status }: { status: StatusType }) {
  const icons: Record<string, React.ReactNode> = {
    healthy: (
      <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
      </svg>
    ),
    critical: (
      <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    success: (
      <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    running: (
      <svg className="w-5 h-5 text-violet-400 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    pending: (
      <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return icons[status] || (
    <div className="w-2 h-2 rounded-full bg-slate-400" />
  );
}

// Activity Feed - Simplified timeline for compact displays
interface ActivityFeedProps {
  activities: Array<{
    id: string;
    user?: string;
    action: string;
    target?: string;
    timestamp: string;
    icon?: React.ReactNode;
  }>;
  className?: string;
}

export function ActivityFeed({ activities, className }: ActivityFeedProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
          {activity.icon || (
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
              <span className="text-xs font-medium text-slate-400">
                {activity.user?.charAt(0) || '?'}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-300">
              {activity.user && <span className="font-medium text-white">{activity.user}</span>}{' '}
              {activity.action}
              {activity.target && (
                <span className="text-cyan-400"> {activity.target}</span>
              )}
            </p>
            <p className="text-xs text-slate-500 mt-1">{formatTimeAgo(activity.timestamp)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
