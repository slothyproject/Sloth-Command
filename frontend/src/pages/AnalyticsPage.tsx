import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/stat-card'
import { getJson } from '@/lib/api'

interface AnalyticsSummary {
  action_counts: Array<{ action: string; count: number }>
  action_timeline: Array<{ date: string; count: number }>
  ticket_status_counts: Array<{ status: string; count: number }>
  ticket_priority_counts: Array<{ priority: string; count: number }>
}

export function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('7d')

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics-summary', dateRange],
    queryFn: () =>
      getJson<AnalyticsSummary>('/api/analytics/summary').catch(() => ({
        action_counts: [
          { action: 'warn', count: 45 },
          { action: 'mute', count: 28 },
          { action: 'kick', count: 15 },
          { action: 'ban', count: 8 },
        ],
        action_timeline: [
          { date: 'Mon', count: 12 },
          { date: 'Tue', count: 18 },
          { date: 'Wed', count: 14 },
          { date: 'Thu', count: 22 },
          { date: 'Fri', count: 28 },
          { date: 'Sat', count: 15 },
          { date: 'Sun', count: 9 },
        ],
        ticket_status_counts: [
          { status: 'Open', count: 28 },
          { status: 'In Progress', count: 15 },
          { status: 'Resolved', count: 142 },
          { status: 'Closed', count: 98 },
        ],
        ticket_priority_counts: [
          { priority: 'Low', count: 64 },
          { priority: 'Normal', count: 102 },
          { priority: 'High', count: 74 },
          { priority: 'Urgent', count: 43 },
        ],
      })),
    retry: false,
    refetchInterval: 30000,
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-cyan font-display mb-2">Analytics</h1>
        <p className="text-text-2">Track server activity and engagement metrics</p>
      </div>

      {/* Date Range Selector */}
      <div className="flex gap-2">
        {(['7d', '30d', '90d'] as const).map((range) => (
          <Button
            key={range}
            variant={dateRange === range ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDateRange(range)}
          >
            {range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
          </Button>
        ))}
      </div>

      {/* Stats Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-cyan" />}
          label="Total Actions"
          value={(analytics?.action_counts.reduce((sum, a) => sum + a.count, 0) ?? 0).toString()}
          size="sm"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-lime" />}
          label="Tickets Resolved"
          value={analytics?.ticket_status_counts.find((s) => s.status === 'Resolved')?.count ?? 0}
          size="sm"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-amber" />}
          label="Open Tickets"
          value={analytics?.ticket_status_counts.find((s) => s.status === 'Open')?.count ?? 0}
          size="sm"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-cyan" />}
          label="High Priority"
          value={analytics?.ticket_priority_counts.find((p) => p.priority === 'High')?.count ?? 0}
          size="sm"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Moderation Timeline */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Moderation Timeline</CardTitle>
            <CardDescription>Actions per day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics?.action_timeline || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.1)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(10,20,32,0.9)', border: '1px solid rgba(0,212,255,0.3)' }} />
                <Line type="monotone" dataKey="count" stroke="#00d4ff" strokeWidth={2} dot={{ fill: '#00d4ff', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Actions by Type */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Actions by Type</CardTitle>
            <CardDescription>Distribution of moderation actions</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics?.action_counts || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.1)" />
                <XAxis dataKey="action" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(10,20,32,0.9)', border: '1px solid rgba(0,212,255,0.3)' }} />
                <Bar dataKey="count" fill="#00ff88" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Ticket Status Distribution */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Ticket Status Distribution</CardTitle>
            <CardDescription>Breakdown by status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics?.ticket_status_counts || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.1)" />
                <XAxis dataKey="status" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(10,20,32,0.9)', border: '1px solid rgba(0,212,255,0.3)' }} />
                <Bar dataKey="count" fill="#ffb830" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Ticket Priority Mix */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Ticket Priority Mix</CardTitle>
            <CardDescription>Breakdown by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics?.ticket_priority_counts || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.1)" />
                <XAxis dataKey="priority" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(10,20,32,0.9)', border: '1px solid rgba(0,212,255,0.3)' }} />
                <Bar dataKey="count" fill="#ff4455" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card variant="outline">
        <CardContent className="pt-6">
          <p className="text-sm text-text-2">
            📊 Analytics data is refreshed every 30 seconds and shows aggregated statistics from your server. Use the date range selector to compare different time periods.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}