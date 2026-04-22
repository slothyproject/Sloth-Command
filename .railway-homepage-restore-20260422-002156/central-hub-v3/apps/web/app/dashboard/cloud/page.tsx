/**
 * Multi-Cloud Management Dashboard Page
 * Central Hub v4.0 - AWS/GCP/Azure Management
 */

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';
import type { CloudConnection, CloudResource, CloudProvider } from '@/app/types';
import { cn } from '@/app/lib/utils';

export default function CloudDashboardPage() {
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | 'all'>('all');

  // Fetch cloud status
  const { data: status, isLoading } = useQuery({
    queryKey: ['cloud', 'status'],
    queryFn: async () => {
      const response = await api.cloud.getStatus();
      return response.data;
    },
  });

  // Fetch connections
  const { data: connections } = useQuery({
    queryKey: ['cloud', 'connections'],
    queryFn: async () => {
      const response = await api.cloud.getConnections();
      return response.data as CloudConnection[];
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: (id: string) => api.cloud.syncResources(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cloud'] }),
  });

  if (isLoading) return <CloudDashboardSkeleton />;

  const providers = [
    { id: 'aws', name: 'AWS', color: 'from-orange-500/20 to-orange-600/20' },
    { id: 'gcp', name: 'GCP', color: 'from-blue-500/20 to-blue-600/20' },
    { id: 'azure', name: 'Azure', color: 'from-cyan-500/20 to-cyan-600/20' },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Multi-Cloud Management</h1>
        <p className="text-slate-400 mt-1">Manage AWS, GCP, and Azure resources from a single dashboard</p>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {providers.map((provider) => {
          const connection = connections?.find((c) => c.provider === provider.id);
          const isConnected = connection?.status === 'connected';

          return (
            <div
              key={provider.id}
              className={cn('glass-card p-5 bg-gradient-to-br', provider.color, {
                'opacity-50': !isConnected,
              })}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{provider.name}</h3>
                <div className={cn('w-3 h-3 rounded-full', isConnected ? 'bg-green-400' : 'bg-red-400')} />
              </div>
              <p className="text-sm text-slate-300 mb-4">
                {isConnected ? `Connected: ${connection.metadata.regions.length} regions` : 'Not connected'}
              </p>
              {connection && (
                <button
                  onClick={() => syncMutation.mutate(connection.id)}
                  disabled={syncMutation.isPending}
                  className="btn-glass w-full py-2 rounded-lg text-sm disabled:opacity-50"
                >
                  {syncMutation.isPending ? 'Syncing...' : '🔄 Sync Resources'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Cost Overview */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Cost Overview</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-white">${(status?.costSummary?.monthly || 0).toFixed(2)}</p>
            <p className="text-sm text-slate-400">Monthly Spend</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-cyan-400">{status?.totalResources || 0}</p>
            <p className="text-sm text-slate-400">Resources</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-violet-400">{status?.connections?.length || 0}</p>
            <p className="text-sm text-slate-400">Connections</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CloudDashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-48 bg-white/10 rounded animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-white/5 rounded-lg animate-pulse" />)}
      </div>
    </div>
  );
}
