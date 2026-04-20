/**
 * Predictive Scaling Dashboard Page
 * Central Hub v4.0 - ML-Based Traffic Forecasting & Auto-Scaling
 */

'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';
import type { ScalingRecommendation, Forecast, ScalingEvent, MetricDataPoint } from '@/app/types';
import { cn } from '@/app/lib/utils';

export default function ScalingDashboardPage() {
  const [selectedService, setSelectedService] = useState<string>('');

  // Fetch scaling status
  const { data: status, isLoading } = useQuery({
    queryKey: ['scaling', 'status'],
    queryFn: async () => {
      const response = await api.scaling.getStatus();
      return response.data;
    },
  });

  // Fetch recommendations
  const { data: recommendations } = useQuery({
    queryKey: ['scaling', 'recommendations', selectedService],
    queryFn: async () => {
      if (!selectedService) return null;
      const response = await api.scaling.getRecommendation(selectedService);
      return response.data as ScalingRecommendation | null;
    },
    enabled: !!selectedService,
  });

  // Execute scaling mutation
  const scaleMutation = useMutation({
    mutationFn: ({ serviceId, replicas }: { serviceId: string; replicas: number }) =>
      api.scaling.executeScaling(serviceId, replicas),
  });

  if (isLoading) return <ScalingDashboardSkeleton />;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Predictive Scaling</h1>
          <p className="text-slate-400 mt-1">ML-based traffic forecasting and cost-optimized auto-scaling</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Events" value={status?.totalEvents || 0} icon="activity" />
        <StatCard title="Successful" value={status?.successful || 0} color="green" />
        <StatCard title="Failed" value={status?.failed || 0} color="red" />
        <StatCard title="Cost Savings" value={`$${(status?.costSavings || 0).toFixed(2)}`} color="cyan" />
      </div>

      {/* Recommendations */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Scaling Recommendations</h3>
        {recommendations ? (
          <div className={cn('p-4 rounded-lg border', {
            'bg-green-500/10 border-green-500/30': recommendations.recommendedCapacity.scalingAction === 'scale_up',
            'bg-yellow-500/10 border-yellow-500/30': recommendations.recommendedCapacity.scalingAction === 'scale_down',
            'bg-slate-500/10 border-slate-500/30': recommendations.recommendedCapacity.scalingAction === 'maintain',
          })}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-medium text-white">{recommendations.recommendedCapacity.reason}</p>
                <p className="text-sm text-slate-400">
                  Confidence: {(recommendations.confidence * 100).toFixed(0)}% • Risk: {recommendations.risk}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Current</p>
                <p className="text-lg font-bold text-white">{recommendations.currentCapacity.replicas} replicas</p>
              </div>
            </div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-slate-400">Recommended</p>
                <p className="text-2xl font-bold text-cyan-400">
                  {recommendations.recommendedCapacity.replicas} replicas
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Cost Impact</p>
                <p className={cn('font-medium', recommendations.costImpact.delta > 0 ? 'text-red-400' : 'text-green-400')}>
                  {recommendations.costImpact.delta > 0 ? '+' : ''}{recommendations.costImpact.delta.toFixed(2)}/hr
                </p>
              </div>
            </div>
            {recommendations.recommendedCapacity.scalingAction !== 'maintain' && (
              <button
                onClick={() => scaleMutation.mutate({
                  serviceId: selectedService,
                  replicas: recommendations.recommendedCapacity.replicas,
                })}
                disabled={scaleMutation.isPending}
                className="btn-primary w-full py-2 rounded-lg disabled:opacity-50"
              >
                {scaleMutation.isPending ? 'Scaling...' : `Execute ${recommendations.recommendedCapacity.scalingAction}`}
              </button>
            )}
          </div>
        ) : (
          <EmptyState message="Select a service to view scaling recommendations" />
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, color = 'default', icon }: { title: string; value: string | number; color?: string; icon?: string }) {
  const colors: Record<string, string> = {
    default: 'from-slate-500/20 to-slate-600/20',
    green: 'from-green-500/20 to-green-600/20',
    red: 'from-red-500/20 to-red-600/20',
    cyan: 'from-cyan-500/20 to-cyan-600/20',
  };

  return (
    <div className={cn('glass-card p-5 bg-gradient-to-br', colors[color])}>
      <p className="text-sm text-slate-400">{title}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-8">
      <p className="text-slate-400">{message}</p>
    </div>
  );
}

function ScalingDashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-48 bg-white/10 rounded animate-pulse" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-white/5 rounded-lg animate-pulse" />)}
      </div>
    </div>
  );
}
