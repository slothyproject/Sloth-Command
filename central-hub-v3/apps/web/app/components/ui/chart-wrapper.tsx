/**
 * Chart Wrapper Component
 * Consistent chart styling and error handling
 */

import React from 'react';
import { cn } from '@/app/lib/utils';
import { SectionError } from './error-boundary';

interface ChartWrapperProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
  error?: Error | null;
  loading?: boolean;
  onRetry?: () => void;
  legend?: Array<{ color: string; label: string }>;
  className?: string;
  actions?: React.ReactNode;
}

export function ChartWrapper({
  title,
  subtitle,
  children,
  height = 250,
  error,
  loading = false,
  onRetry,
  legend,
  className,
  actions,
}: ChartWrapperProps) {
  if (error) {
    return (
      <SectionError
        title="Failed to load chart"
        message="There was an error loading the chart data."
        onRetry={onRetry}
        className={className}
      />
    );
  }

  return (
    <div className={cn('glass-card p-4', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Loading State */}
      {loading ? (
        <div
          className="flex items-center justify-center"
          style={{ height }}
        >
          <div className="animate-pulse flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-800" />
            <div className="w-32 h-4 rounded bg-slate-800" />
          </div>
        </div>
      ) : (
        <>
          {/* Chart Content */}
          <div style={{ height }}>{children}</div>

          {/* Legend */}
          {legend && legend.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
              {legend.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-slate-400">{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Mini Chart - Compact chart for dashboards
interface MiniChartProps {
  data: number[];
  color?: string;
  height?: number;
  label?: string;
  value?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function MiniChart({
  data,
  color = '#06b6d4',
  height = 60,
  label,
  value,
  trend,
  className,
}: MiniChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          'glass-card p-4 flex items-center justify-center',
          className
        )}
        style={{ height: height + 32 }}
      >
        <span className="text-slate-500 text-sm">No data</span>
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Generate SVG path
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 80 - 10;
    return `${x},${y}`;
  }).join(' ');

  const trendIcons = {
    up: '↑',
    down: '↓',
    neutral: '→',
  };

  const trendColors = {
    up: 'text-green-400',
    down: 'text-red-400',
    neutral: 'text-slate-400',
  };

  return (
    <div className={cn('glass-card p-4', className)}>
      {/* Header */}
      {(label || value) && (
        <div className="flex items-center justify-between mb-2">
          {label && <span className="text-sm text-slate-400">{label}</span>}
          {value && (
            <div className="flex items-center gap-1">
              <span className="text-lg font-semibold text-white">{value}</span>
              {trend && (
                <span className={cn('text-sm', trendColors[trend])}>
                  {trendIcons[trend]}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        <defs>
          <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Area fill */}
        <polygon
          fill={`url(#gradient-${color.replace('#', '')})`}
          points={`0,100 ${points} 100,100`}
        />
        
        {/* Line */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

// Stat Trend - Mini stat with sparkline
interface StatTrendProps {
  label: string;
  value: string | number;
  data: number[];
  trend?: number; // Percentage change
  color?: string;
  className?: string;
}

export function StatTrend({
  label,
  value,
  data,
  trend,
  color = '#06b6d4',
  className,
}: StatTrendProps) {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className="flex-1">
        <p className="text-sm text-slate-400">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">{value}</span>
          {trend !== undefined && (
            <span
              className={cn(
                'text-sm',
                trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-slate-400'
              )}
            >
              {trend > 0 ? '+' : ''}{trend}%
            </span>
          )}
        </div>
      </div>
      <MiniChart data={data} color={color} height={40} className="w-24" />
    </div>
  );
}
