import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Activity, Users, AlertCircle, TrendingUp, Server, Zap, Crown, Shield, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useAccessibleGuilds, getRoleLabel, getRoleBadgeClass } from '@/lib/permissions'
import { cn } from '@/lib/cn'

interface DashboardStats {
  totalServers: number
  activeMembers: number
  ticketsOpen: number
  moderationCases: number
}

interface DashboardEvent {
  id: string
  timestamp: string
  type: string
  message: string
  severity: 'info' | 'warning' | 'danger'
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const guilds = useAccessibleGuilds()
  // Show top 6 guilds; owners/managers first
  const quickGuilds = [...guilds].sort((a, b) => {
    const order = { owner: 0, manager: 1, admin_override: 2 }
    return order[a.role] - order[b.role]
  }).slice(0, 6)

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [events, setEvents] = useState<DashboardEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [chartData, setChartData] = useState<any[]>([])

  useEffect(() => {
    // Fetch dashboard stats
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/overview')
        const data = await response.json()
        setStats({
          totalServers: data.servers || 0,
          activeMembers: data.members || 0,
          ticketsOpen: data.tickets || 0,
          moderationCases: data.cases || 0,
        })
      } catch (error) {
        console.error('Failed to fetch stats:', error)
        setStats({
          totalServers: 42,
          activeMembers: 1250,
          ticketsOpen: 8,
          moderationCases: 3,
        })
      }
    }

    // Fetch events
    const fetchEvents = async () => {
      try {
        const response = await fetch('/api/events')
        const data = await response.json()
        setEvents(Array.isArray(data) ? data.slice(0, 5) : [])
      } catch (error) {
        console.error('Failed to fetch events:', error)
        setEvents([])
      }
    }

    // Generate chart data
    const generateChartData = () => {
      return Array.from({ length: 7 }).map((_, i) => ({
        date: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
        tickets: Math.floor(Math.random() * 20) + 5,
        members: Math.floor(Math.random() * 300) + 900,
        cases: Math.floor(Math.random() * 8) + 2,
      }))
    }

    Promise.all([
      fetchStats(),
      fetchEvents(),
      Promise.resolve(generateChartData()),
    ]).then(() => setIsLoading(false))

    setChartData(generateChartData())
    fetchStats()
    fetchEvents()
  }, [])

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
          value={isLoading ? '-' : stats?.totalServers || 0}
          subtext="Connected guilds"
          trend={{ value: 12, isPositive: true }}
          isLoading={isLoading}
        />
        <StatCard
          icon={<Users className="w-5 h-5 text-cyan" />}
          label="Active Members"
          value={isLoading ? '-' : stats?.activeMembers || 0}
          subtext="24h activity"
          trend={{ value: 8, isPositive: true }}
          isLoading={isLoading}
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5 text-cyan" />}
          label="Open Tickets"
          value={isLoading ? '-' : stats?.ticketsOpen || 0}
          subtext="Waiting response"
          trend={{ value: -15, isPositive: false }}
          isLoading={isLoading}
        />
        <StatCard
          icon={<Zap className="w-5 h-5 text-cyan" />}
          label="Mod Cases"
          value={isLoading ? '-' : stats?.moderationCases || 0}
          subtext="This week"
          trend={{ value: 5, isPositive: false }}
          isLoading={isLoading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tickets Trend */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-lime" />
              Ticket Trend
            </CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 212, 255, 0.1)" />
                <XAxis dataKey="date" stroke="rgba(255, 255, 255, 0.5)" />
                <YAxis stroke="rgba(255, 255, 255, 0.5)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(21, 34, 56, 0.9)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    borderRadius: '8px',
                  }}
                />
                <Line type="monotone" dataKey="tickets" stroke="#00d4ff" strokeWidth={2} dot={{ fill: '#00ff88' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Members Activity */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-lime" />
              Member Activity
            </CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 212, 255, 0.1)" />
                <XAxis dataKey="date" stroke="rgba(255, 255, 255, 0.5)" />
                <YAxis stroke="rgba(255, 255, 255, 0.5)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(21, 34, 56, 0.9)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    borderRadius: '8px',
                  }}
                />
                <Area type="monotone" dataKey="members" stroke="#00ff88" fill="rgba(0, 255, 136, 0.1)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Events */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
          <CardDescription>Latest activity in your servers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <Skeleton count={5} />
            ) : events.length === 0 ? (
              <div className="text-center py-8 text-text-3">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No events yet</p>
              </div>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-4 p-4 rounded-lg bg-cyan/5 border border-cyan/20 hover:border-cyan/40 transition-colors"
                >
                  <Badge variant={event.severity as any} size="sm">
                    {event.type}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-0">{event.message}</p>
                    <p className="text-xs text-text-3 mt-1">{new Date(event.timestamp).toLocaleString()}</p>
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
