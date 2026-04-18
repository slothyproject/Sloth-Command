/**
 * Analytics Page
 * Comprehensive analytics and metrics dashboard
 */

'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { cn } from '@/app/lib/utils';

type TimeRange = '24h' | '7d' | '30d' | '90d';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [activeTab, setActiveTab] = useState('overview');

  // Mock data
  const trafficData = [
    { time: '00:00', requests: 120, errors: 2 },
    { time: '04:00', requests: 80, errors: 1 },
    { time: '08:00', requests: 450, errors: 5 },
    { time: '12:00', requests: 890, errors: 8 },
    { time: '16:00', requests: 720, errors: 6 },
    { time: '20:00', requests: 340, errors: 3 },
    { time: '23:59', requests: 180, errors: 2 },
  ];

  const costData = [
    { service: 'Website', cost: 85, color: '#06b6d4' },
    { service: 'API Backend', cost: 120, color: '#8b5cf6' },
    { service: 'Discord Bot', cost: 45, color: '#f59e0b' },
    { service: 'Token Vault', cost: 25, color: '#22c55e' },
  ];

  const performanceData = [
    { metric: 'P50', value: 45, target: 50 },
    { metric: 'P95', value: 120, target: 100 },
    { metric: 'P99', value: 280, target: 200 },
  ];

  const stats = {
    totalRequests: '1.2M',
    avgResponseTime: '145ms',
    errorRate: '0.12%',
    uptime: '99.98%',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-slate-400 mt-1">Track performance, costs, and usage metrics</p>
        </div>

        <div className="flex items-center gap-2">
          {(['24h', '7d', '30d', '90d'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                timeRange === range
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
              )}
            >
              {range === '24h' && 'Last 24 Hours'}
              {range === '7d' && 'Last 7 Days'}
              {range === '30d' && 'Last 30 Days'}
              {range === '90d' && 'Last 90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Requests"
          value={stats.totalRequests}
          change="+12% from last period"
          trend="up"
          icon="Activity"
        />
        <StatCard
          title="Avg Response Time"
          value={stats.avgResponseTime}
          change="-5ms improvement"
          trend="up"
          icon="Clock"
        />
        <StatCard
          title="Error Rate"
          value={stats.errorRate}
          change="Within acceptable range"
          trend="stable"
          icon="AlertCircle"
        />
        <StatCard
          title="Uptime"
          value={stats.uptime}
          change="Excellent reliability"
          trend="up"
          icon="CheckCircle"
        />
      </div>

      {/* Traffic Chart */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-white">Traffic Overview</h3>
          <button className="btn-glass px-4 py-2 rounded-lg text-sm">
            Export Report
          </button>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trafficData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="requests"
                name="Requests"
                stroke="#06b6d4"
                fill="#06b6d4"
                fillOpacity={0.2}
              />
              <Area
                type="monotone"
                dataKey="errors"
                name="Errors"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Breakdown */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-white">Cost Breakdown</h3>
            <span className="text-2xl font-bold text-white">$275</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={costData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="cost"
                >
                  {costData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`$${value}`, 'Cost']}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 mt-4">
            {costData.map((item) => (
              <div key={item.service} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-400">{item.service}</span>
                </div>
                <span className="text-white font-medium">${item.cost}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Response Time Distribution */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-white">Response Time Distribution</h3>
            <span className="text-sm text-slate-400">In milliseconds</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="metric" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                <Tooltip
                  formatter={(value) => [`${value}ms`, 'Response Time']}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-center gap-6 mt-4">
            <LegendItem color="#8b5cf6" label="Actual" />
            <LegendItem color="#22c55e" label="Target" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card
function StatCard({
  title,
  value,
  change,
  trend,
  icon,
}: {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'stable';
  icon: string;
}) {
  const icons: Record<string, JSX.Element> = {
    Activity: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    Clock: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    AlertCircle: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    CheckCircle: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          <p
            className={cn(
              'text-xs mt-2',
              trend === 'up' && 'text-green-400',
              trend === 'down' && 'text-red-400',
              trend === 'stable' && 'text-slate-400'
            )}
          >
            {change}
          </p>
        </div>
        <div className="p-2 rounded-lg bg-white/5">
          <div className="text-cyan-400">{icons[icon]}</div>
        </div>
      </div>
    </div>
  );
}

// Legend Item
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-sm text-slate-400">{label}</span>
    </div>
  );
}
