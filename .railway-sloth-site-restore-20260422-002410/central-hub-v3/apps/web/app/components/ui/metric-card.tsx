/**
 * Metric Card Component
 * Display metrics with trends, comparisons, and sparklines
 */

import React from 'react';
import { cn } from '@/app/lib/utils';

export type TrendDirection = 'up' | 'down' | 'neutral';
export type MetricSize = 'sm' | 'md' | 'lg';
export type MetricColor = 'cyan' | 'violet' | 'green' | 'red' | 'yellow' | 'slate';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    direction: TrendDirection;
    value: string;
    label?: string;
  };
  comparison?: {
    current: number;
    previous: number;
    label?: string;
  };
  sparkline?: number[];
  icon?: React.ReactNode;
  color?: MetricColor;
  size?: MetricSize;
  className?: string;
  onClick?: () => void;
  loading?: boolean;
}

const colorConfig: Record<MetricColor, {
  gradient: string;
  iconBg: string;
  trendUp: string;
  trendDown: string;
  sparkline: string;
}> = {
  cyan: {
    gradient: 'from-cyan-500/20 to-cyan-600/20',
    iconBg: 'from-cyan-500/20 to-cyan-600/20 text-cyan-400',
    trendUp: 'text-cyan-400',
    trendDown: 'text-red-400',
    sparkline: '#06b6d4',
  },
  violet: {
    gradient: 'from-violet-500/20 to-violet-600/20',
    iconBg: 'from-violet-500/20 to-violet-600/20 text-violet-400',
    trendUp: 'text-violet-400',
    trendDown: 'text-red-400',
    sparkline: '#8b5cf6',
  },
  green: {
    gradient: 'from-green-500/20 to-green-600/20',
    iconBg: 'from-green-500/20 to-green-600/20 text-green-400',
    trendUp: 'text-green-400',
    trendDown: 'text-red-400',
    sparkline: '#22c55e',
  },
  red: {
    gradient: 'from-red-500/20 to-red-600/20',
    iconBg: 'from-red-500/20 to-red-600/20 text-red-400',
    trendUp: 'text-red-400',
    trendDown: 'text-green-400',
    sparkline: '#ef4444',
  },
  yellow: {
    gradient: 'from-yellow-500/20 to-yellow-600/20',
    iconBg: 'from-yellow-500/20 to-yellow-600/20 text-yellow-400',
    trendUp: 'text-yellow-400',
    trendDown: 'text-green-400',
    sparkline: '#eab308',
  },
  slate: {
    gradient: 'from-slate-500/20 to-slate-600/20',
    iconBg: 'from-slate-500/20 to-slate-600/20 text-slate-400',
    trendUp: 'text-slate-400',
    trendDown: 'text-slate-400',
    sparkline: '#64748b',
  },
};

const sizeConfig: Record<MetricSize, {
  value: string;
  title: string;
  icon: string;
}> = {
  sm: {
    value: 'text-xl',
    title: 'text-sm',
    icon: 'w-8 h-8',
  },
  md: {
    value: 'text-2xl',
    title: 'text-sm',
    icon: 'w-10 h-10',
  },
  lg: {
    value: 'text-3xl',
    title: 'text-base',
    icon: 'w-12 h-12',
  },
};

// Simple sparkline component
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Generate SVG path
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 80 - 10; // Leave some padding
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="w-full h-12 mt-4"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
      {/* Area fill */}
      <polygon
        fill={`${color}20`}
        stroke="none"
        points={`0,100 ${points} 100,100`}
      />
    </svg>
  );
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  comparison,
  sparkline,
  icon,
  color = 'cyan',
  size = 'md',
  className,
  onClick,
  loading = false,
}: MetricCardProps) {
  const colors = colorConfig[color];
  const sizes = sizeConfig[size];

  if (loading) {
    return (
      <div className={cn('glass-card p-4 animate-pulse', className)}>
        <div className="h-4 bg-slate-800 rounded w-24 mb-2" />
        <div className="h-8 bg-slate-800 rounded w-16" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'glass-card p-4 transition-all',
        onClick && 'cursor-pointer hover:bg-white/5',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className={cn('text-slate-400', sizes.title)}>{title}</p>

          {/* Value */}
          <p className={cn('font-bold text-white mt-1', sizes.value)}>{value}</p>

          {/* Subtitle */}
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
          )}

          {/* Trend */}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={cn(
                  'text-sm font-medium',
                  trend.direction === 'up' ? colors.trendUp : colors.trendDown
                )}
              >
                {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}{' '}
                {trend.value}
              </span>
              {trend.label && (
                <span className="text-xs text-slate-500">{trend.label}</span>
              )}
            </div>
          )}

          {/* Comparison */}
          {comparison && (
            <div className="mt-2 text-xs text-slate-500">
              <span className={cn(
                comparison.current > comparison.previous ? 'text-green-400' : 'text-slate-400'
              )}>
                {((comparison.current - comparison.previous) / comparison.previous * 100).toFixed(1)}%
              </span>
              {' '}{comparison.label || 'vs last period'}
            </div>
          )}
        </div>

        {/* Icon */}
        {icon && (
          <div
            className={cn(
              'rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 ml-4',
              sizes.icon,
              colors.iconBg
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Sparkline */}
      {sparkline && sparkline.length > 0 && (
        <Sparkline data={sparkline} color={colors.sparkline} />
      )}
    </div>
  );
}

// Metric Group - for displaying related metrics
interface MetricGroupProps {
  title?: string;
  metrics: Array<{
    label: string;
    value: string | number;
    trend?: TrendDirection;
  }>;
  className?: string;
}

export function MetricGroup({ title, metrics, className }: MetricGroupProps) {
  return (
    <div className={cn('glass-card p-4', className)}>
      {title && (
        <h4 className="text-sm font-medium text-slate-300 mb-3">{title}</h4>
      )}
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((metric, index) => (
          <div key={index} className="text-center">
            <p className="text-2xl font-bold text-white">{metric.value}</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              {metric.trend && (
                <span
                  className={cn(
                    'text-xs',
                    metric.trend === 'up' && 'text-green-400',
                    metric.trend === 'down' && 'text-red-400',
                    metric.trend === 'neutral' && 'text-slate-400'
                  )}
                >
                  {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'}
                </span>
              )}
              <p className="text-xs text-slate-400">{metric.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Stat Card - Simple stat display
interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  change?: number;
  className?: string;
}

export function StatCard({ label, value, unit, change, className }: StatCardProps) {
  return (
    <div className={cn('text-center', className)}>
      <p className="text-slate-400 text-sm">{label}</p>
      <div className="flex items-baseline justify-center gap-1 mt-1">
        <span className="text-2xl font-bold text-white">{value}</span>
        {unit && <span className="text-sm text-slate-500">{unit}</span>}
      </div>
      {change !== undefined && (
        <p
          className={cn(
            'text-xs mt-1',
            change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-slate-400'
          )}
        >
          {change > 0 ? '+' : ''}{change}%
        </p>
      )}
    </div>
  );
}
