'use client'

import React, { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '../ui/button'

interface AppShellProps {
  className?: string
}

const AppShell: React.FC<AppShellProps> = ({ className }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  return (
    <div className={cn('flex h-screen bg-void', className)}>
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:static top-0 left-0 h-screen bg-gradient-to-b from-surface-strong via-panel to-void border-r border-cyan/20 transition-all duration-300 z-40',
          sidebarOpen ? 'w-64' : 'w-0 md:w-20',
          'overflow-hidden md:overflow-visible'
        )}
      >
        <SidebarContent isCollapsed={!sidebarOpen} currentPath={location.pathname} />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-cyan/20 bg-gradient-to-r from-surface via-panel to-surface-strong flex items-center px-4 md:px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <div className="ml-auto text-sm text-text-2">
            <span className="text-cyan font-semibold">Sloth Lee</span> Command Center
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
          className="fixed inset-0 bg-black/50 md:hidden z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}

interface SidebarContentProps {
  isCollapsed: boolean
  currentPath: string
}

const SidebarContent: React.FC<SidebarContentProps> = ({ isCollapsed, currentPath }) => {
  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'Servers', href: '/servers', icon: '🖥️' },
    { label: 'Tickets', href: '/tickets', icon: '🎫' },
    { label: 'Moderation', href: '/moderation', icon: '⚖️' },
    { label: 'Analytics', href: '/analytics', icon: '📈' },
    { label: 'AI Advisor', href: '/ai-advisor', icon: '🤖' },
    { label: 'Logs', href: '/logs', icon: '📝' },
    { label: 'Users', href: '/users', icon: '👥' },
    { label: 'Settings', href: '/settings', icon: '⚙️' },
  ]

  return (
    <div className="flex flex-col h-full p-4">
      {/* Logo */}
      <div className="mb-8 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-2">🦥</div>
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-bold text-cyan font-display">SLOTH LEE</h1>
              <p className="text-xs text-text-3 tracking-wider">NINJA GUARD</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = currentPath === item.href || currentPath.startsWith(item.href + '/')
          return (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium',
                isActive
                  ? 'bg-cyan/20 text-cyan border border-cyan/40 shadow-cyan-glow'
                  : 'text-text-2 hover:text-cyan hover:bg-cyan/10 border border-transparent'
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <span className="text-lg">{item.icon}</span>
              {!isCollapsed && <span>{item.label}</span>}
            </a>
          )
        })}
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="border-t border-cyan/20 pt-4">
          <button className="w-full px-3 py-2 rounded-lg text-sm text-text-2 hover:text-cyan hover:bg-cyan/10 transition-colors">
            👤 Profile
          </button>
          <button className="w-full px-3 py-2 rounded-lg text-sm text-danger hover:bg-danger/10 transition-colors mt-2">
            🚪 Logout
          </button>
        </div>
      )}
    </div>
  )
}

export { AppShell }
