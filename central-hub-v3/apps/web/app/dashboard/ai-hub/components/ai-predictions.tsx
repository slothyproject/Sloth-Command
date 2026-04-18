/**
 * AI Predictions Component
 * Predictive analytics and forecasting
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
  ReferenceLine,
  ComposedChart,
  Bar,
} from 'recharts';
import { cn } from '@/app/lib/utils';
import type { Service } from '@central-hub/shared-types';

interface AIPredictionsProps {
  services: Service[] | undefined;
}

export function AIPredictions({ services }: AIPredictionsProps) {
  // Mock prediction data
  const cpuPredictionData = useMemo(() => {
    const data = [];
    const baseCpu = 45;
    const now = new Date();

    for (let i = -12; i <= 12; i++) {
      const date = new Date(now);
      date.setHours(date.getHours() + i);

      const isPrediction = i > 0;
      const trend = isPrediction ? i * 2.5 : Math.sin(i * 0.5) * 10;
      const noise = Math.random() * 5;
      const value = baseCpu + trend + noise;

      data.push({
        time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        value: Math.min(100, Math.max(0, value)),
        isPrediction,
      });
    }
    return data;
  }, []);

  const costPredictionData = [
    { month: 'Jan', actual: 220, predicted: null },
    { month: 'Feb', actual: 235, predicted: null },
    { month: 'Mar', actual: 245, predicted: null },
    { month: 'Apr', actual: 260, predicted: 275 },
    { month: 'May', actual: null, predicted: 285 },
    { month: 'Jun', actual: null, predicted: 295 },
  ];

  const predictions = [
    {
      id: '1',
      metric: 'CPU Usage',
      service: 'Discord Bot',
      currentValue: '78%',
      predictedValue: '95%',
      trend: 'increasing',
      confidence: 87,
      timeframe: 'Next 24 hours',
      recommendation: 'Scale up instance size',
    },
    {
      id: '2',
      metric: 'Memory Usage',
      service: 'API Backend',
      currentValue: '65%',
      predictedValue: '88%',
      trend: 'increasing',
      confidence: 82,
      timeframe: 'Next 12 hours',
      recommendation: 'Enable memory optimization',
    },
    {
      id: '3',
      metric: 'Cost',
      service: 'All Services',
      currentValue: '$245',
      predictedValue: '$295',
      trend: 'increasing',
      confidence: 91,
      timeframe: 'Next month',
      recommendation: 'Optimize resource allocation',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Prediction Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {predictions.map((prediction) => (
          <PredictionCard key={prediction.id} prediction={prediction} />
        ))}
      </div>

      {/* CPU Prediction Chart */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-white">CPU Usage Forecast</h3>
            <p className="text-sm text-slate-400">
              Based on historical patterns, CPU usage is predicted to increase
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <LegendItem color="#06b6d4" label="Historical" />
            <LegendItem color="#8b5cf6" label="Predicted" />
          </div>
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={cpuPredictionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                domain={[0, 100]}
                unit="%"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                }}
                itemStyle={{ color: '#fff' }}
              />
              <ReferenceLine
                x={cpuPredictionData[12]?.time}
                stroke="#f59e0b"
                strokeDasharray="3 3"
                label="Now"
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cost Prediction Chart */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-white">Monthly Cost Projection</h3>
            <p className="text-sm text-slate-400">Estimated costs for the next 3 months</p>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={costPredictionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} />
              <YAxis
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                prefix="$"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                }}
                formatter={(value) => [`$${value}`, 'Cost']}
              />
              <Bar dataKey="actual" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#8b5cf6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#8b5cf6', strokeWidth: 0, r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// Prediction Card
function PredictionCard({
  prediction,
}: {
  prediction: {
    metric: string;
    service: string;
    currentValue: string;
    predictedValue: string;
    trend: 'increasing' | 'decreasing';
    confidence: number;
    timeframe: string;
    recommendation: string;
  };
}) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm text-slate-400">{prediction.metric}</p>
          <p className="text-sm text-slate-500">{prediction.service}</p>
        </div>
        <div
          className={cn(
            'px-2 py-1 rounded text-xs font-medium',
            prediction.trend === 'increasing'
              ? 'bg-yellow-400/20 text-yellow-400'
              : 'bg-green-400/20 text-green-400'
          )}
        >
          {prediction.trend === 'increasing' ? '↑' : '↓'} {prediction.trend}
        </div>
      </div>

      <div className="flex items-end gap-2 mb-3">
        <span className="text-2xl font-bold text-white">{prediction.predictedValue}</span>
        <span className="text-sm text-slate-400 line-through">{prediction.currentValue}</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-cyan-500"
              style={{ width: `${prediction.confidence}%` }}
            />
          </div>
          <span className="text-xs text-slate-400">{prediction.confidence}% confidence</span>
        </div>

        <p className="text-xs text-slate-500">{prediction.timeframe}</p>

        <p className="text-sm text-violet-400">{prediction.recommendation}</p>
      </div>
    </div>
  );
}

// Legend Item
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-slate-400">{label}</span>
    </div>
  );
}
