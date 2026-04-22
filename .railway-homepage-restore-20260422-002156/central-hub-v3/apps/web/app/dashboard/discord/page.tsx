/**
 * Discord Advanced Dashboard Page
 * Central Hub v4.0 - AI Moderation, Analytics & Commerce
 */

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';
import type { GuildAnalytics, Product } from '@/app/types';
import { cn } from '@/app/lib/utils';

export default function DiscordDashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'moderation' | 'analytics' | 'commerce'>('overview');

  // Fetch status
  const { data: status, isLoading } = useQuery({
    queryKey: ['discord', 'status'],
    queryFn: async () => {
      const response = await api.discordAdvanced.getStatus();
      return response.data;
    },
  });

  // Fetch guild analytics (mock guild ID)
  const { data: analytics } = useQuery({
    queryKey: ['discord', 'analytics'],
    queryFn: async () => {
      const response = await api.discordAdvanced.getGuildAnalytics('guild-123', 7);
      return response.data as GuildAnalytics;
    },
  });

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ['discord', 'products'],
    queryFn: async () => {
      const response = await api.discordAdvanced.getProducts('guild-123');
      return response.data as Product[];
    },
  });

  if (isLoading) return <DiscordDashboardSkeleton />;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Discord Advanced</h1>
        <p className="text-slate-400 mt-1">AI moderation, analytics, and commerce management</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10">
        {(['overview', 'moderation', 'analytics', 'commerce'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-3 text-sm font-medium capitalize transition-colors relative',
              activeTab === tab ? 'text-cyan-400' : 'text-slate-400 hover:text-white'
            )}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 to-violet-500" />
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="AI Moderation"
            value={status?.moderation.enabled ? 'Active' : 'Disabled'}
            color={status?.moderation.enabled ? 'green' : 'red'}
            subtitle={`${status?.moderation.rules || 0} rules • ${status?.moderation.logs || 0} logs`}
          />
          <StatCard
            title="Analytics Tracking"
            value={status?.analytics.enabled ? 'Enabled' : 'Disabled'}
            color={status?.analytics.enabled ? 'cyan' : 'slate'}
            subtitle={status?.analytics.tracking ? 'Real-time' : 'Paused'}
          />
          <StatCard
            title="Shop Products"
            value={status?.commerce.products || 0}
            color="violet"
            subtitle={`${status?.commerce.orders || 0} orders`}
          />
          <StatCard
            title="Auto-Responder"
            value={status?.autoResponder.enabled ? 'Active' : 'Disabled'}
            color={status?.autoResponder.enabled ? 'cyan' : 'slate'}
          />
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Members</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Total</span>
                <span className="text-white font-medium">{analytics.members.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Active</span>
                <span className="text-cyan-400 font-medium">{analytics.members.active}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">New (7d)</span>
                <span className="text-green-400 font-medium">+{analytics.members.new}</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Messages</h3>
            <div className="text-center">
              <p className="text-4xl font-bold text-white">{analytics.messages.total.toLocaleString()}</p>
              <p className="text-sm text-slate-400">messages (7 days)</p>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Top Users</h3>
            <div className="space-y-2">
              {analytics.engagement.topUsers.slice(0, 5).map((user, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-white">{user.username}</span>
                  <span className="text-cyan-400">{user.messages} msgs</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Commerce Tab */}
      {activeTab === 'commerce' && products && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Shop Products</h3>
          {products.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => (
                <div key={product.id} className="p-4 rounded-lg bg-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-white">{product.name}</h4>
                    <span className={cn('px-2 py-0.5 rounded text-xs', product.enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
                      {product.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-400 font-medium">
                      {product.price} {product.currency}
                    </span>
                    <span className="text-sm text-slate-400">
                      Stock: {product.stock}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">No products configured</p>
          )}
        </div>
      )}

      {/* Moderation Tab */}
      {activeTab === 'moderation' && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">AI Moderation Status</h3>
          <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-cyan-400 font-medium">AI Moderation Active</span>
            </div>
            <p className="text-slate-300">
              Automatically analyzing messages for spam, harassment, hate speech, and other violations.
              {status?.moderation.aiPowered && ' Powered by advanced AI models.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, color = 'default', subtitle }: { title: string; value: string | number; color?: string; subtitle?: string }) {
  const colors: Record<string, string> = {
    default: 'from-slate-500/20 to-slate-600/20',
    green: 'from-green-500/20 to-green-600/20',
    red: 'from-red-500/20 to-red-600/20',
    cyan: 'from-cyan-500/20 to-cyan-600/20',
    violet: 'from-violet-500/20 to-violet-600/20',
    slate: 'from-slate-600/20 to-slate-700/20',
  };

  return (
    <div className={cn('glass-card p-5 bg-gradient-to-br', colors[color])}>
      <p className="text-sm text-slate-400">{title}</p>
      <p className="text-xl font-bold text-white mt-1">{value}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-2">{subtitle}</p>}
    </div>
  );
}

function DiscordDashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-48 bg-white/10 rounded animate-pulse" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-white/5 rounded-lg animate-pulse" />)}
      </div>
    </div>
  );
}
