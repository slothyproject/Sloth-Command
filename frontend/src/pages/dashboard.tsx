import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Activity, Users, AlertCircle, TrendingUp, Server, Zap, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useAccessibleGuilds, getRoleLabel, getRoleBadgeClass } from '@/lib/permissions'
import { getJson } from '@/lib/api'
import { cn } from '@/lib/cn'

interface OverviewResponse {
  servers: number
  members: number
  tickets: number
  cases: number
  trend: { date: string; tickets: number; cases: number }[]
  recent_events: {
    id: string
    type: string
    message: string
    severity: 'info' | 'warning' | 'danger'
    timestamp: string
  }[]
}

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(21, 34, 56, 0.95)',
  border: '1px solid rgba(136, 192, 208, 0.3)',
  borderRadius: '8px',
  color: '#e5e7eb',
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const guilds = useAccessibleGuilds()

  const quickGuilds = [...guilds]
    .sort((a, b) => {
      const order: Record<string, number> = { owner: 0, manager: 1, admin_override: 2 }
      return (order[a.role] ?? 9) - (order[b.role] ?? 9)
    })
    .slice(0, 6)

  const { data, isLoading, isError } = useQuery<OverviewResponse>({
    queryKey: ['overview'],
    queryFn: () => getJson<OverviewResponse>('/api/overview'),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  })

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-4xl font-bold text-cyan font-display mb-1">
          {user ? `Welcome back, ${user.username}` : 'Dashboard'}
        </h1>
        <p className="text-text-2">
          {user?.is_owner
            ? 'System-wide overview — Owner view'
            : user?.is_admin
            ? 'System-wide overview — Admin view'
            : `Managing ${guilds.length} server${guilds.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Your Servers quick access */}
      {quickGuilds.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-3 uppercase tracking-wider">Your Servers</h2>
            <Link to="/servers" className="text-xs text-cyan hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickGuilds.map((g) => {
              const roleClass = getRoleBadgeClass(g.role)
              return (
                <Link
                  key={g.id}
                  to={`/servers/${g.id}`}
                  className="group flex flex-col items-center gap-2 p-3 bg-surface/50 border border-cyan/10 hover:border-cyan/40 rounded-xl transition-all hover:-translate-y-0.5 text-center"
                >
                  {g.icon_url ? (
                    <img src={g.icon_url} alt={g.name} className="w-10 h-10 rounded-xl border border-cyan/20 object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-cyan/10 border border-cyan/20 flex items-center justify-center">
                      <Server className="w-5 h-5 text-cyan/50" />
                    </div>
                  )}
                  <p className="text-xs font-medium text-text-2 group-hover:text-cyan transition-colors truncate w-full">{g.name}</p>
                  <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full w-full text-center', roleClass)}>
                    {getRoleLabel(g.role)}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<Server className="w-5 h-5 text-cyan" />}
          label="Total Servers"
          value={isLoading ? '-' : (data?.servers ?? 0)}
          subtext="Active guilds"
          isLoading={isLoading}
        />
        <StatCard
          icon={<Users className="w-5 h-5 text-cyan" />}
          label="Total Members"
          value={isLoading ? '-' : (data?.members ?? 0).toLocaleString()}
          subtext="Across all servers"
          isLoading={isLoading}
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5 text-cyan" />}
          label="Open Tickets"
          value={isLoading ? '-' : (data?.tickets ?? 0)}
          subtext="Awaiting response"
          isLoading={isLoading}
        />
        <StatCard
          icon={<Zap className="w-5 h-5 text-cyan" />}
          label="Mod Cases"
          value={isLoading ? '-' : (data?.cases ?? 0)}
          subtext="Last 7 days"
          isLoading={isLoading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ticket Trend */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan" />
              Ticket Trend
            </CardTitle>
            <CardDescription>New tickets per day — last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton count={1} className="h-[200px]" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data?.trend ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(136, 192, 208, 0.1)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Line
                    type="monotone"
                    dataKey="tickets"
                    stroke="#88c0d0"
                    strokeWidth={2}
                    dot={{ fill: '#a3be8c', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Mod Cases Trend */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan" />
              Moderation Activity
            </CardTitle>
            <CardDescription>Mod cases per day — last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton count={1} className="h-[200px]" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data?.trend ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(136, 192, 208, 0.1)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="cases" fill="#b48ead" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Events */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
          <CardDescription>Latest bot activity across your servers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {isLoading ? (
              <Skeleton count={5} />
            ) : isError ? (
              <div className="text-center py-8 text-text-3 text-sm">
                Could not load events.
              </div>
            ) : (data?.recent_events ?? []).length === 0 ? (
              <div className="text-center py-8 text-text-3">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No events recorded yet</p>
              </div>
            ) : (
              (data?.recent_events ?? []).map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-surface/40 border border-white/5 hover:border-cyan/20 transition-colors"
                >
                  <Badge variant={event.severity as 'info' | 'warning' | 'danger'} size="sm" className="flex-shrink-0 mt-0.5">
                    {event.type.replace(/_/g, ' ')}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-0 truncate">{event.message}</p>
                    <p className="text-xs text-text-3 mt-0.5">{new Date(event.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex gap-4 flex-wrap">
        <Link to="/servers"><Button variant="default">View All Servers</Button></Link>
        <Link to="/tickets"><Button variant="secondary">Manage Tickets</Button></Link>
        <Link to="/analytics"><Button variant="outline">View Analytics</Button></Link>
      </div>
    </div>
  )
}
