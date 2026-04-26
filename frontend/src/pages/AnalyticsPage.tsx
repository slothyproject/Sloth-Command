import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Download, TrendingUp, AlertCircle, Shield, Server, Users, Zap, Clock, Activity, ArrowUp, ArrowDown, Minus, Timer, CheckCircle2 } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/stat-card'
import { Skeleton } from '@/components/ui/skeleton'
import { getJson } from '@/lib/api'
import { cn } from '@/lib/cn'

interface GuildItem { id: number; name: string }

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
  bot_health: {
    online: boolean
    uptime: string
    uptime_seconds: number
    latency_ms: number
    commands_today: number
    cog_count: number
    version: string
    guild_count: number
    member_count: number
    cpu_percent: number
    memory_percent: number
    memory_mb: number
  }
  guilds_by_members: Array<{ id: number; name: string; members: number }>
  action_counts: Array<{ action: string; count: number }>
  action_timeline: Array<{ date: string; count: number }>
  ticket_timeline: Array<{ date: string; count: number }>
  server_timeline: Array<{ date: string; joins: number; leaves: number }>
  ticket_status_counts: Array<{ status: string; count: number }>
  ticket_priority_counts: Array<{ priority: string; count: number }>
  top_guilds: Array<{ id: number; name: string; count: number }>
  commands_timeline: Array<{ date: string; count: number }>
  top_commands?: Array<{ command: string; count: number }>
  top_moderators?: Array<{ moderator: string; count: number }>
  // New analytics fields
  avg_ticket_resolution_hours: number | null
  ticket_resolution_rate: number | null
  prev_period: { mod_count: number; ticket_count: number; command_count: number }
  hourly_command_activity: Array<{ hour: number; count: number }>
  multi_action_timeline: Array<{ date: string; [action: string]: number | string }>
  top_action_names: string[]
}

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(13, 18, 30, 0.97)',
  border: '1px solid rgba(136, 192, 208, 0.2)',
  borderRadius: '8px',
  color: '#d8dee9',
  fontSize: 12,
}
const AXIS_STYLE = { stroke: 'rgba(255,255,255,0.3)', fontSize: 11 }

function ChartSkeleton() {
  return <Skeleton count={1} className="h-[220px] w-full" />
}

function EmptyChart({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[220px] text-text-3 gap-2">
      <div className="opacity-25">{icon}</div>
      <p className="text-xs">{label}</p>
    </div>
  )
}

function HealthBar({ label, value, max = 100, color = 'bg-cyan/60' }: {
  label: string; value: number; max?: number; color?: string
}) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-3">{label}</span>
        <span className="text-text-1 font-mono">{value.toFixed(value < 10 ? 1 : 0)}{max === 100 ? '%' : ' MB'}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Delta badge: shows period-over-period change ──────────────
function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <span className="text-xs text-text-3">—</span>
  if (previous === 0) return <span className="text-xs text-green-400 flex items-center gap-0.5"><ArrowUp className="w-3 h-3" />new</span>
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return <span className="text-xs text-text-3 flex items-center gap-0.5"><Minus className="w-3 h-3" />0%</span>
  return pct > 0
    ? <span className="text-xs text-green-400 flex items-center gap-0.5"><ArrowUp className="w-3 h-3" />{pct}%</span>
    : <span className="text-xs text-red-400 flex items-center gap-0.5"><ArrowDown className="w-3 h-3" />{Math.abs(pct)}%</span>
}

// ── Action colour palette ─────────────────────────────────────
const ACTION_COLORS: Record<string, string> = {
  warn: '#ebcb8b',
  mute: '#b48ead',
  kick: '#d08070',
  ban: '#bf616a',
  unban: '#a3be8c',
  unmute: '#88c0d0',
}
const HOUR_LABELS = ['12a','1a','2a','3a','4a','5a','6a','7a','8a','9a','10a','11a',
  '12p','1p','2p','3p','4p','5p','6p','7p','8p','9p','10p','11p']

export function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('7d')
  const [guildFilter, setGuildFilter] = useState('')

  const guildsQuery = useQuery({
    queryKey: ['guilds-list-analytics'],
    queryFn: () => getJson<{ guilds: GuildItem[] }>('/api/guilds'),
    staleTime: 60_000,
    retry: 1,
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics-summary', dateRange, guildFilter],
    queryFn: () => {
      const params = new URLSearchParams({ range: dateRange })
      if (guildFilter) params.set('guild_id', guildFilter)
      return getJson<AnalyticsSummary>(`/api/analytics/summary?${params}`)
    },
    retry: 1,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnMount: true,
  })

  function exportAnalyticsCsv() {
    if (!data) return
    const sections: string[] = []

    sections.push('Moderation Actions by Type')
    sections.push('Action,Count')
    data.action_counts.forEach((r) => sections.push(`"${r.action}",${r.count}`))

    sections.push('')
    sections.push('Top Guilds (Mod Activity)')
    sections.push('Guild,Cases')
    data.top_guilds.forEach((r) => sections.push(`"${r.name}",${r.count}`))

    if (data.top_commands?.length) {
      sections.push('')
      sections.push('Top Commands')
      sections.push('Command,Uses')
      data.top_commands.forEach((r) => sections.push(`"${r.command}",${r.count}`))
    }

    if (data.top_moderators?.length) {
      sections.push('')
      sections.push('Top Moderators')
      sections.push('Moderator,Cases')
      data.top_moderators.forEach((r) => sections.push(`"${r.moderator}",${r.count}`))
    }

    const blob = new Blob([sections.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const bot = data?.bot_health
  const totals = data?.totals

  const totalActions = data?.action_counts.reduce((s, a) => s + a.count, 0) ?? 0
  const resolvedCount = data?.ticket_status_counts.find((s) => s.status === 'Resolved')?.count ?? 0

  const hasModData = (data?.action_timeline ?? []).some((d) => d.count > 0)
  const hasTicketData = (data?.ticket_timeline ?? []).some((d) => d.count > 0)
  const hasServerEventData = (data?.server_timeline ?? []).some((d) => d.joins > 0 || d.leaves > 0)
  // Guild breakdown: show if we have any guilds (Redis always has these when bot is online)
  const hasGuildBreakdown = (data?.guilds_by_members ?? []).length > 0
  const hasCommandData = (data?.commands_timeline ?? []).some((d) => d.count > 0)
  const hasHourlyData = (data?.hourly_command_activity ?? []).some((d) => d.count > 0)
  const hasMultiActionData = (data?.multi_action_timeline ?? []).some(
    (d) => (data?.top_action_names ?? []).some((a) => (d[a] as number) > 0)
  )
  const currentCmdCount = (data?.commands_timeline ?? []).reduce((s, d) => s + d.count, 0)
  const prevPeriod = data?.prev_period ?? { mod_count: 0, ticket_count: 0, command_count: 0 }
  const peakHour = (data?.hourly_command_activity ?? []).reduce(
    (best, d) => (d.count > best.count ? d : best),
    { hour: 0, count: 0 }
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold text-cyan font-display mb-2">Analytics</h1>
          <p className="text-text-2">Live stats from your bot and servers</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={guildFilter}
            onChange={(e) => setGuildFilter(e.target.value)}
            className="rounded-xl border border-line bg-surface-strong px-3 py-2 text-sm text-text-1 focus:outline-none focus:ring-1 focus:ring-cyan/40"
          >
            <option value="">All servers</option>
            {(guildsQuery.data?.guilds ?? []).map((g) => (
              <option key={g.id} value={String(g.id)}>{g.name}</option>
            ))}
          </select>
          {(['7d', '30d', '90d'] as const).map((range) => (
            <Button key={range} variant={dateRange === range ? 'default' : 'ghost'} size="sm" onClick={() => setDateRange(range)}>
              {range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
            </Button>
          ))}
          <Button variant="secondary" size="sm" onClick={exportAnalyticsCsv} disabled={!data}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {isError && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Failed to load analytics data.</span>
        </div>
      )}

      {/* ── Bot Health ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Bot Status Card */}
        <Card variant="elevated" className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="w-4 h-4 text-cyan" />
              Bot Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton count={4} />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full', bot?.online ? 'bg-green-400 animate-pulse' : 'bg-red-500')} />
                  <span className={cn('text-sm font-semibold', bot?.online ? 'text-green-400' : 'text-red-400')}>
                    {bot?.online ? 'Online' : 'Offline'}
                  </span>
                  {bot?.version && bot.version !== 'unknown' && (
                    <span className="text-xs text-text-3 ml-auto font-mono">v{bot.version}</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white/3 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3 h-3 text-text-3" />
                      <span className="text-xs text-text-3">Uptime</span>
                    </div>
                    <p className="text-sm font-mono font-semibold text-text-1">{bot?.uptime ?? '—'}</p>
                  </div>
                  <div className="rounded-lg bg-white/3 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Activity className="w-3 h-3 text-text-3" />
                      <span className="text-xs text-text-3">Latency</span>
                    </div>
                    <p className={cn('text-sm font-mono font-semibold', (bot?.latency_ms ?? 0) > 200 ? 'text-amber-400' : 'text-green-400')}>
                      {bot?.latency_ms ?? 0}ms
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/3 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap className="w-3 h-3 text-text-3" />
                      <span className="text-xs text-text-3">Cmds Today</span>
                    </div>
                    <p className="text-sm font-mono font-semibold text-cyan">{(bot?.commands_today ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-white/3 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Server className="w-3 h-3 text-text-3" />
                      <span className="text-xs text-text-3">Cogs</span>
                    </div>
                    <p className="text-sm font-mono font-semibold text-text-1">{bot?.cog_count ?? 0}</p>
                  </div>
                </div>

                {(bot?.cpu_percent !== undefined && bot.cpu_percent > 0) || (bot?.memory_mb !== undefined && bot.memory_mb > 0) ? (
                  <div className="space-y-2 pt-1">
                    {(bot?.cpu_percent ?? 0) > 0 && (
                      <HealthBar label="CPU" value={bot!.cpu_percent} color={(bot?.cpu_percent ?? 0) > 80 ? 'bg-red-500' : 'bg-cyan/60'} />
                    )}
                    {(bot?.memory_percent ?? 0) > 0 && (
                      <HealthBar label="Memory" value={bot!.memory_percent} color={(bot?.memory_percent ?? 0) > 80 ? 'bg-red-500' : 'bg-purple-400/60'} />
                    )}
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {/* Summary Stat Cards — prefer live Redis counts over DB aggregates */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4 content-start">
          <StatCard icon={<Server className="w-4 h-4 text-cyan" />} label="Servers" value={isLoading ? '-' : (bot?.guild_count || totals?.servers || 0)} size="sm" />
          <StatCard icon={<Users className="w-4 h-4 text-cyan" />} label="Total Members" value={isLoading ? '-' : ((bot?.member_count || totals?.members || 0).toLocaleString())} size="sm" />
          <StatCard icon={<Zap className="w-4 h-4 text-amber-400" />} label={`Mod Actions (${dateRange})`} value={isLoading ? '-' : totalActions} size="sm" />
          <StatCard icon={<Shield className="w-4 h-4 text-red-400" />} label="All-Time Cases" value={isLoading ? '-' : totals?.mod_cases_all_time ?? 0} size="sm" />
          <StatCard icon={<TrendingUp className="w-4 h-4 text-lime" />} label="Tickets Open" value={isLoading ? '-' : totals?.tickets_open ?? 0} size="sm" />
          <StatCard icon={<TrendingUp className="w-4 h-4 text-green-400" />} label="Resolved" value={isLoading ? '-' : resolvedCount} size="sm" />
        </div>
      </div>

      {/* ── Period-over-Period KPI comparison ─────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Mod Actions',
            current: totalActions,
            prev: prevPeriod.mod_count,
            icon: <Shield className="w-4 h-4 text-cyan" />,
            desc: `vs prev ${dateRange}`,
          },
          {
            label: 'Tickets Created',
            current: (data?.ticket_timeline ?? []).reduce((s, d) => s + d.count, 0),
            prev: prevPeriod.ticket_count,
            icon: <TrendingUp className="w-4 h-4 text-green-400" />,
            desc: `vs prev ${dateRange}`,
          },
          {
            label: 'Cmds Used',
            current: currentCmdCount,
            prev: prevPeriod.command_count,
            icon: <Zap className="w-4 h-4 text-amber-400" />,
            desc: `vs prev ${dateRange}`,
          },
          {
            label: 'Avg Resolution',
            current: data?.avg_ticket_resolution_hours ?? null,
            prev: null,
            icon: <Timer className="w-4 h-4 text-purple-400" />,
            desc: data?.ticket_resolution_rate != null
              ? `${data.ticket_resolution_rate}% resolved`
              : 'no closed tickets',
            raw: data?.avg_ticket_resolution_hours != null
              ? data.avg_ticket_resolution_hours >= 24
                ? `${(data.avg_ticket_resolution_hours / 24).toFixed(1)}d`
                : `${data.avg_ticket_resolution_hours}h`
              : '—',
          },
        ].map(({ label, current, prev, icon, desc, raw }) => (
          <div key={label} className="dashboard-chrome rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {icon}
                <span className="text-xs text-text-3">{label}</span>
              </div>
              {prev !== null && current !== null && (
                <DeltaBadge current={current as number} previous={prev} />
              )}
            </div>
            <p className="text-2xl font-bold font-display text-text-0">
              {isLoading ? '—' : raw ?? (current ?? '—')}
            </p>
            <p className="text-xs text-text-3">{desc}</p>
          </div>
        ))}
      </div>

      {/* ── Guild Member Breakdown ──────────────────────────────── */}
      {(isLoading || hasGuildBreakdown) && (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan" />
              Members per Server
            </CardTitle>
            <CardDescription>Top 10 servers by member count</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.guilds_by_members ?? []} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(136,192,208,0.08)" horizontal={false} />
                  <XAxis type="number" {...AXIS_STYLE} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ ...AXIS_STYLE, fontSize: 10 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v.toLocaleString(), 'Members']} />
                  <Bar dataKey="members" fill="#88c0d0" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Commands Timeline ───────────────────────────────────── */}
      {(isLoading || hasCommandData) && (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan" />
              Commands Used
            </CardTitle>
            <CardDescription>Bot commands per day — {dateRange}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton /> : !hasCommandData ? (
              <EmptyChart icon={<Zap className="w-8 h-8" />} label="No command usage events in this period" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data?.commands_timeline ?? []}>
                  <defs>
                    <linearGradient id="cmdGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ebcb8b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ebcb8b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(235,203,139,0.08)" />
                  <XAxis dataKey="date" {...AXIS_STYLE} />
                  <YAxis {...AXIS_STYLE} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="count" name="Commands" stroke="#ebcb8b" fill="url(#cmdGrad)" strokeWidth={2} dot={{ r: 3, fill: '#ebcb8b' }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Hourly Command Activity ─────────────────────────────── */}
      {(isLoading || hasHourlyData) && (
        <Card variant="elevated">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan" />
                  Activity by Hour of Day
                </CardTitle>
                <CardDescription>
                  When commands are used most — UTC{' '}
                  {!isLoading && hasHourlyData && (
                    <span className="text-cyan font-medium">
                      · peak at {HOUR_LABELS[peakHour.hour]} ({peakHour.count} uses)
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton /> : !hasHourlyData ? (
              <EmptyChart icon={<Clock className="w-8 h-8" />} label="No command data yet for this period" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data?.hourly_command_activity ?? []} margin={{ bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(136,192,208,0.08)" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={(h: number) => HOUR_LABELS[h]}
                    {...AXIS_STYLE}
                    interval={2}
                  />
                  <YAxis {...AXIS_STYLE} allowDecimals={false} width={28} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(h: number) => `${HOUR_LABELS[h]} UTC`}
                    formatter={(v: number) => [v, 'Commands']}
                  />
                  <Bar dataKey="count" name="Commands" radius={[3, 3, 0, 0]}>
                    {(data?.hourly_command_activity ?? []).map((entry) => (
                      <Cell
                        key={entry.hour}
                        fill={entry.hour === peakHour.hour ? '#88c0d0' : 'rgba(136,192,208,0.3)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Activity Timelines ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <EmptyChart icon={<Shield className="w-8 h-8" />} label="No moderation data in this period" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data?.action_timeline ?? []}>
                  <defs>
                    <linearGradient id="modGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#88c0d0" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#88c0d0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(136,192,208,0.08)" />
                  <XAxis dataKey="date" {...AXIS_STYLE} />
                  <YAxis {...AXIS_STYLE} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="count" name="Actions" stroke="#88c0d0" fill="url(#modGrad)" strokeWidth={2} dot={{ r: 3, fill: '#88c0d0' }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-lime" />
              Tickets Created
            </CardTitle>
            <CardDescription>New tickets per day — {dateRange}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton /> : !hasTicketData ? (
              <EmptyChart icon={<TrendingUp className="w-8 h-8" />} label="No ticket data in this period" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
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
                  <Area type="monotone" dataKey="count" name="Tickets" stroke="#a3be8c" fill="url(#tickGrad)" strokeWidth={2} dot={{ r: 3, fill: '#a3be8c' }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Multi-Action Breakdown Timeline ────────────────────── */}
      {(isLoading || hasMultiActionData) && (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan" />
              Moderation Breakdown Over Time
            </CardTitle>
            <CardDescription>Ban / Warn / Kick / Mute daily — {dateRange}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton /> : !hasMultiActionData ? (
              <EmptyChart icon={<Shield className="w-8 h-8" />} label="No moderation data in this period" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data?.multi_action_timeline ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(136,192,208,0.08)" />
                  <XAxis dataKey="date" {...AXIS_STYLE} />
                  <YAxis {...AXIS_STYLE} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#d8dee9' }} />
                  {(data?.top_action_names ?? []).map((action) => (
                    <Line
                      key={action}
                      type="monotone"
                      dataKey={action}
                      name={action.charAt(0).toUpperCase() + action.slice(1)}
                      stroke={ACTION_COLORS[action] ?? '#88c0d0'}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Action Type + Server Events ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Actions by Type</CardTitle>
            <CardDescription>Moderation breakdown — {dateRange}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton /> : (data?.action_counts ?? []).length === 0 ? (
              <EmptyChart icon={<Shield className="w-8 h-8" />} label="No moderation actions recorded" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.action_counts ?? []} margin={{ bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(136,192,208,0.08)" />
                  <XAxis dataKey="action" {...AXIS_STYLE} angle={-25} textAnchor="end" interval={0} />
                  <YAxis {...AXIS_STYLE} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" name="Count" fill="#88c0d0" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan" />
              Server Events
            </CardTitle>
            <CardDescription>Guild joins and leaves — {dateRange}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton /> : !hasServerEventData ? (
              <EmptyChart icon={<Server className="w-8 h-8" />} label="No server join/leave events in this period" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
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

      {/* ── Ticket Resolution Metrics ───────────────────────────── */}
      {!isLoading && (data?.avg_ticket_resolution_hours != null || data?.ticket_resolution_rate != null) && (
        <div className="grid grid-cols-2 gap-4">
          {data?.avg_ticket_resolution_hours != null && (
            <div className="dashboard-chrome rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-400/10 flex items-center justify-center shrink-0">
                <Timer className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-text-3 mb-0.5">Avg Resolution Time</p>
                <p className="text-xl font-bold font-display text-text-0">
                  {data.avg_ticket_resolution_hours >= 24
                    ? `${(data.avg_ticket_resolution_hours / 24).toFixed(1)} days`
                    : `${data.avg_ticket_resolution_hours} hrs`}
                </p>
                <p className="text-xs text-text-3">from open to close</p>
              </div>
            </div>
          )}
          {data?.ticket_resolution_rate != null && (
            <div className="dashboard-chrome rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-400/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-text-3 mb-0.5">Resolution Rate</p>
                <p className="text-xl font-bold font-display text-text-0">{data.ticket_resolution_rate}%</p>
                <p className="text-xs text-text-3">tickets closed this period</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Ticket Status + Priority ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Ticket Status</CardTitle>
            <CardDescription>Tickets created in period by status</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton /> : (data?.ticket_status_counts ?? []).length === 0 ? (
              <EmptyChart icon={<TrendingUp className="w-8 h-8" />} label="No tickets in this period" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
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

        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Ticket Priority</CardTitle>
            <CardDescription>Tickets by priority — {dateRange}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton /> : (data?.ticket_priority_counts ?? []).length === 0 ? (
              <EmptyChart icon={<TrendingUp className="w-8 h-8" />} label="No tickets in this period" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
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

      {/* ── Top Guilds by Mod Activity ──────────────────────────── */}
      {!isLoading && (data?.top_guilds ?? []).length > 0 && (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan" />
              Most Active Servers (Mod)
            </CardTitle>
            <CardDescription>Servers by moderation case count — {dateRange}</CardDescription>
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
                        <div className="h-full rounded-full bg-cyan/60 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Top Commands + Top Moderators Leaderboards ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan" />
              Top Commands
            </CardTitle>
            <CardDescription>Most-used bot commands — {dateRange}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton count={5} /> : !(data?.top_commands ?? []).length ? (
              <div className="flex flex-col items-center justify-center h-24 text-text-3 gap-2">
                <Zap className="w-7 h-7 opacity-25" />
                <p className="text-xs">No command data yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(data?.top_commands ?? []).map((cmd, i) => {
                  const max = data!.top_commands![0].count || 1
                  const pct = Math.round((cmd.count / max) * 100)
                  return (
                    <div key={cmd.command} className="flex items-center gap-3">
                      <span className="w-5 text-xs text-text-3 font-mono text-right shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-sm font-medium text-text-1 font-mono truncate">/{cmd.command}</span>
                          <span className="text-xs text-text-3 shrink-0 ml-2">{cmd.count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5">
                          <div className="h-full rounded-full bg-sloth-gold/60 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan" />
              Top Moderators
            </CardTitle>
            <CardDescription>Most active moderators by case count — {dateRange}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton count={5} /> : !(data?.top_moderators ?? []).length ? (
              <div className="flex flex-col items-center justify-center h-24 text-text-3 gap-2">
                <Shield className="w-7 h-7 opacity-25" />
                <p className="text-xs">No moderation data yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(data?.top_moderators ?? []).map((mod, i) => {
                  const max = data!.top_moderators![0].count || 1
                  const pct = Math.round((mod.count / max) * 100)
                  return (
                    <div key={mod.moderator} className="flex items-center gap-3">
                      <span className="w-5 text-xs text-text-3 font-mono text-right shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-sm font-medium text-text-1 truncate">{mod.moderator}</span>
                          <span className="text-xs text-text-3 shrink-0 ml-2">{mod.count} case{mod.count !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5">
                          <div className="h-full rounded-full bg-cyan/40 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
