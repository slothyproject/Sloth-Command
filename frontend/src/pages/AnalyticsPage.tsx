import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, AlertCircle, Shield, Ticket, Server, Users } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/stat-card'
import { Skeleton } from '@/components/ui/skeleton'
import { getJson } from '@/lib/api'

interface AnalyticsSummary {
  range: string
  days: number
  totals: {
    servers: number
    members: number
    mod_cases_all_time: number
    tickets_all_time: number
    tickets_open: number
  }
  action_counts: Array<{ action: string; count: number }>
  action_timeline: Array<{ date: string; count: number }>
  ticket_timeline: Array<{ date: string; count: number }>
  server_timeline: Array<{ date: string; joins: number; leaves: number }>
  ticket_status_counts: Array<{ status: string; count: number }>
  ticket_priority_counts: Array<{ priority: string; count: number }>
  top_guilds: Array<{ id: number; name: string; count: number }>
}

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(13, 18, 30, 0.97)',
  border: '1px solid rgba(136, 192, 208, 0.25)',
  borderRadius: '8px',
  color: '#d8dee9',
  fontSize: 12,
}

const AXIS_STYLE = { stroke: 'rgba(255,255,255,0.3)', fontSize: 11 }

function ChartSkeleton() {
  return <Skeleton count={1} className="h-[260px] w-full" />
}

export function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('7d')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics-summary', dateRange],
    queryFn: () => getJson<AnalyticsSummary>(`/api/analytics/summary?range=${dateRange}`),
    retry: 1,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnMount: true,
  })

  const totalActions = data?.action_counts.reduce((s, a) => s + a.count, 0) ?? 0
  const resolvedTickets = data?.ticket_status_counts.find((s) => s.status === 'Resolved')?.count ?? 0
  const openTickets = data?.totals?.tickets_open ?? 0
  const highPriority = data?.ticket_priority_counts.find((p) => p.priority === 'High')?.count ?? 0

  // Check if any timeline data is non-zero (to detect empty state)
  const hasModData = (data?.action_timeline ?? []).some((d) => d.count > 0)
  const hasTicketData = (data?.ticket_timeline ?? []).some((d) => d.count > 0)
  const hasServerData = (data?.server_timeline ?? []).some((d) => d.joins > 0 || d.leaves > 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-cyan font-display mb-2">Analytics</h1>
        <p className="text-text-2">Real-time statistics from your servers and bot activity</p>
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

      {/* Error state */}
      {isError && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Failed to load analytics data.</span>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={<Server className="w-4 h-4 text-cyan" />} label="Servers" value={isLoading ? '-' : data?.totals.servers ?? 0} size="sm" />
        <StatCard icon={<Users className="w-4 h-4 text-cyan" />} label="Members" value={isLoading ? '-' : (data?.totals.members ?? 0).toLocaleString()} size="sm" />
        <StatCard icon={<Shield className="w-4 h-4 text-amber-400" />} label={`Mod Actions (${dateRange})`} value={isLoading ? '-' : totalActions} size="sm" />
        <StatCard icon={<Ticket className="w-4 h-4 text-lime" />} label="Open Tickets" value={isLoading ? '-' : openTickets} size="sm" />
        <StatCard icon={<TrendingUp className="w-4 h-4 text-lime" />} label="Resolved" value={isLoading ? '-' : resolvedTickets} size="sm" />
        <StatCard icon={<AlertCircle className="w-4 h-4 text-red-400" />} label="High Priority" value={isLoading ? '-' : highPriority} size="sm" />
      </div>

      {/* Timelines Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Moderation Timeline */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan" />
              Moderation Activity
            </CardTitle>
            <CardDescription>Actions per day — {dateRange}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton /> : !hasModData ? (
              <div className="flex flex-col items-center justify-center h-[260px] text-text-3 text-sm gap-2">
                <Shield className="w-8 h-8 opacity-30" />
                No moderation data in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data?.action_timeline ?? []}>
                  <defs>
                    <linearGradient id="modGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#88c0d0" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#88c0d0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(136,192,208,0.08)" />
                  <XAxis dataKey="date" {...AXIS_STYLE} />
                  <YAxis {...AXIS_STYLE} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Actions"
                    stroke="#88c0d0"
                    fill="url(#modGrad)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#88c0d0' }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Ticket Timeline */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="w-4 h-4 text-lime" />
              Tickets Created
            </CardTitle>
            <CardDescription>New tickets per day — {dateRange}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton /> : !hasTicketData ? (
              <div className="flex flex-col items-center justify-center h-[260px] text-text-3 text-sm gap-2">
                <Ticket className="w-8 h-8 opacity-30" />
                No ticket data in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data?.ticket_timeline ?? []}>
                  <defs>
                    <linearGradient id="tickGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a3be8c" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a3be8c" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(163,190,140,0.08)" />
                  <XAxis dataKey="date" {...AXIS_STYLE} />
                  <YAxis {...AXIS_STYLE} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Tickets"
                    stroke="#a3be8c"
                    fill="url(#tickGrad)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#a3be8c' }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions by Type + Server Events Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Actions by Type */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Actions by Type</CardTitle>
            <CardDescription>Breakdown of moderation actions — {dateRange}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton /> : (data?.action_counts ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[260px] text-text-3 text-sm gap-2">
                <Shield className="w-8 h-8 opacity-30" />
                No moderation actions recorded
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data?.action_counts ?? []} margin={{ bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(136,192,208,0.08)" />
                  <XAxis dataKey="action" {...AXIS_STYLE} angle={-30} textAnchor="end" interval={0} />
                  <YAxis {...AXIS_STYLE} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" name="Count" fill="#88c0d0" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Server Join/Leave Timeline */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan" />
              Server Activity
            </CardTitle>
            <CardDescription>Guild joins and leaves — {dateRange}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton /> : !hasServerData ? (
              <div className="flex flex-col items-center justify-center h-[260px] text-text-3 text-sm gap-2">
                <Server className="w-8 h-8 opacity-30" />
                No server join/leave events in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data?.server_timeline ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(136,192,208,0.08)" />
                  <XAxis dataKey="date" {...AXIS_STYLE} />
                  <YAxis {...AXIS_STYLE} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#d8dee9' }} />
                  <Line type="monotone" dataKey="joins" name="Joins" stroke="#a3be8c" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="leaves" name="Leaves" stroke="#bf616a" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ticket Status + Priority Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Ticket Status */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Ticket Status</CardTitle>
            <CardDescription>Tickets created in period by status</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton /> : (data?.ticket_status_counts ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[260px] text-text-3 text-sm gap-2">
                <Ticket className="w-8 h-8 opacity-30" />
                No tickets in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data?.ticket_status_counts ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(136,192,208,0.08)" />
                  <XAxis dataKey="status" {...AXIS_STYLE} />
                  <YAxis {...AXIS_STYLE} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" name="Tickets" fill="#ebcb8b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Ticket Priority */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Ticket Priority Mix</CardTitle>
            <CardDescription>Tickets by priority level — {dateRange}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton /> : (data?.ticket_priority_counts ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[260px] text-text-3 text-sm gap-2">
                <Ticket className="w-8 h-8 opacity-30" />
                No tickets in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data?.ticket_priority_counts ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(136,192,208,0.08)" />
                  <XAxis dataKey="priority" {...AXIS_STYLE} />
                  <YAxis {...AXIS_STYLE} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" name="Tickets" fill="#bf616a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Guilds by Activity */}
      {!isLoading && (data?.top_guilds ?? []).length > 0 && (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan" />
              Most Active Servers
            </CardTitle>
            <CardDescription>Servers by mod case count — {dateRange}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data?.top_guilds ?? []).map((guild, i) => {
                const max = data!.top_guilds[0].count || 1
                const pct = Math.round((guild.count / max) * 100)
                return (
                  <div key={guild.id ?? i} className="flex items-center gap-3">
                    <span className="w-5 text-xs text-text-3 font-mono text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-sm font-medium text-text-1 truncate">{guild.name}</span>
                        <span className="text-xs text-text-3 shrink-0 ml-2">{guild.count} case{guild.count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-cyan/60 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
