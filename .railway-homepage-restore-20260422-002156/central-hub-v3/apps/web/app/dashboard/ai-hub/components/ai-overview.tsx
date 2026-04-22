/**
 * AI Overview Component
 * Dashboard overview of AI insights and status - with real API integration
 */

'use client';

import React from 'react';
import { useServices } from '@/app/hooks/use-services';
import { 
  useAllAIInsights, 
  useAgents,
  type AIInsight 
} from '@/app/hooks/use-ai';
import { cn } from '@/app/lib/utils';

interface AIOverviewProps {
  services?: unknown[];
}

export function AIOverview({ services: _services }: AIOverviewProps) {
  const { data: services, isLoading: servicesLoading } = useServices();
  const { data: insights, isLoading: insightsLoading } = useAllAIInsights(services);
  const { data: agents, isLoading: agentsLoading } = useAgents();

  const isLoading = servicesLoading || insightsLoading || agentsLoading;

  // Calculate stats
  const stats = React.useMemo(() => {
    if (!insights) return null;
    
    const totalInsights = insights.length;
    const criticalInsights = insights.filter(i => i.severity === 'critical').length;
    const warningInsights = insights.filter(i => i.severity === 'warning').length;
    const autoFixable = insights.filter(i => i.autoFixable).length;
    const openInsights = insights.filter(i => i.status === 'open').length;
    
    return {
      totalInsights,
      criticalInsights,
      warningInsights,
      autoFixable,
      openInsights,
    };
  }, [insights]);

  // Group insights by type
  const insightsByType = React.useMemo(() => {
    if (!insights) return {};
    
    return insights.reduce((acc, insight) => {
      acc[insight.type] = (acc[insight.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [insights]);

  if (isLoading) {
    return <OverviewSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Insights"
          value={stats?.totalInsights || 0}
          icon="Lightbulb"
          color="cyan"
          subtitle={`${stats?.openInsights || 0} open`}
        />
        <StatCard
          title="Critical Issues"
          value={stats?.criticalInsights || 0}
          icon="AlertTriangle"
          color="red"
          subtitle="Needs immediate attention"
        />
        <StatCard
          title="Auto-Fixable"
          value={stats?.autoFixable || 0}
          icon="Wand2"
          color="green"
          subtitle="Can be resolved automatically"
        />
        <StatCard
          title="Active Agents"
          value={agents?.length || 0}
          icon="Bot"
          color="violet"
          subtitle="Available AI agents"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Insights */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Recent AI Insights</h3>
            <span className="text-sm text-slate-400">
              {insights?.slice(0, 5).length || 0} of {stats?.totalInsights || 0} shown
            </span>
          </div>
          
          <div className="space-y-3">
            {insights?.slice(0, 5).map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
            
            {(!insights || insights.length === 0) && (
              <div className="glass-card p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <Icon name="Sparkles" className="w-8 h-8 text-slate-500" />
                </div>
                <p className="text-slate-400">No AI insights available yet</p>
                <p className="text-sm text-slate-500 mt-1">
                  Insights will appear as AI analyzes your services
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Insights by Type */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Insights by Category</h3>
            <div className="space-y-3">
              {Object.entries(insightsByType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      type === 'performance' && "bg-cyan-500",
                      type === 'security' && "bg-red-500",
                      type === 'cost' && "bg-green-500",
                      type === 'reliability' && "bg-violet-500",
                      type === 'optimization' && "bg-yellow-500",
                    )} />
                    <span className="text-sm text-slate-300 capitalize">{type}</span>
                  </div>
                  <span className="text-sm font-medium text-white">{count}</span>
                </div>
              ))}
              
              {Object.keys(insightsByType).length === 0 && (
                <p className="text-sm text-slate-500 text-center py-2">
                  No data available
                </p>
              )}
            </div>
          </div>

          {/* Agent Capabilities */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">AI Capabilities</h3>
            <div className="space-y-2">
              {agents?.slice(0, 4).map((agent) => (
                <div key={agent.type} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
                    <Icon name="Bot" className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{agent.name}</p>
                    <p className="text-xs text-slate-400 truncate">{agent.description}</p>
                  </div>
                </div>
              ))}
              
              {(!agents || agents.length === 0) && (
                <p className="text-sm text-slate-500 text-center py-2">
                  Loading agents...
                </p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-left">
                <Icon name="RefreshCw" className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-slate-300">Refresh All Insights</span>
              </button>
              <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-left">
                <Icon name="Zap" className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-slate-300">Run Auto-Fixes</span>
              </button>
              <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-left">
                <Icon name="Download" className="w-4 h-4 text-green-400" />
                <span className="text-sm text-slate-300">Export Report</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ 
  title, 
  value, 
  icon, 
  color, 
  subtitle 
}: { 
  title: string; 
  value: number; 
  icon: string; 
  color: 'cyan' | 'red' | 'green' | 'violet' | 'yellow'; 
  subtitle: string;
}) {
  const colorClasses = {
    cyan: 'from-cyan-500/20 to-cyan-600/20 text-cyan-400',
    red: 'from-red-500/20 to-red-600/20 text-red-400',
    green: 'from-green-500/20 to-green-600/20 text-green-400',
    violet: 'from-violet-500/20 to-violet-600/20 text-violet-400',
    yellow: 'from-yellow-500/20 to-yellow-600/20 text-yellow-400',
  };

  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        </div>
        <div className={cn(
          "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center",
          colorClasses[color]
        )}>
          <Icon name={icon} className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

// Insight Card Component
function InsightCard({ insight }: { insight: AIInsight }) {
  const severityColors = {
    info: 'border-l-cyan-500',
    warning: 'border-l-yellow-500',
    critical: 'border-l-red-500',
  };

  const typeIcons = {
    performance: 'Zap',
    security: 'Shield',
    cost: 'DollarSign',
    reliability: 'Activity',
    optimization: 'Settings',
  };

  const typeColors = {
    performance: 'text-cyan-400 bg-cyan-500/10',
    security: 'text-red-400 bg-red-500/10',
    cost: 'text-green-400 bg-green-500/10',
    reliability: 'text-violet-400 bg-violet-500/10',
    optimization: 'text-yellow-400 bg-yellow-500/10',
  };

  return (
    <div className={cn(
      "glass-card p-4 border-l-4",
      severityColors[insight.severity]
    )}>
      <div className="flex items-start gap-4">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          typeColors[insight.type]
        )}>
          <Icon name={typeIcons[insight.type]} className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-medium text-white">{insight.title}</h4>
              <p className="text-sm text-slate-400 mt-1">{insight.description}</p>
            </div>
            <span className={cn(
              "px-2 py-1 rounded text-xs font-medium shrink-0",
              insight.status === 'open' && "bg-yellow-500/20 text-yellow-400",
              insight.status === 'in_progress' && "bg-cyan-500/20 text-cyan-400",
              insight.status === 'resolved' && "bg-green-500/20 text-green-400",
              insight.status === 'dismissed' && "bg-slate-500/20 text-slate-400",
            )}>
              {insight.status.replace('_', ' ')}
            </span>
          </div>
          
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Icon name="Server" className="w-3 h-3" />
              {insight.serviceName}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="Clock" className="w-3 h-3" />
              {new Date(insight.createdAt).toLocaleDateString()}
            </span>
            {insight.autoFixable && (
              <span className="flex items-center gap-1 text-cyan-400">
                <Icon name="Wand2" className="w-3 h-3" />
                Auto-fixable
              </span>
            )}
          </div>
          
          {insight.estimatedImpact && (
            <div className="flex items-center gap-3 mt-3">
              {insight.estimatedImpact.savings && (
                <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
                  Save {insight.estimatedImpact.savings}
                </span>
              )}
              {insight.estimatedImpact.performance && (
                <span className="text-xs px-2 py-1 rounded bg-cyan-500/20 text-cyan-400">
                  {insight.estimatedImpact.performance}
                </span>
              )}
              {insight.estimatedImpact.reliability && (
                <span className="text-xs px-2 py-1 rounded bg-violet-500/20 text-violet-400">
                  {insight.estimatedImpact.reliability}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Skeleton Loading State
function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-4 animate-pulse">
            <div className="h-4 bg-slate-800 rounded w-24 mb-2" />
            <div className="h-8 bg-slate-800 rounded w-16" />
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="h-16 bg-slate-800 rounded" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="h-32 bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Icon Component
function Icon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    Lightbulb: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    AlertTriangle: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    Wand2: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
    Bot: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    Sparkles: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    RefreshCw: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    Zap: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    Download: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
    Shield: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    DollarSign: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    Activity: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    Settings: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    Server: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    ),
    Clock: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return icons[name] || null;
}
