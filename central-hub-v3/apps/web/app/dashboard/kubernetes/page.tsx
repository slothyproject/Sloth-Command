/**
 * Kubernetes Management Dashboard Page
 * Central Hub v4.0 - K8s Cluster Management
 */

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';
import type { K8sCluster, K8sWorkload } from '@/app/types';
import { cn } from '@/app/lib/utils';

export default function KubernetesDashboardPage() {
  const queryClient = useQueryClient();
  const [selectedCluster, setSelectedCluster] = useState<string>('');

  // Fetch clusters
  const { data: clusters, isLoading } = useQuery({
    queryKey: ['kubernetes', 'clusters'],
    queryFn: async () => {
      const response = await api.kubernetes.getClusters();
      return response.data as K8sCluster[];
    },
  });

  // Fetch workloads for selected cluster
  const { data: workloads } = useQuery({
    queryKey: ['kubernetes', 'workloads', selectedCluster],
    queryFn: async () => {
      if (!selectedCluster) return [];
      const response = await api.kubernetes.getWorkloads(selectedCluster);
      return response.data as K8sWorkload[];
    },
    enabled: !!selectedCluster,
  });

  // Sync cluster
  const syncMutation = useMutation({
    mutationFn: (id: string) => api.kubernetes.syncCluster(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kubernetes'] }),
  });

  if (isLoading) return <KubernetesDashboardSkeleton />;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Kubernetes Management</h1>
        <p className="text-slate-400 mt-1">Manage K8s clusters, deployments, and Helm charts</p>
      </div>

      {/* Cluster Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {clusters?.map((cluster) => (
          <div
            key={cluster.id}
            onClick={() => setSelectedCluster(cluster.id)}
            className={cn('glass-card p-5 cursor-pointer transition-all', {
              'ring-2 ring-cyan-500': selectedCluster === cluster.id,
            })}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">{cluster.name}</h3>
              <div className={cn('w-2 h-2 rounded-full', {
                'bg-green-400': cluster.health.status === 'healthy',
                'bg-yellow-400': cluster.health.status === 'warning',
                'bg-red-400': cluster.health.status === 'critical',
              })} />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Version</span>
                <span className="text-white">{cluster.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Nodes</span>
                <span className="text-white">{cluster.nodes.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Workloads</span>
                <span className="text-white">{cluster.workloads.length}</span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                syncMutation.mutate(cluster.id);
              }}
              disabled={syncMutation.isPending}
              className="mt-3 w-full btn-glass py-1.5 rounded text-sm disabled:opacity-50"
            >
              {syncMutation.isPending ? 'Syncing...' : '🔄 Sync'}
            </button>
          </div>
        ))}
      </div>

      {/* Workloads */}
      {selectedCluster && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Workloads</h3>
          {workloads && workloads.length > 0 ? (
            <div className="space-y-2">
              {workloads.map((workload) => (
                <div key={workload.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-2 h-2 rounded-full', {
                      'bg-green-400': workload.status === 'running',
                      'bg-yellow-400': workload.status === 'pending',
                      'bg-red-400': workload.status === 'failed',
                    })} />
                    <div>
                      <p className="font-medium text-white">{workload.name}</p>
                      <p className="text-xs text-slate-400">
                        {workload.namespace} • {workload.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-300">
                      {workload.replicas.ready}/{workload.replicas.desired} ready
                    </span>
                    <button className="btn-glass px-3 py-1.5 rounded text-sm">View Logs</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">Select a cluster to view workloads</p>
          )}
        </div>
      )}
    </div>
  );
}

function KubernetesDashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-48 bg-white/10 rounded animate-pulse" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-40 bg-white/5 rounded-lg animate-pulse" />)}
      </div>
    </div>
  );
}
