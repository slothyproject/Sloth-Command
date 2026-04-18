/**
 * AI Recommendations Component
 * AI-generated optimization suggestions
 */

import { cn } from '@/app/lib/utils';
import type { Service } from '@central-hub/shared-types';

interface AIRecommendationsProps {
  services: Service[] | undefined;
}

export function AIRecommendations({ services }: AIRecommendationsProps) {
  const recommendations = [
    {
      id: '1',
      title: 'Scale Discord Bot to Pro Plan',
      description: 'CPU consistently above 70%. Upgrading will improve performance by estimated 40% and reduce latency.',
      impact: 'high',
      category: 'performance',
      service: 'Discord Bot',
      estimatedSavings: null,
      estimatedCost: '+$25/month',
      autoFixable: true,
    },
    {
      id: '2',
      title: 'Enable Redis Caching',
      description: 'Database queries account for 60% of API response time. Adding Redis cache could reduce this by 80%.',
      impact: 'high',
      category: 'performance',
      service: 'API Backend',
      estimatedSavings: null,
      estimatedCost: '+$15/month',
      autoFixable: true,
    },
    {
      id: '3',
      title: 'Downsize Token Vault',
      description: 'Resource utilization is only 25%. You can safely downgrade to a smaller instance without impacting performance.',
      impact: 'medium',
      category: 'cost',
      service: 'Token Vault',
      estimatedSavings: '$45/month',
      estimatedCost: null,
      autoFixable: true,
    },
    {
      id: '4',
      title: 'Renew SSL Certificate',
      description: 'Certificate expires in 15 days. Auto-renewal is recommended to prevent service interruption.',
      impact: 'high',
      category: 'security',
      service: 'Website',
      estimatedSavings: null,
      estimatedCost: '$0',
      autoFixable: true,
    },
    {
      id: '5',
      title: 'Enable Request Compression',
      description: 'Responses are not compressed, increasing bandwidth usage by 60%. Enabling gzip could save bandwidth costs.',
      impact: 'medium',
      category: 'cost',
      service: 'Website',
      estimatedSavings: '$20/month',
      estimatedCost: '$0',
      autoFixable: false,
    },
    {
      id: '6',
      title: 'Update Dependencies',
      description: '3 security vulnerabilities found in dependencies. Updates are available that fix these issues.',
      impact: 'critical',
      category: 'security',
      service: 'API Backend',
      estimatedSavings: null,
      estimatedCost: '$0',
      autoFixable: false,
    },
  ];

  const groupedRecommendations = {
    critical: recommendations.filter((r) => r.impact === 'critical'),
    high: recommendations.filter((r) => r.impact === 'high'),
    medium: recommendations.filter((r) => r.impact === 'medium'),
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Critical"
          count={groupedRecommendations.critical.length}
          color="red"
        />
        <SummaryCard
          title="High Impact"
          count={groupedRecommendations.high.length}
          color="yellow"
        />
        <SummaryCard
          title="Medium"
          count={groupedRecommendations.medium.length}
          color="blue"
        />
        <SummaryCard
          title="Auto-Fixable"
          count={recommendations.filter((r) => r.autoFixable).length}
          color="green"
        />
      </div>

      {/* Total Savings */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400">Potential Monthly Savings</p>
            <p className="text-3xl font-bold text-green-400 mt-1">$65/month</p>
          </div>
          
          <button className="btn-primary px-6 py-3 rounded-lg">
            Apply All Recommended
          </button>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {recommendations.map((rec) => (
          <RecommendationCard key={rec.id} recommendation={rec} />
        ))}
      </div>
    </div>
  );
}

// Summary Card
function SummaryCard({ 
  title, 
  count, 
  color 
}: { 
  title: string; 
  count: number; 
  color: 'red' | 'yellow' | 'blue' | 'green';
}) {
  const colors = {
    red: 'bg-red-400/20 text-red-400',
    yellow: 'bg-yellow-400/20 text-yellow-400',
    blue: 'bg-blue-400/20 text-blue-400',
    green: 'bg-green-400/20 text-green-400',
  };

  return (
    <div className="glass-card p-4 text-center">
      <p className="text-sm text-slate-400">{title}</p>
      <p className={cn("text-2xl font-bold mt-1", colors[color].split(' ')[1])}>
        {count}
      </p>
    </div>
  );
}

// Recommendation Card
function RecommendationCard({ 
  recommendation 
}: { 
  recommendation: {
    title: string;
    description: string;
    impact: string;
    category: string;
    service: string;
    estimatedSavings: string | null;
    estimatedCost: string | null;
    autoFixable: boolean;
  }
}) {
  const impactColors = {
    critical: 'bg-red-400/20 text-red-400 border-red-400/30',
    high: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30',
    medium: 'bg-blue-400/20 text-blue-400 border-blue-400/30',
    low: 'bg-slate-400/20 text-slate-400 border-slate-400/30',
  };

  const categoryIcons: Record<string, string> = {
    performance: '⚡',
    cost: '💰',
    security: '🔒',
    reliability: '📈',
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{categoryIcons[recommendation.category]}</span>
            <h4 className="font-semibold text-white">{recommendation.title}</h4>
            
            <span className={cn(
              "px-2 py-0.5 rounded text-xs font-medium border capitalize",
              impactColors[recommendation.impact as keyof typeof impactColors]
            )}>
              {recommendation.impact} impact
            </span>
          </div>
          
          <p className="text-slate-400 mb-4">{recommendation.description}</p>
          
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Service:</span>
              <span className="text-white">{recommendation.service}</span>
            </div>
            
            {recommendation.estimatedSavings && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Savings:</span>
                <span className="text-green-400">{recommendation.estimatedSavings}</span>
              </div>
            )}
            
            {recommendation.estimatedCost && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Cost:</span>
                <span className="text-white">{recommendation.estimatedCost}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          {recommendation.autoFixable && (
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Auto-Fix
            </button>
          )}
          
          <button className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
