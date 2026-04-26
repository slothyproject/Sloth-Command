'use client';

import React, { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useAnalyticsOverview } from '@/app/hooks/use-analytics';
import { MetricCard } from '@/app/components/ui';
import { Loading, SectionError } from '@/app/components/ui';
import { cn } from '@/app/lib/utils';

type TimeRange = '24h' | '7d' | '30d' | '90d';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const { data, isLoading, isError, refetch } = useAnalyticsOverview(timeRange);

  const messagesData = data?.messagesOverTime ?? [];
  const commandsData = data?.topCommands ?? [];
  const ticketResolutionData = data?.ticketResolutionRate ?? [];
  const activityHeatmap = data?.activityHeatmap ?? [];

  const stats = {
    messages: data?.messages ? data.messages.toLocaleString() : '—',
    users: data?.users ? data.users.toLocaleString() : '—',
    moderationEvents: data?.moderationEvents ? data.moderationEvents.toLocaleString() : '—',
    ticketsResolved: data?.ticketsResolved ? data.ticketsResolved.toLocaleString() : '—',
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Analytics</h1>
            <p className="text-slate-400 mt-1">Loading analytics...</p>
          </div>
        </div>
        <Loading.StatsGrid count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Loading.Chart height={250} />
          <Loading.Chart height={250} />
          <Loading.Chart height={250} />
          <Loading.Chart height={250} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-slate-400 mt-1">Platform metrics, trends, and performance insights</p>
        </div>
        <SectionError
          title="Failed to load analytics"
          message="There was an error loading the analytics data. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-slate-400 mt-1">Platform metrics, trends, and performance insights</p>
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
              {range === '24h' ? 'Last 24 Hours' : range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Messages" value={stats.messages} color="cyan" size="sm" />
        <MetricCard title="Users" value={stats.users} color="violet" size="sm" />
        <MetricCard title="Moderation Events" value={stats.moderationEvents} color="yellow" size="sm" />
        <MetricCard title="Tickets Resolved" value={stats.ticketsResolved} color="green" size="sm" />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages Over Time */}
        <div className="glass-card p-6">
          <h3 className="font-semibold text-white mb-6">Messages Over Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={messagesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
                <Area type="monotone" dataKey="messages" name="Messages" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User Activity Heatmap */}
        <div className="glass-card p-6">
          <h3 className="font-semibold text-white mb-6">User Activity Heatmap</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityHeatmap}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="hour" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="score" name="Activity Score" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Commands */}
        <div className="glass-card p-6">
          <h3 className="font-semibold text-white mb-6">Top Commands</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={commandsData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis dataKey="command" type="category" stroke="#64748b" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="count" name="Usage" fill="#eab308" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ticket Resolution Rate */}
        <div className="glass-card p-6">
          <h3 className="font-semibold text-white mb-6">Ticket Resolution Rate</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ticketResolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="period" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
                <Line type="monotone" dataKey="created" name="Created" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
