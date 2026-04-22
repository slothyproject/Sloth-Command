/**
 * Dashboard Overview Page - v4.0 Updated
 * Real-time data from Central Hub API
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/app/lib/api-client';
import type { Service, AIInsight, Deployment, AgentPlan } from '@/app/types';
import { cn } from '@/app/lib/utils';

export default function DashboardPage() {
  // Fetch real services
  const { data: services, isLoading: isServicesLoading } = useQuery({
    queryKey: ['services', 'list'],
    queryFn: async () => {
      const response = await api.services.list();
      return response.data.data as Service[];
    },
    refetchInterval: 30000,
  });

  // Fetch AI insights
  const { data: insights, isLoading: isInsightsLoading } = useQuery({
    queryKey: ['ai', 'insights', 'all'],
    queryFn: async () => {
      // Get insights for all services
      const allInsights: AIInsight[] = [];
      if (services) {
        for (const service of services.slice(0, 3)) {
          try {
            const response = await api.ai.insights(service.id);
            if (response.data?.data) {
              allInsights.push(...response.data.data);
            }
          } catch {
            // Ignore errors for individual services
          }
        }
      }
      return allInsights;
    },
    enabled: !!services,
  });

  // Fetch active agent plans
  const { data: activePlans, isLoading: isPlansLoading } = useQuery({
    queryKey: ['agents', 'plans', 'active'],
    queryFn: async () => {
      const response = await api.agents.getActivePlans();
      return response.data as AgentPlan[];
    },
  });

  // Fetch recent deployments
  const { data: recentDeployments, isLoading: isDeploymentsLoading } = useQuery({
    queryKey: ['deployments', 'recent'],
    queryFn: async () => {
      const allDeployments: Deployment[] = [];
      if (services) {
        for (const service of services.slice(0, 3)) {
          try {
            const response = await api.deployments.list(service.id);
            if (response.data?.data) {
              allDeployments.push(...response.data.data.slice(0, 3));
            }
          } catch {
            // Ignore errors
          }
        }
      }
      // Sort by date and take top 5
      return allDeployments
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
    },
    enabled: !!services,
  });

  // Calculate stats
  const totalServices = services?.length || 0;
  const healthyServices = services?.filter((s) => s.status === 'healthy').length || 0;
  const activeInsights = insights?.filter((i) => !i.dismissedAt && !i.fixedAt).length || 0;
  const criticalInsights = insights?.filter((i) => i.severity === 'critical' && !i.dismissedAt && !i.fixedAt).length || 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Welcome back! Here's what's happening with your infrastructure.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/services"
            className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Service
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Services"
          value={totalServices.toString()}
          subtitle={`${healthyServices} healthy`}
          icon="Layers"
          color="cyan"
          isLoading={isServicesLoading}
        />
        <StatCard
          title="Service Health"
          value={`${totalServices > 0 ? Math.round((healthyServices / totalServices) * 100) : 0}%`}
          subtitle={`${totalServices - healthyServices} need attention`}
          icon="CheckCircle"
          color={healthyServices === totalServices ? 'green' : 'yellow'}
          isLoading={isServicesLoading}
        />
        <StatCard
          title="Active Plans"
          value={(activePlans?.length || 0).toString()}
          subtitle="Agent execution plans"
          icon="Brain"
          color="violet"
          isLoading={isPlansLoading}
        />
        <StatCard
          title="AI Insights"
          value={activeInsights.toString()}
          subtitle={criticalInsights > 0 ? `${criticalInsights} critical` : 'All clear'}
          icon="AlertTriangle"
          color={criticalInsights > 0 ? 'red' : 'green'}
          isLoading={isInsightsLoading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service Status */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Service Status</h2>
            <Link href="/dashboard/services" className="text-sm text-cyan-400 hover:text-cyan-300">
              View all →
            </Link>
          </div>

          {isServicesLoading ? (
            <ServiceSkeleton />
          ) : services && services.length > 0 ? (
            <div className="space-y-3">
              {services.slice(0, 5).map((service) => (
                <ServiceRow key={service.id} service={service} />
              ))}
            </div>
          ) : (
            <EmptyState message="No services found. Create your first service to get started." />
          )}
        </div>

        {/* Recent Activity */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>

          {isDeploymentsLoading ? (
            <ActivitySkeleton />
          ) : recentDeployments && recentDeployments.length > 0 ? (
            <div className="space-y-4">
              {recentDeployments.map((deployment, idx) => (
                <ActivityItem
                  key={deployment.id}
                  action={deployment.status === 'success' ? 'Deployment' : 'Deployment Failed'}
                  service={services?.find((s) => s.id === deployment.serviceId)?.name || 'Unknown'}
                  status={deployment.status === 'success' ? 'success' : deployment.status === 'failed' ? 'warning' : 'info'}
                  time={new Date(deployment.createdAt).toLocaleDateString()}
                />
              ))}
            </div>
          ) : (
            <EmptyState message="No recent activity" />
          )}
        </div>
      </div>

      {/* Active Agent Plans */}
      {activePlans && activePlans.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h2 className="text-lg font-semibold text-white">Active Agent Plans</h2>
            </div>
            <Link href="/dashboard/agents" className="text-sm text-violet-400 hover:text-violet-300">
              View all →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activePlans.slice(0, 3).map((plan) => (
              <AgentPlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      {insights && insights.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h2 className="text-lg font-semibold text-white">AI Insights & Recommendations</h2>
            </div>
            <Link href="/dashboard/ai-hub" className="text-sm text-violet-400 hover:text-violet-300">
              View all →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights
              .filter((i) => !i.dismissedAt && !i.fixedAt)
              .slice(0, 3)
              .map((insight) => (
                <RecommendationCard
                  key={insight.id}
                  title={insight.title}
                  description={insight.message}
                  severity={insight.severity}
                  autoFixable={insight.autoFixable}
                  serviceId={insight.serviceId}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPONENTS
// ============================================================================

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = 'cyan',
  isLoading = false,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  color?: 'cyan' | 'green' | 'yellow' | 'red' | 'violet';
  isLoading?: boolean;
}) {
  const colors = {
    cyan: 'from-cyan-500/20 to-cyan-600/20 text-cyan-400',
    green: 'from-green-500/20 to-green-600/20 text-green-400',
    yellow: 'from-yellow-500/20 to-yellow-600/20 text-yellow-400',
    red: 'from-red-500/20 to-red-600/20 text-red-400',
    violet: 'from-violet-500/20 to-violet-600/20 text-violet-400',
  };

  return (
    <div className={cn('glass-card p-5 bg-gradient-to-br', colors[color])}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-400">{title}</p>
          {isLoading ? (
            <div className="h-8 w-16 bg-white/20 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
          )}
          <p className="text-xs mt-2 text-slate-300">{subtitle}</p>
        </div>
        <div className="p-2 rounded-lg bg-white/5">
          <Icon name={icon} className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function ServiceRow({ service }: { service: Service }) {
  const statusColors: Record<string, string> = {
    healthy: 'bg-green-400',
    degraded: 'bg-yellow-400',
    unhealthy: 'bg-red-400',
    paused: 'bg-slate-400',
    deploying: 'bg-blue-400 animate-pulse',
    crashed: 'bg-red-500',
  };

  const lastDeploy = service.lastDeploymentAt
    ? new Date(service.lastDeploymentAt).toLocaleDateString()
    : 'Never';

  return (
    <Link
      href={`/dashboard/services/${service.id}`}
      className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className={cn('w-2 h-2 rounded-full', statusColors[service.status] || 'bg-slate-400')} />
        <div>
          <p className="font-medium text-white group-hover:text-cyan-400 transition-colors">
            {service.name}
          </p>
          <p className="text-xs text-slate-400">Last deploy {lastDeploy}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs text-slate-400">CPU</p>
          <p className="text-sm font-medium text-white">{service.cpuPercent ?? 0}%</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Memory</p>
          <p className="text-sm font-medium text-white">{service.memoryPercent ?? 0}%</p>
        </div>

        <div className="w-24 h-8 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-500"
            style={{ width: `${Math.max(service.cpuPercent || 0, service.memoryPercent || 0)}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

function ActivityItem({
  action,
  service,
  status,
  time,
}: {
  action: string;
  service: string;
  status: 'success' | 'warning' | 'info';
  time: string;
}) {
  const statusIcons = {
    success: (
      <div className="w-8 h-8 rounded-full bg-green-400/20 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    ),
    warning: (
      <div className="w-8 h-8 rounded-full bg-yellow-400/20 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
    ),
    info: (
      <div className="w-8 h-8 rounded-full bg-cyan-400/20 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    ),
  };

  return (
    <div className="flex items-start gap-3">
      {statusIcons[status]}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">
          <span className="font-medium">{action}</span> on{' '}
          <span className="text-cyan-400">{service}</span>
        </p>
        <p className="text-xs text-slate-400">{time}</p>
      </div>
    </div>
  );
}

function AgentPlanCard({ plan }: { plan: AgentPlan }) {
  const completedSteps = plan.steps.filter((s) => s.status === 'completed').length;
  const progress = plan.steps.length > 0 ? (completedSteps / plan.steps.length) * 100 : 0;

  const statusColors: Record<string, string> = {
    pending: 'text-yellow-400',
    in_progress: 'text-blue-400',
    completed: 'text-green-400',
    failed: 'text-red-400',
  };

  return (
    <div className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-white truncate">{plan.goal}</h3>
        <span className={cn('text-xs px-2 py-0.5 rounded bg-white/10', statusColors[plan.status])}>
          {plan.status}
        </span>
      </div>

      <p className="text-sm text-slate-400 mb-3">
        {plan.agentType} agent • {completedSteps}/{plan.steps.length} steps
      </p>

      <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-xs text-slate-400">{Math.round(progress)}% complete</p>
    </div>
  );
}

function RecommendationCard({
  title,
  description,
  severity,
  autoFixable,
  serviceId,
}: {
  title: string;
  description: string;
  severity: string;
  autoFixable: boolean;
  serviceId: string;
}) {
  const severityColors: Record<string, string> = {
    critical: 'bg-red-400/20 text-red-400 border-red-400/30',
    warning: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30',
    suggestion: 'bg-blue-400/20 text-blue-400 border-blue-400/30',
    info: 'bg-slate-400/20 text-slate-400 border-slate-400/30',
  };

  return (
    <div className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-white">{title}</h3>
        <span className={cn('px-2 py-0.5 text-xs rounded border', severityColors[severity])}>
          {severity}
        </span>
      </div>

      <p className="text-sm text-slate-400 mb-3">{description}</p>

      <div className="flex items-center justify-between">
        {autoFixable ? (
          <button className="flex items-center gap-1 px-3 py-1.5 rounded bg-violet-500/20 text-violet-400 text-sm hover:bg-violet-500/30">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Auto-fix
          </button>
        ) : (
          <span className="text-sm text-slate-500">Manual action required</span>
        )}
        <Link href={`/dashboard/services/${serviceId}`} className="text-sm text-cyan-400 hover:text-cyan-300">
          View service →
        </Link>
      </div>
    </div>
  );
}

function ServiceSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/5 rounded-full animate-pulse" />
          <div className="flex-1 h-12 bg-white/5 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
        <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-slate-400">{message}</p>
    </div>
  );
}

function Icon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    Layers: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
    CheckCircle: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
    AlertTriangle: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
  };

  return icons[name] || null;
}
