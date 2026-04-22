/**
 * AI Central Hub Page
 * AI-powered insights, predictions, and recommendations
 */

'use client';

import React, { useState } from 'react';
import { useServices } from '@/app/hooks/use-services';
import { AIOverview } from './components/ai-overview';
import { AIIntelligence } from './components/ai-intelligence';
import { AIRecommendations } from './components/ai-recommendations';
import { AIPredictions } from './components/ai-predictions';
import { AICommand } from './components/ai-command';
import { cn } from '@/app/lib/utils';

type Tab = 'overview' | 'intelligence' | 'recommendations' | 'predictions' | 'command';

// Force dynamic rendering - requires client-side TanStack Query
export const dynamic = 'force-dynamic';

export default function AIHubPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { data: services } = useServices();

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'LayoutDashboard' },
    { id: 'intelligence', label: 'Intelligence', icon: 'Brain' },
    { id: 'recommendations', label: 'Recommendations', icon: 'Lightbulb' },
    { id: 'predictions', label: 'Predictions', icon: 'TrendingUp' },
    { id: 'command', label: 'Command', icon: 'Terminal' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">AI Central Hub</h1>
              <p className="text-slate-400">Intelligent insights and automation for your services</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="glass-card px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-slate-300">AI Active</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass-card">
        <div className="border-b border-white/10">
          <nav className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={cn(
                  "flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
                  activeTab === tab.id
                    ? "border-violet-500 text-violet-400"
                    : "border-transparent text-slate-400 hover:text-white hover:border-slate-600"
                )}
              >
                <Icon name={tab.icon} className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && <AIOverview services={services} />}
          {activeTab === 'intelligence' && <AIIntelligence services={services} />}
          {activeTab === 'recommendations' && <AIRecommendations services={services} />}
          {activeTab === 'predictions' && <AIPredictions services={services} />}
          {activeTab === 'command' && <AICommand />}
        </div>
      </div>
    </div>
  );
}

// Icon Component
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
    Brain: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    Lightbulb: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    TrendingUp: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    Terminal: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h7M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  };

  return icons[name] || null;
}
