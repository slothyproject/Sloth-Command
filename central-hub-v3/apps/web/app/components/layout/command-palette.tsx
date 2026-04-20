/**
 * Command Palette / Global Search
 * Cmd+K to search services, variables, and commands
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/app/lib/utils';
import { useServices } from '@/app/hooks/use-services';

interface Command {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  action: () => void;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const { data: services } = useServices();

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Commands
  const commands: Command[] = [
    {
      id: 'services',
      title: 'Go to Services',
      subtitle: 'View all services',
      icon: 'Layers',
      action: () => {
        router.push('/dashboard/services');
        setIsOpen(false);
      },
    },
    {
      id: 'ai-hub',
      title: 'Go to AI Hub',
      subtitle: 'AI insights and recommendations',
      icon: 'Brain',
      action: () => {
        router.push('/dashboard/ai-hub');
        setIsOpen(false);
      },
    },
    {
      id: 'analytics',
      title: 'Go to Analytics',
      subtitle: 'View metrics and reports',
      icon: 'BarChart',
      action: () => {
        router.push('/dashboard/analytics');
        setIsOpen(false);
      },
    },
    {
      id: 'settings',
      title: 'Open Settings',
      subtitle: 'Configure preferences',
      icon: 'Settings',
      action: () => {
        router.push('/dashboard/settings');
        setIsOpen(false);
      },
    },
    {
      id: 'new-service',
      title: 'Create New Service',
      subtitle: 'Add a new service',
      icon: 'Plus',
      action: () => {
        router.push('/dashboard/services/new');
        setIsOpen(false);
      },
    },
    {
      id: 'sync',
      title: 'Sync with Railway',
      subtitle: 'Update services from Railway',
      icon: 'RefreshCw',
      action: () => {
        // Trigger sync
        setIsOpen(false);
      },
    },
  ];

  // Service commands
  const serviceCommands = services?.map((service) => ({
    id: `service-${service.id}`,
    title: service.name,
    subtitle: 'Open service details',
    icon: 'Server',
    action: () => {
      router.push(`/dashboard/services/${service.id}`);
      setIsOpen(false);
    },
  })) || [];

  // Filter commands
  const allCommands = [...commands, ...serviceCommands];
  const filteredCommands = query
    ? allCommands.filter(
        (cmd) =>
          cmd.title.toLowerCase().includes(query.toLowerCase()) ||
          cmd.subtitle?.toLowerCase().includes(query.toLowerCase())
      )
    : allCommands;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => setIsOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl mx-4 glass-elevated rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <svg
            className="w-5 h-5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services, commands..."
            className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none"
            autoFocus
          />
          <kbd className="px-2 py-1 text-xs rounded bg-slate-700 text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-400">No results found</p>
            </div>
          ) : (
            <div className="py-2">
              {filteredCommands.map((command, index) => (
                <button
                  key={command.id}
                  onClick={command.action}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors',
                    index === 0 && 'bg-white/5'
                  )}
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <Icon name={command.icon} className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-white font-medium">{command.title}</p>
                    {command.subtitle && (
                      <p className="text-sm text-slate-400">{command.subtitle}</p>
                    )}
                  </div>
                  <svg
                    className="w-5 h-5 text-slate-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-700">↑</kbd>{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-slate-700">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-700">↵</kbd> to select
            </span>
          </div>
          <span>{filteredCommands.length} results</span>
        </div>
      </div>
    </div>
  );
}

// Icon Component
function Icon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    Layers: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
        />
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
    BarChart: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
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
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
    Plus: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    RefreshCw: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    ),
    Server: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="2" y="2" width="20" height="8" rx="2" strokeWidth={2} />
        <rect x="2" y="14" width="20" height="8" rx="2" strokeWidth={2} />
      </svg>
    ),
  };

  return icons[name] || null;
}
