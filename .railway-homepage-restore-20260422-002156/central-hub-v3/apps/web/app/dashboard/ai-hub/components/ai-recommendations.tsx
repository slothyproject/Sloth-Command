/**
 * AI Recommendations Component
 * AI-generated optimization suggestions - with real API integration
 */

'use client';

import React from 'react';
import { useServices } from '@/app/hooks/use-services';
import { useAllAIInsights, useAIFix, type AIInsight } from '@/app/hooks/use-ai';
import { cn } from '@/app/lib/utils';

interface AIRecommendationsProps {
  services?: unknown[];
}

export function AIRecommendations({ services: _services }: AIRecommendationsProps) {
  const { data: services, isLoading: servicesLoading } = useServices();
  const { data: insights, isLoading: insightsLoading } = useAllAIInsights(services);
  const fixMutation = useAIFix();

  const isLoading = servicesLoading || insightsLoading;

  // Calculate stats
  const stats = React.useMemo(() => {
    if (!insights) return null;
    
    const recommendations = insights.filter(i => i.type === 'optimization');
    const critical = recommendations.filter(i => i.severity === 'critical').length;
    const high = recommendations.filter(i => i.severity === 'warning').length;
    const medium = recommendations.filter(i => i.severity === 'info').length;
    const autoFixable = recommendations.filter(i => i.autoFixable).length;
    
    return {
      total: recommendations.length,
      critical,
      high,
      medium,
      autoFixable,
    };
  }, [insights]);

  // Filter recommendations
  const recommendations = React.useMemo(() => {
    if (!insights) return [];
    return insights.filter(i => i.type === 'optimization');
  }, [insights]);

  const handleAutoFix = async (insightId: string) => {
    try {
      await fixMutation.mutateAsync(insightId);
    } catch (error) {
      console.error('Failed to apply fix:', error);
    }
  };

  if (isLoading) {
    return <RecommendationsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Critical"
          count={stats?.critical || 0}
          color="red"
          icon="AlertTriangle"
        />
        <SummaryCard
          title="High Impact"
          count={stats?.high || 0}
          color="yellow"
          icon="TrendingUp"
        />
        <SummaryCard
          title="Medium"
          count={stats?.medium || 0}
          color="blue"
          icon="Info"
        />
        <SummaryCard
          title="Auto-Fixable"
          count={stats?.autoFixable || 0}
          color="green"
          icon="Wand2"
        />
      </div>

      {/* Total Savings Estimate */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400">Total Recommendations</p>
            <p className="text-3xl font-bold text-cyan-400 mt-1">{stats?.total || 0}</p>
            <p className="text-sm text-slate-500 mt-1">
              {stats?.autoFixable || 0} can be auto-fixed
            </p>
          </div>
          
          <button 
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!stats?.autoFixable}
          >
            Apply All Auto-Fixes
          </button>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {recommendations.length === 0 && (
          <div className="glass-card p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <Icon name="Sparkles" className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-slate-400">No recommendations available</p>
            <p className="text-sm text-slate-500 mt-1">
              AI is analyzing your services for optimization opportunities
            </p>
          </div>
        )}

        {recommendations.map((insight) => (
          <RecommendationCard 
            key={insight.id} 
            recommendation={insight} 
            onAutoFix={() => handleAutoFix(insight.id)}
            isFixing={fixMutation.isPending && fixMutation.variables === insight.id}
          />
        ))}
      </div>
    </div>
  );
}

// Summary Card
function SummaryCard({ 
  title, 
  count, 
  color,
  icon,
}: { 
  title: string; 
  count: number; 
  color: 'red' | 'yellow' | 'blue' | 'green';
  icon: string;
}) {
  const colors = {
    red: 'from-red-500/20 to-red-600/20 text-red-400',
    yellow: 'from-yellow-500/20 to-yellow-600/20 text-yellow-400',
    blue: 'from-blue-500/20 to-blue-600/20 text-blue-400',
    green: 'from-green-500/20 to-green-600/20 text-green-400',
  };

  return (
    <div className="glass-card p-4 text-center">
      <div className={cn(
        "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mx-auto mb-2",
        colors[color]
      )}>
        <Icon name={icon} className="w-5 h-5" />
      </div>
      <p className="text-sm text-slate-400">{title}</p>
      <p className={cn("text-2xl font-bold mt-1", colors[color].split(' ')[2])}>
        {count}
      </p>
    </div>
  );
}

// Recommendation Card
function RecommendationCard({ 
  recommendation, 
  onAutoFix,
  isFixing,
}: { 
  recommendation: AIInsight;
  onAutoFix: () => void;
  isFixing: boolean;
}) {
  const impactColors = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  const categoryIcons: Record<string, string> = {
    performance: 'Zap',
    cost: 'DollarSign',
    security: 'Shield',
    reliability: 'Activity',
    optimization: 'Settings',
  };

  const categoryLabels: Record<string, string> = {
    performance: 'Performance',
    cost: 'Cost Optimization',
    security: 'Security',
    reliability: 'Reliability',
    optimization: 'Optimization',
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              recommendation.type === 'performance' && "bg-cyan-500/20 text-cyan-400",
              recommendation.type === 'cost' && "bg-green-500/20 text-green-400",
              recommendation.type === 'security' && "bg-red-500/20 text-red-400",
              recommendation.type === 'reliability' && "bg-violet-500/20 text-violet-400",
              recommendation.type === 'optimization' && "bg-yellow-500/20 text-yellow-400",
            )}>
              <Icon name={categoryIcons[recommendation.type]} className="w-4 h-4" />
            </div>
            <h4 className="font-semibold text-white">{recommendation.title}</h4>
            
            <span className={cn(
              "px-2 py-0.5 rounded text-xs font-medium border capitalize",
              impactColors[recommendation.severity]
            )}>
              {recommendation.severity} impact
            </span>
          </div>
          
          <p className="text-slate-400 mb-4">{recommendation.description}</p>
          
          <div className="flex items-center gap-6 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Service:</span>
              <span className="text-white">{recommendation.serviceName}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Category:</span>
              <span className="text-slate-300">{categoryLabels[recommendation.type]}</span>
            </div>
            
            {recommendation.estimatedImpact?.savings && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Savings:</span>
                <span className="text-green-400">{recommendation.estimatedImpact.savings}</span>
              </div>
            )}
            
            {recommendation.estimatedImpact?.performance && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Performance:</span>
                <span className="text-cyan-400">{recommendation.estimatedImpact.performance}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-4 shrink-0">
          {recommendation.autoFixable && (
            <button 
              onClick={onAutoFix}
              disabled={isFixing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors disabled:opacity-50"
            >
              <Icon name={isFixing ? "Loader" : "Play"} className="w-4 h-4" />
              {isFixing ? 'Applying...' : 'Auto-Fix'}
            </button>
          )}
          
          <button className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
            <Icon name="Eye" className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Skeleton Loading State
function RecommendationsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-4 animate-pulse text-center">
            <div className="h-10 bg-slate-800 rounded-full w-10 mx-auto mb-2" />
            <div className="h-4 bg-slate-800 rounded w-20 mx-auto" />
            <div className="h-6 bg-slate-800 rounded w-8 mx-auto mt-2" />
          </div>
        ))}
      </div>
      
      <div className="glass-card p-6 animate-pulse">
        <div className="h-6 bg-slate-800 rounded w-48" />
        <div className="h-10 bg-slate-800 rounded w-32 mt-2" />
      </div>
      
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card p-6 animate-pulse">
            <div className="h-20 bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Icon Component
function Icon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    AlertTriangle: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    TrendingUp: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    Info: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    Wand2: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
    Sparkles: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    Zap: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    DollarSign: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    Shield: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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
    Eye: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    Play: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    Loader: (
      <svg className={cn(className, "animate-spin")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  };

  return icons[name] || null;
}
