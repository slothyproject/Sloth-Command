/**
 * Dashboard Overview Page
 * Main dashboard with stats, service overview, and activity
 */

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Welcome back! Here's what's happening with your services.</p>
        </div>
        <button className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Service
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Services"
          value="4"
          change="+1 this month"
          trend="up"
          icon="Layers"
        />
        <StatCard
          title="Healthy Services"
          value="3"
          change="75% uptime"
          trend="stable"
          icon="CheckCircle"
        />
        <StatCard
          title="Active Deployments"
          value="12"
          change="+3 this week"
          trend="up"
          icon="Rocket"
        />
        <StatCard
          title="AI Insights"
          value="8"
          change="2 need attention"
          trend="warning"
          icon="Brain"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service Status */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Service Status</h2>
            <a href="/dashboard/services" className="text-sm text-cyan-400 hover:text-cyan-300">
              View all →
            </a>
          </div>
          
          <div className="space-y-3">
            <ServiceRow
              name="Website"
              status="healthy"
              cpu={45}
              memory={62}
              lastDeploy="2 hours ago"
            />
            <ServiceRow
              name="API Backend"
              status="healthy"
              cpu={38}
              memory={55}
              lastDeploy="5 hours ago"
            />
            <ServiceRow
              name="Discord Bot"
              status="degraded"
              cpu={78}
              memory={82}
              lastDeploy="1 day ago"
            />
            <ServiceRow
              name="Token Vault"
              status="healthy"
              cpu={25}
              memory={40}
              lastDeploy="3 days ago"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
          
          <div className="space-y-4">
            <ActivityItem
              action="Deployment"
              service="Website"
              status="success"
              time="2 hours ago"
            />
            <ActivityItem
              action="Variable Update"
              service="API Backend"
              status="success"
              time="5 hours ago"
            />
            <ActivityItem
              action="Restart"
              service="Discord Bot"
              status="warning"
              time="1 day ago"
            />
            <ActivityItem
              action="AI Analysis"
              service="All Services"
              status="info"
              time="2 days ago"
            />
          </div>
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h2 className="text-lg font-semibold text-white">AI Recommendations</h2>
          </div>
          <a href="/dashboard/ai-hub" className="text-sm text-violet-400 hover:text-violet-300">
            View all →
          </a>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <RecommendationCard
            title="Scale Discord Bot"
            description="CPU usage consistently above 70%. Consider upgrading to larger instance."
            impact="high"
            autoFixable={true}
          />
          <RecommendationCard
            title="Update Dependencies"
            description="3 security patches available for API Backend."
            impact="medium"
            autoFixable={false}
          />
          <RecommendationCard
            title="Enable Caching"
            description="Add Redis cache to reduce database load by estimated 40%."
            impact="high"
            autoFixable={true}
          />
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ title, value, change, trend, icon }: {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'stable' | 'warning';
  icon: string;
}) {
  const trendColors = {
    up: 'text-green-400',
    down: 'text-red-400',
    stable: 'text-slate-400',
    warning: 'text-yellow-400',
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          <p className={`text-xs mt-2 ${trendColors[trend]}`}>{change}</p>
        </div>
        <div className="p-2 rounded-lg bg-white/5">
          <Icon name={icon} className="w-5 h-5 text-cyan-400" />
        </div>
      </div>
    </div>
  );
}

// Service Row Component
function ServiceRow({ name, status, cpu, memory, lastDeploy }: {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  cpu: number;
  memory: number;
  lastDeploy: string;
}) {
  const statusColors = {
    healthy: 'bg-green-400',
    degraded: 'bg-yellow-400',
    unhealthy: 'bg-red-400',
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
        <div>
          <p className="font-medium text-white">{name}</p>
          <p className="text-xs text-slate-400">Last deploy {lastDeploy}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs text-slate-400">CPU</p>
          <p className="text-sm font-medium text-white">{cpu}%</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Memory</p>
          <p className="text-sm font-medium text-white">{memory}%</p>
        </div>
        
        <div className="w-24 h-8 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-violet-500"
            style={{ width: `${Math.max(cpu, memory)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Activity Item Component
function ActivityItem({ action, service, status, time }: {
  action: string;
  service: string;
  status: 'success' | 'warning' | 'info';
  time: string;
}) {
  const statusIcons = {
    success: (
      <div className="w-8 h-8 rounded-full bg-green-400/20 flex items-center justify-center">
        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    ),
    warning: (
      <div className="w-8 h-8 rounded-full bg-yellow-400/20 flex items-center justify-center">
        <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
    ),
    info: (
      <div className="w-8 h-8 rounded-full bg-cyan-400/20 flex items-center justify-center">
        <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    ),
  };

  return (
    <div className="flex items-start gap-3">
      {statusIcons[status]}
      <div className="flex-1">
        <p className="text-sm text-white">
          <span className="font-medium">{action}</span> on {' '}
          <span className="text-cyan-400">{service}</span>
        </p>
        <p className="text-xs text-slate-400">{time}</p>
      </div>
    </div>
  );
}

// Recommendation Card Component
function RecommendationCard({ title, description, impact, autoFixable }: {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  autoFixable: boolean;
}) {
  const impactColors = {
    high: 'bg-red-400/20 text-red-400 border-red-400/30',
    medium: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30',
    low: 'bg-blue-400/20 text-blue-400 border-blue-400/30',
  };

  return (
    <div className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-white">{title}</h3>
        <span className={`px-2 py-0.5 text-xs rounded border ${impactColors[impact]}`}>
          {impact} impact
        </span>
      </div>
      
      <p className="text-sm text-slate-400 mb-3">{description}</p>
      
      <div className="flex items-center gap-2">
        {autoFixable ? (
          <button className="flex items-center gap-1 px-3 py-1.5 rounded bg-violet-500/20 text-violet-400 text-sm hover:bg-violet-500/30">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Auto-fix
          </button>
        ) : (
          <button className="text-sm text-slate-400 hover:text-white">
            Learn more →
          </button>
        )}
      </div>
    </div>
  );
}

// Icon Component
function Icon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, JSX.Element> = {
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
    Rocket: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 5.841m5.96-5.96a6 6 0 00-5.84-7.38v4.8m5.84 2.58a14.924 14.924 0 00-5.841-5.841M12 2.252A8.992 8.992 0 0112 21a8.992 8.992 0 010-18.748z" />
      </svg>
    ),
    Brain: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  };

  return icons[name] || null;
}
