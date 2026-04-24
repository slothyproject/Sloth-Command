/**
 * Sidebar Component
 * Navigation sidebar with Central Hub v4.0 complete navigation
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/app/lib/utils';

// ============================================================================
// NAVIGATION CONFIGURATION
// ============================================================================

interface NavItem {
  name: string;
  href: string;
  icon: string;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    title: 'Command Center',
    items: [
      { name: 'Mission Control', href: '/dashboard/mission-control', icon: 'Zap', badge: 'NEW' },
      { name: 'Overview', href: '/dashboard', icon: 'LayoutDashboard' },
      { name: 'Services', href: '/dashboard/services', icon: 'Layers' },
      { name: 'Templates', href: '/dashboard/templates', icon: 'Template', badge: 'NEW' },
      { name: 'AI Hub', href: '/dashboard/ai-hub', icon: 'Brain' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { name: 'Security', href: '/dashboard/security', icon: 'Shield', badge: 'v4.0' },
      { name: 'Secrets', href: '/dashboard/secrets', icon: 'Lock', badge: 'NEW' },
      { name: 'Credentials', href: '/dashboard/credentials', icon: 'KeyRound', badge: 'NEW' },
      { name: 'Audit Logs', href: '/dashboard/audit-logs', icon: 'ClipboardList' },
      { name: 'Automation', href: '/dashboard/automation', icon: 'Automation', badge: 'NEW' },
      { name: 'Self-Healing', href: '/dashboard/healing', icon: 'HeartPulse', badge: 'v4.0' },
      { name: 'Scaling', href: '/dashboard/scaling', icon: 'TrendingUp', badge: 'v4.0' },
    ],
  },
  {
    title: 'Infrastructure',
    items: [
      { name: 'Cloud', href: '/dashboard/cloud', icon: 'Cloud', badge: 'v4.0' },
      { name: 'Kubernetes', href: '/dashboard/kubernetes', icon: 'Container', badge: 'v4.0' },
      { name: 'Git', href: '/dashboard/git', icon: 'GitBranch', badge: 'NEW' },
      { name: 'Pipelines', href: '/dashboard/pipelines', icon: 'Pipeline', badge: 'NEW' },
      { name: 'CI/CD', href: '/dashboard/cicd', icon: 'Workflow', badge: 'v4.0' },
    ],
  },
  {
    title: 'Community',
    items: [
      { name: 'Discord', href: '/dashboard/discord', icon: 'MessageSquare', badge: 'v4.0' },
      { name: 'Analytics', href: '/dashboard/analytics', icon: 'BarChart3' },
    ],
  },
  {
    title: 'System',
    items: [
      { name: 'Settings', href: '/dashboard/settings', icon: 'Settings' },
    ],
  },
];

// Mock services - in real app, fetch from API
const services = [
  { id: '1', name: 'Website', status: 'healthy' },
  { id: '2', name: 'API Backend', status: 'healthy' },
  { id: '3', name: 'Discord Bot', status: 'degraded' },
  { id: '4', name: 'Secrets Service', status: 'healthy' },
];

// ============================================================================
// SIDEBAR COMPONENT
// ============================================================================

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(
    navigation.map((section) => section.title)
  );

  const toggleSection = (title: string) => {
    setExpandedSections((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity',
          isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
        )}
        onClick={() => setIsCollapsed(true)}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen glass-elevated border-r border-white/10 transition-all duration-300',
          'lg:translate-x-0',
          isCollapsed
            ? '-translate-x-full lg:translate-x-0 lg:w-20'
            : 'translate-x-0 w-72'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center glow-cyan">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-lg text-white">Central Hub</span>
                <span className="text-[10px] text-cyan-400 font-medium">v4.0</span>
              </div>
            )}
          </Link>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 lg:block hidden transition-colors"
          >
            <svg
              className={cn('w-5 h-5 transition-transform', isCollapsed && 'rotate-180')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4 h-[calc(100vh-8rem)]">
          {navigation.map((section) => (
            <div key={section.title} className="space-y-1">
              {/* Section Header */}
              {!isCollapsed && (
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-2 py-1 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-slate-400 transition-colors"
                >
                  <span>{section.title}</span>
                  <svg
                    className={cn(
                      'w-3 h-3 transition-transform',
                      expandedSections.includes(section.title) ? 'rotate-180' : ''
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}

              {/* Section Items */}
              {(!isCollapsed ? expandedSections.includes(section.title) : true) && (
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group',
                        pathname === item.href || pathname.startsWith(item.href + '/')
                          ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-cyan-400 border border-cyan-500/30'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      <Icon name={item.icon} className="w-5 h-5 flex-shrink-0" />
                      {!isCollapsed && (
                        <div className="flex items-center justify-between flex-1 min-w-0">
                          <span className="truncate">{item.name}</span>
                          {item.badge && (
                            <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-cyan-500/20 text-cyan-400 rounded">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Services List */}
          <div className="pt-4 border-t border-white/10">
            {!isCollapsed && (
              <div className="px-2 py-1 text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                Services
              </div>
            )}
            <div className="space-y-0.5">
              {services.map((service) => (
                <Link
                  key={service.id}
                  href={`/dashboard/services/${service.id}`}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200',
                    pathname.includes(`/dashboard/services/${service.id}`)
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      service.status === 'healthy' && 'bg-green-400',
                      service.status === 'degraded' && 'bg-yellow-400',
                      service.status === 'unhealthy' && 'bg-red-400'
                    )}
                  />
                  {!isCollapsed && <span className="truncate text-sm">{service.name}</span>}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-3 bg-slate-900/50 backdrop-blur-sm">
          {/* Mobile Toggle */}
          <button
            onClick={() => setIsCollapsed(true)}
            className="absolute -top-10 right-3 p-2 rounded-lg bg-white/10 text-white lg:hidden"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Logout Button */}
          <button
            onClick={() => {
              localStorage.removeItem('central-hub-token');
              window.location.href = '/login';
            }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200',
              'text-slate-400 hover:bg-white/5 hover:text-red-400 group'
            )}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsCollapsed(false)}
        className="fixed top-4 left-4 z-30 p-2 rounded-lg bg-slate-800/90 border border-white/10 text-white lg:hidden"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </>
  );
}

// ============================================================================
// ICON COMPONENT
// ============================================================================

function Icon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    LayoutDashboard: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={2} />
        <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={2} />
        <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={2} />
        <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={2} />
      </svg>
    ),
    Layers: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
    Brain: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
    ),
    Shield: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
    HeartPulse: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l3 3" />
      </svg>
    ),
    TrendingUp: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    Cloud: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
        />
      </svg>
    ),
    Container: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
    ),
    GitBranch: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
        />
      </svg>
    ),
    MessageSquare: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    ),
    BarChart3: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    Settings: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    Zap: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    Lock: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    Template: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zM4 21a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2z" />
      </svg>
    ),
    Pipeline: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    Workflow: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    Automation: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        <circle cx="12" cy="12" r="3" strokeWidth={2} />
      </svg>
    ),
    KeyRound: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="7.5" cy="15.5" r="5.5" strokeWidth={2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 2l-9.6 9.6M15.5 7.5l3 3" />
      </svg>
    ),
    ClipboardList: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  };

  return icons[name] || null;
}
