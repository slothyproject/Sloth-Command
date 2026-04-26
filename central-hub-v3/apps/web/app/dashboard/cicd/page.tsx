/**
 * CI/CD Pipeline Management Dashboard Page
 * Central Hub v4.0 - GitHub Actions & GitLab CI
 */

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';
import type { Pipeline, PipelineRun } from '@/app/types';
import { cn } from '@/app/lib/utils';

export default function CICDDashboardPage() {
  const queryClient = useQueryClient();
  const [selectedPipeline, setSelectedPipeline] = useState<string>('');

  // Fetch pipelines
  const { data: pipelines, isLoading } = useQuery({
    queryKey: ['cicd', 'pipelines'],
    queryFn: async () => {
      const response = await api.pipeline.list();
      return (response.data.data ?? response.data ?? []) as Pipeline[];
    },
  });

  // Trigger pipeline
  const triggerMutation = useMutation({
    mutationFn: (id: string) =>
      api.cicd.trigger(id, { type: 'manual', actor: 'user', branch: 'main' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cicd'] }),
  });

  if (isLoading) return <CICDDashboardSkeleton />;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">CI/CD Pipelines</h1>
        <p className="text-slate-400 mt-1">Manage GitHub Actions & GitLab CI pipelines</p>
      </div>

      {/* Pipelines List */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Pipelines</h3>
        {pipelines && pipelines.length > 0 ? (
          <div className="space-y-3">
            {pipelines.map((pipeline) => (
              <div
                key={pipeline.id}
                onClick={() => setSelectedPipeline(pipeline.id)}
                className={cn('p-4 rounded-lg cursor-pointer transition-all', {
                  'bg-cyan-500/20 border border-cyan-500/30': selectedPipeline === pipeline.id,
                  'bg-white/5 hover:bg-white/10': selectedPipeline !== pipeline.id,
                })}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{pipeline.name}</p>
                    <p className="text-sm text-slate-400">{pipeline.provider.replace('_', ' ')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn('px-2 py-1 rounded text-xs', {
                      'bg-green-500/20 text-green-400': pipeline.enabled,
                      'bg-red-500/20 text-red-400': !pipeline.enabled,
                    })}>
                      {pipeline.enabled ? 'Active' : 'Disabled'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerMutation.mutate(pipeline.id);
                      }}
                      disabled={triggerMutation.isPending}
                      className="btn-primary px-3 py-1.5 rounded text-sm disabled:opacity-50"
                    >
                      ▶ Run
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-center py-8">No pipelines configured</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, color = 'default' }: { title: string; value: string | number; color?: string }) {
  const colors: Record<string, string> = {
    default: 'from-slate-500/20 to-slate-600/20',
    green: 'from-green-500/20 to-green-600/20',
    cyan: 'from-cyan-500/20 to-cyan-600/20',
  };

  return (
    <div className={cn('glass-card p-5 bg-gradient-to-br', colors[color])}>
      <p className="text-sm text-slate-400">{title}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function CICDDashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-48 bg-white/10 rounded animate-pulse" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-white/5 rounded-lg animate-pulse" />)}
      </div>
    </div>
  );
}
