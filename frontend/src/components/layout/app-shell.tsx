'use client'

import React, { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, LayoutDashboard, Server, Ticket, ShieldAlert, BarChart3, Bot, ScrollText, Users, Settings, LogOut, User, ChevronRight, Bell, Command } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/cn'
import { Button } from '../ui/button'
import { useAuthStore } from '@/store/authStore'
import { useAccessibleGuilds } from '@/lib/permissions'
import { getJson, postJson } from '@/lib/api'
import { CommandPalette } from '@/components/CommandPalette'

interface AppShellProps {
  className?: string
}

const AppShell: React.FC<AppShellProps> = ({ className }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className={cn('flex h-screen bg-void', className)}>
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:static top-0 left-0 h-screen bg-gradient-to-b from-surface-strong via-panel to-void border-r border-cyan/20 transition-all duration-300 z-40 flex-shrink-0',
          sidebarOpen ? 'w-64' : 'w-0 md:w-20',
          'overflow-hidden md:overflow-visible'
        )}
      >
        <SidebarContent isCollapsed={!sidebarOpen} currentPath={location.pathname} />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-cyan/20 bg-gradient-to-r from-surface via-panel to-surface-strong flex items-center px-4 md:px-6 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hover:bg-cyan/10 hover:text-cyan"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <BotStatusBadge />
          <div className="ml-auto text-sm text-text-2 flex items-center gap-3">
            <button
              onClick={() => setPaletteOpen(true)}
              title="Command palette (Ctrl+K)"
              className="hidden sm:flex items-center gap-1.5 rounded-full border border-line bg-white/5 px-3 py-1.5 text-xs text-text-2 transition hover:border-cyan/30 hover:text-cyan"
            >
              <Command className="w-3.5 h-3.5" />
              <span>Search</span>
              <kbd className="ml-1 rounded border border-white/10 bg-white/5 px-1 py-0.5 font-mono text-[10px] opacity-60">Ctrl K</kbd>
            </button>
            <span className="hidden sm:block text-text-3">Sloth Lee</span>
            <span className="text-cyan font-semibold font-display tracking-wider">COMMAND CENTER</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-gradient-to-br from-void via-void to-surface/20">
          <div className="p-4 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 md:hidden z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  adminOnly?: boolean
  badge?: number
}

interface BotState {
  online: boolean
  stale: boolean
  latency_ms: number | null
  version: string | null
}

function BotStatusBadge() {
  const { data: bot } = useQuery<BotState>({
    queryKey: ['bot-state-header'],
    queryFn: () => getJson<BotState>('/api/bot'),
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: false,
  })

  const isOnline = bot?.online && !bot?.stale
  const color = !bot ? 'bg-text-3' : isOnline ? 'bg-lime' : 'bg-amber'
  const label = !bot ? 'Unknown' : isOnline ? 'Online' : (bot?.stale ? 'Stale' : 'Offline')
  const latency = bot?.latency_ms != null ? `${Math.round(bot.latency_ms)}ms` : '—'

  return (
    <div className="ml-3 flex items-center gap-1.5 text-xs text-text-2" title={`Bot ${label} · Latency: ${latency}`}>
      <span className={cn('w-2 h-2 rounded-full animate-pulse', color)} />
      <span className="hidden sm:block">{label}</span>
      {isOnline && <span className="hidden md:block text-text-3">· {latency}</span>}
    </div>
  )
}

interface SidebarContentProps {
  isCollapsed: boolean
  currentPath: string
}

const SidebarContent: React.FC<SidebarContentProps> = ({ isCollapsed, currentPath }) => {
  const user = useAuthStore((s) => s.user)
  const setAnonymous = useAuthStore((s) => s.setAnonymous)
  const navigate = useNavigate()
  const guilds = useAccessibleGuilds()

  const { data: notifData } = useQuery<{ unread: number }>({
    queryKey: ['notif-unread-count'],
    queryFn: () => getJson<{ unread: number }>('/api/notifications/unread-count'),
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  })
  const unreadCount = notifData?.unread ?? 0

  const navItems: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Servers', href: '/servers', icon: <Server className="w-5 h-5" />, badge: guilds.length },
    { label: 'Tickets', href: '/tickets', icon: <Ticket className="w-5 h-5" /> },
    { label: 'Moderation', href: '/moderation', icon: <ShieldAlert className="w-5 h-5" /> },
    { label: 'Analytics', href: '/analytics', icon: <BarChart3 className="w-5 h-5" /> },
    { label: 'AI Advisor', href: '/ai-advisor', icon: <Bot className="w-5 h-5" /> },
    { label: 'Notifications', href: '/notifications', icon: <Bell className="w-5 h-5" />, badge: unreadCount > 0 ? unreadCount : undefined },
    { label: 'Logs', href: '/logs', icon: <ScrollText className="w-5 h-5" /> },
    { label: 'Users', href: '/users', icon: <Users className="w-5 h-5" />, adminOnly: true },
    { label: 'Settings', href: '/settings', icon: <Settings className="w-5 h-5" /> },
  ]

  const visibleItems = navItems.filter((item) => !item.adminOnly || user?.is_admin || user?.is_owner)

  async function handleLogout() {
    try {
      await postJson('/auth/logout', {})
    } catch {
      // ignore
    }
    setAnonymous()
    navigate('/login')
  }

  const avatarUrl = user?.discord_id && user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png?size=64`
    : null

  return (
    <div className="flex flex-col h-full p-4">
      {/* Logo */}
      <div className="mb-8 flex items-center justify-center min-h-[72px]">
        <div className="text-center">
          <div className="text-4xl mb-1 select-none">🦥</div>
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-bold text-cyan font-display leading-none">SLOTH LEE</h1>
              <p className="text-[10px] text-text-3 tracking-[0.2em] mt-0.5">NINJA GUARD</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5">
        {visibleItems.map((item) => {
          const isActive = currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href + '/'))
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium group relative',
                isActive
                  ? 'bg-cyan/20 text-cyan border border-cyan/40 shadow-[0_0_8px_rgba(0,212,255,0.15)]'
                  : 'text-text-2 hover:text-cyan hover:bg-cyan/10 border border-transparent'
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <span className={cn('flex-shrink-0 transition-colors', isActive ? 'text-cyan' : 'text-text-3 group-hover:text-cyan')}>
                {item.icon}
              </span>
              {!isCollapsed && (
                <>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="bg-cyan/20 text-cyan text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-cyan/30 min-w-[20px] text-center leading-none flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <ChevronRight className="w-3.5 h-3.5 text-cyan/60 flex-shrink-0" />
                  )}
                </>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="border-t border-cyan/10 my-3" />

      {/* User Footer */}
      {!isCollapsed ? (
        <div className="space-y-1">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface/30 border border-cyan/10">
            {avatarUrl ? (
              <img src={avatarUrl} alt={user?.username} className="w-8 h-8 rounded-full border border-cyan/30 flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-cyan/20 border border-cyan/30 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-cyan" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-1 truncate">{user?.username ?? '—'}</p>
              {user?.is_owner ? (
                <span className="text-[10px] font-bold text-amber tracking-wider">OWNER</span>
              ) : user?.is_admin ? (
                <span className="text-[10px] font-bold text-lime tracking-wider">ADMIN</span>
              ) : null}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-2 hover:text-danger hover:bg-danger/10 transition-colors border border-transparent hover:border-danger/20"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      ) : (
        <button
          onClick={handleLogout}
          title="Logout"
          className="flex items-center justify-center w-full p-2 rounded-lg text-text-3 hover:text-danger hover:bg-danger/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export { AppShell }

