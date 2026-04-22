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

  // Fetch status
  const { data: status, isLoading } = useQuery({
    queryKey: ['cicd', 'status'],
    queryFn: async () => {
      const response = await api.cicd.getStatus();
      return response.data;
    },
  });

  // Fetch pipelines
  const { data: pipelines } = useQuery({
    queryKey: ['cicd', 'pipelines'],
    queryFn: async () => {
      const response = await api.cicd.getPipelines();
      return response.data as Pipeline[];
    },
  });

  // Fetch runs for selected pipeline
  const { data: runs } = useQuery({
    queryKey: ['cicd', 'runs', selectedPipeline],
    queryFn: async () => {
      if (!selectedPipeline) return [];
      const response = await api.cicd.getPipelineRuns(selectedPipeline, 10);
      return response.data as PipelineRun[];
    },
    enabled: !!selectedPipeline,
  });

  // Trigger pipeline
  const triggerMutation = useMutation({
    mutationFn: (id: string) =>
      api.cicd.triggerPipeline(id, { type: 'manual', actor: 'user', branch: 'main' }),
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

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Pipelines" value={status?.totalPipelines || 0} />
        <StatCard title="Success Rate" value={`${(status?.successRate || 0).toFixed(0)}%`} color="green" />
        <StatCard title="Active Runs" value={status?.activeRuns || 0} color="cyan" />
        <StatCard title="Avg Duration" value={`${Math.round(status?.avgDuration || 0)}s`} />
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

      {/* Recent Runs */}
      {selectedPipeline && runs && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Runs</h3>
          <div className="space-y-2">
            {runs.map((run) => (
              <div key={run.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <div className="flex items-center gap-3">
                  <div className={cn('w-2 h-2 rounded-full', {
                    'bg-green-400': run.status === 'success',
                    'bg-red-400': run.status === 'failed',
                    'bg-blue-400 animate-pulse': run.status === 'running',
                    'bg-yellow-400': run.status === 'pending',
                  })} />
                  <div>
                    <p className="font-medium text-white">Run #{run.runNumber}</p>
                    <p className="text-xs text-slate-400">{run.trigger.branch} • {new Date(run.startedAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {run.testResults && (
                    <span className="text-sm text-slate-300">
                      ✅ {run.testResults.passed}/{run.testResults.total} tests
                    </span>
                  )}
                  <span className="text-sm text-slate-400">{run.duration ? `${Math.round(run.duration / 1000)}s` : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
