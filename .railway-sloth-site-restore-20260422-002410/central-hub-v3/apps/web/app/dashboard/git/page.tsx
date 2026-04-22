/**
 * Git Integration Page
 * Connect repositories, manage webhooks, configure auto-deployment
 */

'use client';

import React, { useState } from 'react';
import { useRepositories, useConnectRepository, useDisconnectRepository, useUpdateWebhook, useRepositoryBranches, useTestWebhook, type Repository } from '@/app/hooks/use-git';
import { useServices } from '@/app/hooks/use-services';
import { StatusBadge } from '@/app/components/ui';
import { useToast } from '@/app/components/providers/toast-provider';
import { cn, formatTimeAgo } from '@/app/lib/utils';

interface WebhookConfig {
  id: string;
  branch: string;
  targetEnvironment: 'production' | 'staging' | 'development';
  autoDeploy: boolean;
  requireApproval: boolean;
  runTests: boolean;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
}

export default function GitIntegrationPage() {
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [selectedService, setSelectedService] = useState<string>('');
  const [provider, setProvider] = useState<'github' | 'gitlab' | 'bitbucket'>('github');
  
  const { toast } = useToast();
  const { data: repositories, isLoading } = useRepositories();
  const { data: services } = useServices();
  const connectRepo = useConnectRepository();
  const disconnectRepo = useDisconnectRepository();
  const updateWebhook = useUpdateWebhook();
  const testWebhook = useTestWebhook();
  
  const handleConnect = async (repoUrl: string, serviceId: string) => {
    try {
      await connectRepo.mutateAsync({
        url: repoUrl,
        provider,
        serviceId,
      });
      
      toast.success('Repository connected!', 'Webhook configured for auto-deployment');
      setShowConnectModal(false);
    } catch (error) {
      toast.error('Connection failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };
  
  const handleDisconnect = async (repoId: string) => {
    if (!confirm('Disconnect this repository? Auto-deployment will stop.')) return;
    
    try {
      await disconnectRepo.mutateAsync(repoId);
      toast.success('Repository disconnected');
    } catch (error) {
      toast.error('Disconnect failed');
    }
  };
  
  const handleTestWebhook = async (repoId: string) => {
    try {
      await testWebhook.mutateAsync(repoId);
      toast.success('Webhook test sent', 'Check deployment logs for results');
    } catch (error) {
      toast.error('Test failed');
    }
  };
  
  const handleUpdateWebhook = async (repoId: string, config: WebhookConfig) => {
    try {
      await updateWebhook.mutateAsync({ repoId, config });
      toast.success('Webhook updated');
      setShowWebhookModal(false);
    } catch (error) {
      toast.error('Update failed');
    }
  };
  
  if (isLoading) {
    return <GitIntegrationSkeleton />;
  }
  
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </span>
            Git Integration
          </h1>
          <p className="text-slate-400 mt-1">
            Connect repositories and configure auto-deployment pipelines
          </p>
        </div>
        
        <button
          onClick={() => setShowConnectModal(true)}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium hover:opacity-90 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Connect Repository
        </button>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Connected Repos"
          value={repositories?.length || 0}
          icon="repo"
          color="cyan"
        />
        <StatCard
          title="Auto-Deploy Active"
          value={repositories?.filter((r: Repository) => r.webhook?.autoDeploy).length || 0}
          icon="deploy"
          color="green"
        />
        <StatCard
          title="Pending Approval"
          value={repositories?.filter((r: Repository) => r.webhook?.requireApproval).length || 0}
          icon="approval"
          color="yellow"
        />
        <StatCard
          title="Failed Webhooks"
          value={repositories?.filter((r: Repository) => r.lastWebhookStatus === 'failed').length || 0}
          icon="error"
          color="red"
        />
      </div>
      
      {/* Repositories List */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Connected Repositories</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">
              {repositories?.length || 0} repositories
            </span>
          </div>
        </div>
        
        <div className="divide-y divide-white/5">
          {repositories?.map((repo: Repository) => (
            <RepositoryRow
              key={repo.id}
              repo={repo}
              onConfigure={() => {
                setSelectedRepo(repo);
                setShowWebhookModal(true);
              }}
              onTest={() => handleTestWebhook(repo.id)}
              onDisconnect={() => handleDisconnect(repo.id)}
            />
          ))}
          
          {(!repositories || repositories.length === 0) && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No repositories connected</h3>
              <p className="text-slate-400 mb-4">
                Connect your GitHub, GitLab, or Bitbucket repositories to enable auto-deployment
              </p>
              <button
                onClick={() => setShowConnectModal(true)}
                className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
              >
                Connect Your First Repo
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Git Workflow Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <WorkflowCard
          title="Push to Main"
          description="Code pushed to main branch automatically triggers production deployment"
          icon="main"
          color="green"
        />
        <WorkflowCard
          title="Staging Branch"
          description="Use staging branch for testing before production deployment"
          icon="staging"
          color="yellow"
        />
        <WorkflowCard
          title="Pull Requests"
          description="Create preview deployments for pull request testing"
          icon="pr"
          color="cyan"
        />
      </div>
      
      {/* Connect Modal */}
      {showConnectModal && (
        <ConnectRepositoryModal
          services={services || []}
          onConnect={handleConnect}
          onClose={() => setShowConnectModal(false)}
          isConnecting={connectRepo.isPending}
          provider={provider}
          setProvider={setProvider}
        />
      )}
      
      {/* Webhook Config Modal */}
      {showWebhookModal && selectedRepo && (
        <WebhookConfigModal
          repo={selectedRepo}
          onSave={(config) => handleUpdateWebhook(selectedRepo.id, config)}
          onClose={() => {
            setShowWebhookModal(false);
            setSelectedRepo(null);
          }}
          isSaving={updateWebhook.isPending}
        />
      )}
    </div>
  );
}

// Sub-components
function StatCard({ title, value, icon, color }: { title: string; value: number; icon: string; color: string }) {
  const colors: Record<string, string> = {
    cyan: 'from-cyan-500/20 to-cyan-600/20 text-cyan-400',
    green: 'from-green-500/20 to-green-600/20 text-green-400',
    yellow: 'from-yellow-500/20 to-yellow-600/20 text-yellow-400',
    red: 'from-red-500/20 to-red-600/20 text-red-400',
  };
  
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-400">{title}</span>
        <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center", colors[color])}>
          <Icon name={icon} className="w-4 h-4" />
        </div>
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
    </div>
  );
}

function RepositoryRow({ repo, onConfigure, onTest, onDisconnect }: {
  repo: Repository;
  onConfigure: () => void;
  onTest: () => void;
  onDisconnect: () => void;
}) {
  const statusColors: Record<string, string> = {
    active: 'text-green-400 bg-green-500/20',
    inactive: 'text-slate-400 bg-slate-500/20',
    error: 'text-red-400 bg-red-500/20',
  };
  
  return (
    <div className="px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
          <ProviderIcon provider={repo.provider} className="w-5 h-5" />
        </div>
        
        <div>
          <h4 className="font-medium text-white">{repo.name}</h4>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">{repo.owner}/{repo.name}</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">{repo.defaultBranch}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        {/* Webhook Status */}
        <div className="text-right">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("px-2 py-0.5 rounded text-xs font-medium", statusColors[repo.webhookStatus || 'inactive'])}>
              {repo.webhook?.autoDeploy ? 'Auto-Deploy' : 'Manual'}
            </span>
            {repo.webhook?.requireApproval && (
              <span className="px-2 py-0.5 rounded text-xs font-medium text-yellow-400 bg-yellow-500/20">
                Needs Approval
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500">
            {repo.lastWebhookAt ? `Last push: ${formatTimeAgo(repo.lastWebhookAt)}` : 'No pushes yet'}
          </span>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={onConfigure}
            className="p-2 rounded hover:bg-white/10 text-slate-400 hover:text-white"
            title="Configure Webhook"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          
          <button
            onClick={onTest}
            className="p-2 rounded hover:bg-white/10 text-cyan-400 hover:text-cyan-300"
            title="Test Webhook"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          
          <button
            onClick={onDisconnect}
            className="p-2 rounded hover:bg-white/10 text-red-400 hover:text-red-300"
            title="Disconnect"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkflowCard({ title, description, icon, color }: { title: string; description: string; icon: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'from-green-500/20 to-green-600/20',
    yellow: 'from-yellow-500/20 to-yellow-600/20',
    cyan: 'from-cyan-500/20 to-cyan-600/20',
  };
  
  return (
    <div className="glass-card p-6">
      <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4", colors[color])}>
        <Icon name={icon} className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm">{description}</p>
    </div>
  );
}

function ConnectRepositoryModal({ services, onConnect, onClose, isConnecting, provider, setProvider }: {
  services: any[];
  onConnect: (url: string, serviceId: string) => void;
  onClose: () => void;
  isConnecting: boolean;
  provider: 'github' | 'gitlab' | 'bitbucket';
  setProvider: (p: 'github' | 'gitlab' | 'bitbucket') => void;
}) {
  const [repoUrl, setRepoUrl] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [token, setToken] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect(repoUrl, serviceId);
  };
  
  const providerUrls: Record<string, string> = {
    github: 'https://github.com/',
    gitlab: 'https://gitlab.com/',
    bitbucket: 'https://bitbucket.org/',
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative glass-card max-w-lg w-full p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Connect Repository</h3>
        
        {/* Provider Selection */}
        <div className="mb-6">
          <label className="block text-sm text-slate-400 mb-2">Git Provider</label>
          <div className="grid grid-cols-3 gap-2">
            {(['github', 'gitlab', 'bitbucket'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                className={cn(
                  "p-3 rounded-lg border text-sm font-medium capitalize transition-colors",
                  provider === p
                    ? "border-cyan-500 bg-cyan-500/20 text-cyan-400"
                    : "border-white/10 text-slate-400 hover:bg-white/5"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        
        {/* Repository URL */}
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-1">Repository URL *</label>
          <input
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder={`${providerUrls[provider]}username/repo-name`}
            className="w-full px-4 py-2 rounded-lg bg-slate-900/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            required
          />
        </div>
        
        {/* Service Selection */}
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-1">Deploy to Service *</label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-slate-900/50 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
            required
          >
            <option value="">Select a service...</option>
            {services.map((service: any) => (
              <option key={service.id} value={service.id}>{service.name}</option>
            ))}
          </select>
        </div>
        
        {/* Access Token */}
        <div className="mb-6">
          <label className="block text-sm text-slate-400 mb-1">
            Access Token (for private repos)
            <span className="text-slate-600 ml-1">- Optional</span>
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={`${provider} personal access token`}
            className="w-full px-4 py-2 rounded-lg bg-slate-900/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
          <p className="text-xs text-slate-500 mt-1">
            Token will be encrypted and stored securely
          </p>
        </div>
        
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isConnecting}
            className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isConnecting || !repoUrl || !serviceId}
            className="px-6 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isConnecting ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Connecting...
              </>
            ) : (
              'Connect Repository'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function WebhookConfigModal({ repo, onSave, onClose, isSaving }: {
  repo: Repository;
  onSave: (config: any) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const [config, setConfig] = useState({
    branch: repo.webhook?.branch || repo.defaultBranch || 'main',
    targetEnvironment: repo.webhook?.targetEnvironment || 'production',
    autoDeploy: repo.webhook?.autoDeploy ?? true,
    requireApproval: repo.webhook?.requireApproval || false,
    runTests: repo.webhook?.runTests ?? true,
    notifyOnSuccess: repo.webhook?.notifyOnSuccess ?? true,
    notifyOnFailure: repo.webhook?.notifyOnFailure ?? true,
  });
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-semibold text-white mb-1">Webhook Configuration</h3>
        <p className="text-slate-400 text-sm mb-6">{repo.owner}/{repo.name}</p>
        
        <div className="space-y-4 mb-6">
          {/* Branch */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Branch to Deploy</label>
            <input
              type="text"
              value={config.branch}
              onChange={(e) => setConfig({ ...config, branch: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-slate-900/50 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          
          {/* Target Environment */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Target Environment</label>
            <select
              value={config.targetEnvironment}
              onChange={(e) => setConfig({ ...config, targetEnvironment: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-slate-900/50 border border-white/10 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </div>
          
          {/* Toggles */}
          <div className="space-y-3 pt-4 border-t border-white/10">
            <ToggleRow
              label="Auto-Deploy"
              description="Automatically deploy when code is pushed"
              checked={config.autoDeploy}
              onChange={(checked) => setConfig({ ...config, autoDeploy: checked })}
            />
            
            <ToggleRow
              label="Require Approval"
              description="Wait for manual approval before deploying"
              checked={config.requireApproval}
              onChange={(checked) => setConfig({ ...config, requireApproval: checked })}
            />
            
            <ToggleRow
              label="Run Tests"
              description="Execute test suite before deployment"
              checked={config.runTests}
              onChange={(checked) => setConfig({ ...config, runTests: checked })}
            />
            
            <ToggleRow
              label="Notify on Success"
              description="Send notification when deployment succeeds"
              checked={config.notifyOnSuccess}
              onChange={(checked) => setConfig({ ...config, notifyOnSuccess: checked })}
            />
            
            <ToggleRow
              label="Notify on Failure"
              description="Send notification when deployment fails"
              checked={config.notifyOnFailure}
              onChange={(checked) => setConfig({ ...config, notifyOnFailure: checked })}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(config)}
            disabled={isSaving}
            className="px-6 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 font-medium transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="font-medium text-white">{label}</div>
        <div className="text-sm text-slate-400">{description}</div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-12 h-6 rounded-full transition-colors",
          checked ? "bg-cyan-500" : "bg-slate-600"
        )}
      >
        <span className={cn(
          "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform",
          checked && "translate-x-6"
        )} />
      </button>
    </div>
  );
}

function ProviderIcon({ provider, className }: { provider: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    github: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
    ),
    gitlab: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.653 14.297l-1.28-3.935c-.053-.162-.19-.27-.35-.27-.16 0-.297.108-.35.27l-1.28 3.935c-.026.08-.026.162 0 .242l1.63 5.026c.052.162.19.27.35.27h5.21c.16 0 .298-.108.35-.27l1.63-5.026c.026-.08.026-.162 0-.242zM8.043 14.297l-1.28-3.935c-.053-.162-.19-.27-.35-.27-.16 0-.297.108-.35.27l-1.28 3.935c-.026.08-.026.162 0 .242l1.63 5.026c.052.162.19.27.35.27h5.21c.16 0 .298-.108.35-.27l1.63-5.026c.026-.08.026-.162 0-.242l-1.28-3.935c-.053-.162-.19-.27-.35-.27-.16 0-.297.108-.35.27z"/>
      </svg>
    ),
    bitbucket: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M.778 2.522A.778.778 0 000 3.3v14.9c0 .43.348.778.778.778h19.444c.43 0 .778-.348.778-.778V3.3a.778.778 0 00-.778-.778H.778zm3.35 3.89h12.744l-.878 5.378H4.992l-.863-5.378z"/>
      </svg>
    ),
  };
  
  return icons[provider] || null;
}

function Icon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    repo: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
    deploy: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
    approval: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    error: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    main: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
    staging: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    pr: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>,
  };
  
  return icons[name] || null;
}

function GitIntegrationSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-12 bg-slate-800 rounded animate-pulse" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-800 rounded animate-pulse" />
        ))}
      </div>
      <div className="h-96 bg-slate-800 rounded animate-pulse" />
    </div>
  );
}
