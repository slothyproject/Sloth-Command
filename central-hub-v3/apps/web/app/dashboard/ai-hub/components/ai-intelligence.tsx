/**
 * AI Intelligence Component
 * Pattern recognition and anomaly detection
 */

import { useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { cn } from '@/app/lib/utils';
import type { Service } from '@central-hub/shared-types';

interface AIIntelligenceProps {
  services: Service[] | undefined;
}

export function AIIntelligence({ services }: AIIntelligenceProps) {
  // Mock correlation data
  const correlationData = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      website: 30 + Math.random() * 20,
      api: 45 + Math.random() * 25,
      bot: 60 + Math.random() * 30,
    }));
  }, []);

  const anomalies = [
    {
      id: '1',
      service: 'Discord Bot',
      type: 'CPU Spike',
      severity: 'critical',
      detected: '15 minutes ago',
      description: 'CPU usage jumped from 45% to 92% within 2 minutes',
      pattern: 'Sudden spike',
    },
    {
      id: '2',
      service: 'API Backend',
      type: 'Memory Growth',
      severity: 'warning',
      detected: '1 hour ago',
      description: 'Memory usage growing linearly by 5% per hour',
      pattern: 'Gradual increase',
    },
    {
      id: '3',
      service: 'Website',
      type: 'Traffic Pattern',
      severity: 'info',
      detected: '3 hours ago',
      description: 'Traffic 3x higher than usual for this time period',
      pattern: 'Unexpected spike',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Service Correlations */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Service Correlations</h3>
          <span className="text-sm text-slate-400">Last 24 hours</span>
        </div>
        
        <p className="text-sm text-slate-400 mb-4">
          AI detected 3 correlation patterns between your services. 
          API and Discord Bot show strong correlation (0.87).
        </p>
        
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={correlationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="hour" 
                stroke="#64748b" 
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={12}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                }}
                itemStyle={{ color: '#fff' }}
              />
              <Line 
                type="monotone" 
                dataKey="website" 
                stroke="#06b6d4" 
                strokeWidth={2}
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="api" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="bot" 
                stroke="#f59e0b" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className="flex justify-center gap-6 mt-4">
          <LegendItem color="#06b6d4" label="Website" />
          <LegendItem color="#8b5cf6" label="API Backend" />
          <LegendItem color="#f59e0b" label="Discord Bot" />
        </div>
      </div>

      {/* Detected Anomalies */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Detected Anomalies</h3>
          <button className="text-sm text-violet-400 hover:text-violet-300">
            Configure alerts →
          </button>
        </div>
        
        <div className="space-y-4">
          {anomalies.map((anomaly) => (
            <AnomalyCard key={anomaly.id} anomaly={anomaly} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Legend Item
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-sm text-slate-400">{label}</span>
    </div>
  );
}

// Anomaly Card
function AnomalyCard({ anomaly }: { anomaly: {
  service: string;
  type: string;
  severity: string;
  detected: string;
  description: string;
  pattern: string;
} }) {
  const severityColors = {
    critical: 'bg-red-400/20 text-red-400 border-red-400/30',
    warning: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30',
    info: 'bg-blue-400/20 text-blue-400 border-blue-400/30',
  };

  return (
    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="font-medium text-white">{anomaly.type}</h4>
            <span className={cn(
              "px-2 py-0.5 rounded text-xs font-medium border capitalize",
              severityColors[anomaly.severity as keyof typeof severityColors]
            )}>
              {anomaly.severity}
            </span>
          </div>
          
          <p className="text-sm text-slate-400 mb-2">{anomaly.description}</p>
          
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-500">Service: {anomaly.service}</span>
            <span className="text-slate-500">Pattern: {anomaly.pattern}</span>
            <span className="text-slate-500">{anomaly.detected}</span>
          </div>
        </div>
        
        <button className="ml-4 px-3 py-1.5 rounded bg-violet-500/20 text-violet-400 text-sm hover:bg-violet-500/30">
          Investigate
        </button>
      </div>
    </div>
  );
}
