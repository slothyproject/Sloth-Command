/**
 * Mission Control Dashboard
 * Central command center for all automation and monitoring
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useServices, useDeployService, useRestartService, useSyncServices } from '@/app/hooks/use-services';
import { useHealingStatus, useHealingIssues } from '@/app/hooks/use-healing';
import { useAutomationStatus, useAutomationActions, useSystemHealth } from '@/app/hooks/use-automation';
import { useSecrets } from '@/app/hooks/use-secrets';
import { StatusBadge } from '@/app/components/ui';
import { cn, formatTimeAgo } from '@/app/lib/utils';
import Link from 'next/link';

// Types
interface ServiceHealth {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  cpu: number;
  memory: number;
  lastDeployed: string;
  issues: number;
}

interface SystemAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  service?: string;
  timestamp: string;
  acknowledged: boolean;
}

interface DeploymentStatus {
  id: string;
  service: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: string;
  progress: number;
}

export default function MissionControlPage() {
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [showFixModal, setShowFixModal] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Fetch all data
  const { data: services, isLoading: servicesLoading, refetch: refetchServices } = useServices();
  const { data: healingStatus } = useHealingStatus();
  const { data: issues } = useHealingIssues();
  const { data: automationStatus } = useAutomationStatus();
  const { data: systemHealth } = useSystemHealth();
  const { data: secrets } = useSecrets();
  
  // Mutations
  const deployMutation = useDeployService();
  const restartMutation = useRestartService();
  const syncMutation = useSyncServices();
  const automationActions = useAutomationActions();
  
  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      refetchServices();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, refetchServices]);
  
  // Calculate service health data
  const serviceHealthData: ServiceHealth[] = React.useMemo(() => {
    if (!services) return [];
    
    return services.map(service => {
      const serviceIssues = issues?.filter(i => i.serviceId === service.id && i.status === 'open') || [];
      const hasCritical = serviceIssues.some(i => i.severity === 'critical');
      const hasWarning = serviceIssues.some(i => i.severity === 'high' || i.severity === 'medium');
      
      let status: ServiceHealth['status'] = 'healthy';
      if (service.status === 'paused' || service.status === 'crashed') status = 'offline';
      else if (hasCritical) status = 'critical';
      else if (hasWarning || service.status === 'degraded') status = 'warning';
      
      return {
        id: service.id,
        name: service.name,
        status,
        cpu: service.cpuPercent || 0,
        memory: service.memoryPercent || 0,
        lastDeployed: service.lastDeploymentAt || service.updatedAt,
        issues: serviceIssues.length,
      };
    });
  }, [services, issues]);
  
  // System-wide stats
  const stats = React.useMemo(() => {
    const healthy = serviceHealthData.filter(s => s.status === 'healthy').length;
    const warning = serviceHealthData.filter(s => s.status === 'warning').length;
    const critical = serviceHealthData.filter(s => s.status === 'critical').length;
    const offline = serviceHealthData.filter(s => s.status === 'offline').length;
    const totalIssues = issues?.filter(i => i.status === 'open').length || 0;
    const missingSecrets = secrets?.filter(s => !s.value && s.required).length || 0;
    
    return { healthy, warning, critical, offline, totalIssues, missingSecrets, total: serviceHealthData.length };
  }, [serviceHealthData, issues, secrets]);
  
  // Quick actions
  const handleFixAll = useCallback(async () => {
    const criticalServices = serviceHealthData.filter(s => s.status === 'critical' || s.status === 'offline');
    
    for (const service of criticalServices) {
      await restartMutation.mutateAsync(service.id);
    }
    
    await automationActions.healAll.mutateAsync();
    setShowFixModal(false);
  }, [serviceHealthData, restartMutation, automationActions.healAll]);
  
  const handleDeployAll = useCallback(async () => {
    const servicesToDeploy = selectedServices.size > 0 
      ? Array.from(selectedServices)
      : services?.map(s => s.id) || [];
    
    for (const serviceId of servicesToDeploy) {
      await deployMutation.mutateAsync(serviceId);
    }
    
    setShowDeployModal(false);
    setSelectedServices(new Set());
  }, [selectedServices, services, deployMutation]);
  
  const handleSyncAll = useCallback(() => {
    syncMutation.mutate();
  }, [syncMutation]);
  
  if (servicesLoading) {
    return <MissionControlSkeleton />;
  }
  
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            Mission Control
          </h1>
          <p className="text-slate-400 mt-1">
            Central automation hub • {stats.total} services monitored • Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(
              "px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors",
              autoRefresh ? "bg-green-500/20 text-green-400" : "bg-slate-700 text-slate-400"
            )}
          >
            <span className={cn("w-2 h-2 rounded-full", autoRefresh ? "bg-green-400 animate-pulse" : "bg-slate-500")} />
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          
          <button
            onClick={() => refetchServices()}
            className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>
      
      {/* System Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <OverviewCard
          title="Healthy"
          value={stats.healthy}
          total={stats.total}
          color="green"
          icon="check"
        />
        <OverviewCard
          title="Warning"
          value={stats.warning}
          total={stats.total}
          color="yellow"
          icon="alert"
        />
        <OverviewCard
          title="Critical"
          value={stats.critical}
          total={stats.total}
          color="red"
          icon="x"
        />
        <OverviewCard
          title="Offline"
          value={stats.offline}
          total={stats.total}
          color="slate"
          icon="offline"
        />
        <OverviewCard
          title="Open Issues"
          value={stats.totalIssues}
          color="orange"
          icon="issue"
        />
        <OverviewCard
          title="Missing Secrets"
          value={stats.missingSecrets}
          color="purple"
          icon="lock"
        />
      </div>
      
      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service Health Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Service Health
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">
                  {selectedServices.size > 0 && `${selectedServices.size} selected`}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {serviceHealthData.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  selected={selectedServices.has(service.id)}
                  onSelect={() => {
                    const newSet = new Set(selectedServices);
                    if (newSet.has(service.id)) {
                      newSet.delete(service.id);
                    } else {
                      newSet.add(service.id);
                    }
                    setSelectedServices(newSet);
                  }}
                  onRestart={() => restartMutation.mutate(service.id)}
                  onDeploy={() => deployMutation.mutate(service.id)}
                  isRestarting={restartMutation.isPending && restartMutation.variables === service.id}
                  isDeploying={deployMutation.isPending && deployMutation.variables === service.id}
                />
              ))}
            </div>
          </div>
          
          {/* Automation Status */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Automation Status
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <AutomationToggle
                label="Auto-Heal"
                enabled={automationStatus?.autoHealEnabled ?? true}
                onToggle={() => automationActions.toggleAutoHeal.mutate()}
                status={healingStatus?.activeIssues ? `${healingStatus.activeIssues} issues` : 'Ready'}
              />
              <AutomationToggle
                label="Auto-Scale"
                enabled={automationStatus?.autoScaleEnabled ?? false}
                onToggle={() => automationActions.toggleAutoScale.mutate()}
                status="Standby"
              />
              <AutomationToggle
                label="Auto-Deploy"
                enabled={automationStatus?.autoDeployEnabled ?? false}
                onToggle={() => automationActions.toggleAutoDeploy.mutate()}
                status="Manual"
              />
              <AutomationToggle
                label="Alert Monitor"
                enabled={automationStatus?.alertsEnabled ?? true}
                onToggle={() => automationActions.toggleAlerts.mutate()}
                status="Active"
              />
            </div>
          </div>
        </div>
        
        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => setShowFixModal(true)}
                disabled={stats.critical === 0 && stats.offline === 0}
                className={cn(
                  "w-full px-4 py-3 rounded-lg flex items-center gap-3 transition-colors",
                  stats.critical > 0 || stats.offline > 0
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    : "bg-slate-700 text-slate-500 cursor-not-allowed"
                )}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="text-left">
                  <div className="font-medium">Fix All Issues</div>
                  <div className="text-xs opacity-75">
                    {stats.critical + stats.offline > 0 
                      ? `${stats.critical + stats.offline} services need attention`
                      : 'All systems healthy'}
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => setShowDeployModal(true)}
                className="w-full px-4 py-3 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 flex items-center gap-3 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div className="text-left">
                  <div className="font-medium">Deploy Services</div>
                  <div className="text-xs opacity-75">
                    {selectedServices.size > 0 
                      ? `${selectedServices.size} selected`
                      : `Deploy all ${stats.total} services`}
                  </div>
                </div>
              </button>
              
              <button
                onClick={handleSyncAll}
                disabled={syncMutation.isPending}
                className="w-full px-4 py-3 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 flex items-center gap-3 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <div className="text-left">
                  <div className="font-medium">Sync with Railway</div>
                  <div className="text-xs opacity-75">Update service list</div>
                </div>
              </button>
              
              <Link
                href="/dashboard/secrets"
                className="w-full px-4 py-3 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 flex items-center gap-3 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div className="text-left">
                  <div className="font-medium">Manage Secrets</div>
                  <div className="text-xs opacity-75">
                    {stats.missingSecrets > 0 
                      ? `${stats.missingSecrets} secrets missing`
                      : 'All secrets configured'}
                  </div>
                </div>
              </Link>
            </div>
          </div>
          
          {/* Recent Activity */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
            <ActivityFeed 
              activities={automationStatus?.recentActivity || []} 
            />
          </div>
          
          {/* System Resources */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">System Resources</h3>
            <ResourceBars 
              cpu={systemHealth?.overallCpu || 0}
              memory={systemHealth?.overallMemory || 0}
              disk={systemHealth?.overallDisk || 0}
            />
          </div>
        </div>
      </div>
      
      {/* Fix Modal */}
      {showFixModal && (
        <FixConfirmationModal
          services={serviceHealthData.filter(s => s.status === 'critical' || s.status === 'offline')}
          onConfirm={handleFixAll}
          onCancel={() => setShowFixModal(false)}
          isProcessing={restartMutation.isPending || automationActions.healAll.isPending}
        />
      )}
      
      {/* Deploy Modal */}
      {showDeployModal && (
        <DeployConfirmationModal
          serviceCount={selectedServices.size > 0 ? selectedServices.size : stats.total}
          selectedOnly={selectedServices.size > 0}
          onConfirm={handleDeployAll}
          onCancel={() => setShowDeployModal(false)}
          isProcessing={deployMutation.isPending}
        />
      )}
    </div>
  );
}

// Sub-components
function OverviewCard({ title, value, total, color, icon }: { 
  title: string; 
  value: number; 
  total?: number;
  color: string; 
  icon: string;
}) {
  const colors: Record<string, string> = {
    green: 'from-green-500/20 to-green-600/20 text-green-400',
    yellow: 'from-yellow-500/20 to-yellow-600/20 text-yellow-400',
    red: 'from-red-500/20 to-red-600/20 text-red-400',
    slate: 'from-slate-500/20 to-slate-600/20 text-slate-400',
    orange: 'from-orange-500/20 to-orange-600/20 text-orange-400',
    purple: 'from-purple-500/20 to-purple-600/20 text-purple-400',
  };
  
  return (
    <div className="glass-card p-4">
      <div className={cn("flex items-center justify-between mb-2", colors[color])}>
        <span className="text-sm text-slate-400">{title}</span>
        <Icon name={icon} className="w-5 h-5" />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white">{value}</span>
        {total && total > 0 && (
          <span className="text-sm text-slate-500">/ {total}</span>
        )}
      </div>
    </div>
  );
}

function ServiceCard({ service, selected, onSelect, onRestart, onDeploy, isRestarting, isDeploying }: {
  service: ServiceHealth;
  selected: boolean;
  onSelect: () => void;
  onRestart: () => void;
  onDeploy: () => void;
  isRestarting: boolean;
  isDeploying: boolean;
}) {
  const statusColors = {
    healthy: 'border-l-green-500',
    warning: 'border-l-yellow-500',
    critical: 'border-l-red-500',
    offline: 'border-l-slate-500',
  };
  
  return (
    <div className={cn(
      "glass-card p-4 border-l-4 transition-all cursor-pointer hover:bg-white/5",
      statusColors[service.status],
      selected && "ring-2 ring-cyan-500/50 bg-cyan-500/10"
    )}>
      <div className="flex items-start justify-between mb-3" onClick={onSelect}>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500"
          />
          <div>
            <h4 className="font-medium text-white">{service.name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={service.status} size="sm" variant="dot" />
              {service.issues > 0 && (
                <span className="text-xs text-red-400">{service.issues} issues</span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
        <div className="text-slate-400">
          CPU: <span className={cn(service.cpu > 80 ? "text-red-400" : "text-white")}>{service.cpu}%</span>
        </div>
        <div className="text-slate-400">
          RAM: <span className={cn(service.memory > 80 ? "text-red-400" : "text-white")}>{service.memory}%</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {formatTimeAgo(service.lastDeployed)}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onRestart(); }}
            disabled={isRestarting}
            className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            title="Restart"
          >
            {isRestarting ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeploy(); }}
            disabled={isDeploying}
            className="p-1.5 rounded hover:bg-white/10 text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
            title="Deploy"
          >
            {isDeploying ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function AutomationToggle({ label, enabled, onToggle, status }: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  status: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-white/5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-white">{label}</span>
        <button
          onClick={onToggle}
          className={cn(
            "relative w-10 h-5 rounded-full transition-colors",
            enabled ? "bg-green-500" : "bg-slate-600"
          )}
        >
          <span className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform",
            enabled && "translate-x-5"
          )} />
        </button>
      </div>
      <span className="text-xs text-slate-400">{status}</span>
    </div>
  );
}

function ActivityFeed({ activities }: { activities: any[] }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500 text-sm">
        No recent activity
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {activities.slice(0, 5).map((activity, idx) => (
        <div key={idx} className="flex items-start gap-3 text-sm">
          <div className={cn(
            "w-2 h-2 rounded-full mt-1.5",
            activity.type === 'success' && "bg-green-400",
            activity.type === 'error' && "bg-red-400",
            activity.type === 'warning' && "bg-yellow-400",
            activity.type === 'info' && "bg-cyan-400"
          )} />
          <div className="flex-1">
            <p className="text-slate-300">{activity.message}</p>
            <p className="text-xs text-slate-500">{formatTimeAgo(activity.timestamp)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResourceBars({ cpu, memory, disk }: { cpu: number; memory: number; disk: number }) {
  const Bar = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-400">{label}</span>
        <span className={cn(
          value > 80 ? "text-red-400" : value > 60 ? "text-yellow-400" : "text-white"
        )}>{value}%</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-500", color)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
  
  return (
    <>
      <Bar label="CPU" value={cpu} color={cpu > 80 ? "bg-red-500" : cpu > 60 ? "bg-yellow-500" : "bg-cyan-500"} />
      <Bar label="Memory" value={memory} color={memory > 80 ? "bg-red-500" : memory > 60 ? "bg-yellow-500" : "bg-violet-500"} />
      <Bar label="Disk" value={disk} color={disk > 80 ? "bg-red-500" : disk > 60 ? "bg-yellow-500" : "bg-green-500"} />
    </>
  );
}

function FixConfirmationModal({ services, onConfirm, onCancel, isProcessing }: {
  services: ServiceHealth[];
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative glass-card max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Fix All Issues</h3>
        <p className="text-slate-400 mb-4">
          This will restart {services.length} service(s) and trigger auto-healing for all detected issues.
        </p>
        
        <div className="max-h-48 overflow-y-auto space-y-2 mb-4">
          {services.map(s => (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <StatusBadge status={s.status} size="sm" variant="dot" />
              <span className="text-white">{s.name}</span>
            </div>
          ))}
        </div>
        
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} disabled={isProcessing} className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10">
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            disabled={isProcessing}
            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center gap-2"
          >
            {isProcessing && (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            Fix All
          </button>
        </div>
      </div>
    </div>
  );
}

function DeployConfirmationModal({ serviceCount, selectedOnly, onConfirm, onCancel, isProcessing }: {
  serviceCount: number;
  selectedOnly: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative glass-card max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Deploy Services</h3>
        <p className="text-slate-400 mb-4">
          {selectedOnly 
            ? `Deploy ${serviceCount} selected service(s)?`
            : `Deploy all ${serviceCount} services?`
          }
        </p>
        
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} disabled={isProcessing} className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10">
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            disabled={isProcessing}
            className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 flex items-center gap-2"
          >
            {isProcessing && (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            Deploy
          </button>
        </div>
      </div>
    </div>
  );
}

function MissionControlSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-12 bg-slate-800 rounded animate-pulse" />
      <div className="grid grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-800 rounded animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 h-96 bg-slate-800 rounded animate-pulse" />
        <div className="h-96 bg-slate-800 rounded animate-pulse" />
      </div>
    </div>
  );
}

function Icon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    check: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
    alert: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    x: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    offline: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
    issue: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    lock: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  };
  
  return icons[name] || null;
}
