/**
 * AI Overview Component
 * Dashboard overview of AI insights and status
 */

import { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { cn, getStatusColor } from '@/app/lib/utils';

interface Service {
  id: string;
  name: string;
  healthScore?: number;
  cpuPercent?: number;
  memoryPercent?: number;
}

interface AIOverviewProps {
  services: Service[] | undefined;
}

export function AIOverview({ services }: AIOverviewProps) {
  // Mock health data for charts
  const healthData = useMemo(() => {
    if (!services) return [];
    return services.map(s => ({
      name: s.name,
      health: s.healthScore || Math.floor(Math.random() * 30) + 70,
      cpu: s.cpuPercent || Math.floor(Math.random() * 40) + 30,
      memory: s.memoryPercent || Math.floor(Math.random() * 30) + 40,
    }));
  }, [services]);

  const insightData = [
    { name: 'Critical', value: 2, color: '#ef4444' },
    { name: 'Warning', value: 5, color: '#f59e0b' },
    { name: 'Suggestions', value: 12, color: '#3b82f6' },
    { name: 'Info', value: 8, color: '#64748b' },
  ];

  const stats = {
    totalInsights: 27,
    actionable: 8,
    autoFixable: 3,
    predictions: 4,
    avgHealth: 87,
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Insights"
          value={stats.totalInsights}
          change="+5 this week"
          trend="up"
          color="violet"
        />
        <StatCard
          title="Actionable"
          value={stats.actionable}
          change="3 critical"
          trend="warning"
          color="yellow"
        />
        <StatCard
          title="Auto-Fixable"
          value={stats.autoFixable}
          change="Ready to apply"
          trend="up"
          color="green"
        />
        <StatCard
          title="Avg Health"
          value={`${stats.avgHealth}%`}
          change="+2%"
          trend="up"
          color="cyan"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Health Chart */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Service Health Scores</h3>
            <span className="text-sm text-slate-400">Real-time</span>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={healthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="name" 
                  stroke="#64748b" 
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={12}
                  tickLine={false}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                  }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="health" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Insights Distribution */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Insights Distribution</h3>
            <span className="text-sm text-slate-400">By severity</span>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={insightData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {insightData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex justify-center gap-4 mt-4">
            {insightData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-slate-400">
                  {item.name}: {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Insights */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Recent AI Insights</h3>
          <button className="text-sm text-violet-400 hover:text-violet-300">
            View all →
          </button>
        </div>
        
        <div className="space-y-3">
          <InsightRow
            title="High CPU on Discord Bot"
            description="CPU usage consistently above 75% for the past 2 hours"
            severity="warning"
            service="Discord Bot"
            timestamp="10 minutes ago"
            autoFixable={true}
          />
          
          <InsightRow
            title="Memory Leak Detected"
            description="Memory usage growing linearly, potential leak in API"
            severity="critical"
            service="API Backend"
            timestamp="25 minutes ago"
            autoFixable={false}
          />
          
          <InsightRow
            title="SSL Certificate Expiring"
            description="Certificate expires in 15 days, renewal recommended"
            severity="suggestion"
            service="Website"
            timestamp="1 hour ago"
            autoFixable={true}
          />
          
          <InsightRow
            title="Cost Optimization"
            description="Switch to smaller instance could save 30% on costs"
            severity="suggestion"
            service="Token Vault"
            timestamp="2 hours ago"
            autoFixable={false}
          />
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ 
  title, 
  value, 
  change, 
  trend, 
  color 
}: { 
  title: string; 
  value: string | number; 
  change: string;
  trend: 'up' | 'down' | 'warning';
  color: 'violet' | 'yellow' | 'green' | 'cyan';
}) {
  const colors = {
    violet: 'from-violet-500 to-violet-600',
    yellow: 'from-yellow-500 to-yellow-600',
    green: 'from-green-500 to-green-600',
    cyan: 'from-cyan-500 to-cyan-600',
  };

  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          <p className={cn(
            "text-xs mt-2",
            trend === 'up' && "text-green-400",
            trend === 'down' && "text-red-400",
            trend === 'warning' && "text-yellow-400"
          )}>
            {change}
          </p>
        </div>
        <div className={cn(
          "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center",
          colors[color]
        )}>
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// Insight Row Component
function InsightRow({
  title,
  description,
  severity,
  service,
  timestamp,
  autoFixable,
}: {
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'suggestion' | 'info';
  service: string;
  timestamp: string;
  autoFixable: boolean;
}) {
  const severityColors = {
    critical: 'bg-red-400/20 text-red-400 border-red-400/30',
    warning: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30',
    suggestion: 'bg-blue-400/20 text-blue-400 border-blue-400/30',
    info: 'bg-slate-400/20 text-slate-400 border-slate-400/30',
  };

  return (
    <div className="flex items-start gap-4 p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
      <div className={cn(
        "w-2 h-2 rounded-full mt-2 flex-shrink-0",
        severity === 'critical' && "bg-red-400",
        severity === 'warning' && "bg-yellow-400",
        severity === 'suggestion' && "bg-blue-400",
        severity === 'info' && "bg-slate-400"
      )} />
      
      <div className="flex-1">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-medium text-white">{title}</h4>
            <p className="text-sm text-slate-400 mt-1">{description}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-slate-500">{service}</span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-500">{timestamp}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={cn(
              "px-2 py-1 rounded text-xs font-medium border capitalize",
              severityColors[severity]
            )}>
              {severity}
            </span>
            
            {autoFixable && (
              <button className="flex items-center gap-1 px-3 py-1.5 rounded bg-violet-500/20 text-violet-400 text-sm hover:bg-violet-500/30">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Fix
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
