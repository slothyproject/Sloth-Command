/**
 * Service Detail Page
 * Service overview with tabs for variables and deployments
 */

'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useService, useServiceVariables, useServiceDeployments, useDeployService, useRestartService } from '@/app/hooks/use-services';
import { cn, formatDate, formatTimeAgo, getStatusColor } from '@/app/lib/utils';
import Link from 'next/link';

type Tab = 'overview' | 'variables' | 'deployments' | 'logs';

export default function ServiceDetailPage() {
  const params = useParams();
  const serviceId = params.id as string;
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  
  const { data: service, isLoading: serviceLoading } = useService(serviceId);
  const { data: variables, isLoading: variablesLoading } = useServiceVariables(serviceId);
  const { data: deployments, isLoading: deploymentsLoading } = useServiceDeployments(serviceId);
  
  const deployMutation = useDeployService();
  const restartMutation = useRestartService();
  
  if (serviceLoading) {
    return <ServiceDetailSkeleton />;
  }
  
  if (!service) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Service not found</h2>
          <Link href="/dashboard/services" className="text-cyan-400 hover:text-cyan-300">
            Back to services
          </Link>
        </div>
      </div>
    );
  }
  
  const statusColor = getStatusColor(service.status);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link 
              href="/dashboard/services"
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className={`w-3 h-3 rounded-full ${statusColor}`} />
            <h1 className="text-2xl font-bold text-white">{service.name}</h1>
          </div>
          
          {service.description && (
            <p className="text-slate-400">{service.description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => restartMutation.mutate(serviceId)}
            disabled={restartMutation.isPending}
            className="btn-glass px-4 py-2 rounded-lg flex items-center gap-2"
          >
            {restartMutation.isPending ? (
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Restart
              </>
            )}
          </button>
          
          <button
            onClick={() => deployMutation.mutate(serviceId)}
            disabled={deployMutation.isPending}
            className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
          >
            {deployMutation.isPending ? (
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Deploy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Status"
          value={
            <span className={cn("capitalize", statusColor)}>
              {service.status}
            </span>
          }
          icon="Activity"
        />
        
        <StatCard
          label="CPU Usage"
          value={`${service.cpuPercent || 0}%`}
          icon="Cpu"
        />
        
        <StatCard
          label="Memory"
          value={`${service.memoryPercent || 0}%`}
          icon="HardDrive"
        />
        
        <StatCard
          label="Variables"
          value={variables?.length || 0}
          icon="Key"
        />
      </div>

      {/* Tabs */}
      <div className="glass-card">
        <div className="border-b border-white/10">
          <nav className="flex">
            {[
              { id: 'overview', label: 'Overview', icon: 'Layout' },
              { id: 'variables', label: 'Variables', icon: 'Key' },
              { id: 'deployments', label: 'Deployments', icon: 'Rocket' },
              { id: 'logs', label: 'Logs', icon: 'FileText' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={cn(
                  "flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-cyan-500 text-cyan-400"
                    : "border-transparent text-slate-400 hover:text-white hover:border-slate-600"
                )}
              >
                <Icon name={tab.icon} className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <OverviewTab service={service} />
          )}
          
          {activeTab === 'variables' && (
            <VariablesTab 
              serviceId={serviceId}
              variables={variables}
              isLoading={variablesLoading}
            />
          )}
          
          {activeTab === 'deployments' && (
            <DeploymentsTab 
              deployments={deployments}
              isLoading={deploymentsLoading}
            />
          )}
          
          {activeTab === 'logs' && (
            <LogsTab serviceId={serviceId} />
          )}
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ 
  label, 
  value, 
  icon 
}: { 
  label: string; 
  value: React.ReactNode; 
  icon: string;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <div className="text-xl font-semibold text-white mt-1">{value}</div>
        </div>
        <div className="p-2 rounded-lg bg-white/5">
          <Icon name={icon} className="w-5 h-5 text-cyan-400" />
        </div>
      </div>
    </div>
  );
}

// Overview Tab
function OverviewTab({ service }: { service: { url?: string; repositoryUrl?: string; lastDeploymentAt?: string; createdAt: string } }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="font-medium text-white">Service Information</h3>
          
          <div className="space-y-2">
            {service.url && (
              <div className="flex justify-between">
                <span className="text-slate-400">URL</span>
                <a 
                  href={service.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300"
                >
                  {service.url}
                </a>
              </div>
            )}
            
            {service.repositoryUrl && (
              <div className="flex justify-between">
                <span className="text-slate-400">Repository</span>
                <a 
                  href={service.repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 truncate max-w-xs"
                >
                  {service.repositoryUrl}
                </a>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-slate-400">Created</span>
              <span className="text-white">{formatDate(service.createdAt)}</span>
            </div>
            
            {service.lastDeploymentAt && (
              <div className="flex justify-between">
                <span className="text-slate-400">Last Deployed</span>
                <span className="text-white">{formatTimeAgo(service.lastDeploymentAt)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Variables Tab
function VariablesTab({ serviceId, variables, isLoading }: { 
  serviceId: string;
  variables: unknown[] | undefined;
  isLoading: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSecrets, setShowSecrets] = useState<Set<string>>(new Set());
  
  const filteredVariables = variables?.filter((v: { name: string; category?: string }) =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const toggleSecret = (id: string) => {
    const newSet = new Set(showSecrets);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setShowSecrets(newSet);
  };
  
  if (isLoading) {
    return <div className="skeleton h-32 rounded" />;
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search variables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg input-glass text-white placeholder-slate-500 focus:outline-none"
          />
        </div>
        
        <button className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Variable
        </button>
      </div>
      
      <div className="space-y-2">
        {filteredVariables?.map((variable: { id: string; name: string; value: string; isSecret: boolean; category?: string; description?: string }) => (
          <div
            key={variable.id}
            className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="font-medium text-white">{variable.name}</span>
                
                {variable.isSecret && (
                  <span className="px-2 py-0.5 rounded text-xs bg-violet-500/20 text-violet-400">
                    Secret
                  </span>
                )}
                
                {variable.category && (
                  <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-400">
                    {variable.category}
                  </span>
                )}
              </div>
              
              {variable.description && (
                <p className="text-sm text-slate-400 mt-1">{variable.description}</p>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {variable.isSecret ? (
                  <>
                    <input
                      type={showSecrets.has(variable.id) ? 'text' : 'password'}
                      value={variable.value}
                      readOnly
                      className="bg-slate-800 border border-slate-700 rounded px-3 py-1 text-sm text-slate-300 w-48"
                    />
                    <button
                      onClick={() => toggleSecret(variable.id)}
                      className="p-1.5 rounded hover:bg-white/10 text-slate-400"
                    >
                      {showSecrets.has(variable.id) ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </>
                ) : (
                  <span className="text-slate-300 font-mono">{variable.value}</span>
                )}
              </div>
              
              <div className="flex items-center gap-1">
                <button className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                
                <button className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                
                <button className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Deployments Tab
function DeploymentsTab({ deployments, isLoading }: { 
  deployments: unknown[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <div className="skeleton h-32 rounded" />;
  }
  
  return (
    <div className="space-y-4">
      {deployments?.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-slate-400">No deployments yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deployments?.map((deployment: { id: string; status: string; createdAt: string; url?: string }) => (
            <div
              key={deployment.id}
              className="flex items-center justify-between p-4 rounded-lg bg-white/5"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  deployment.status === 'success' && "bg-green-500/20",
                  deployment.status === 'failed' && "bg-red-500/20",
                  deployment.status === 'in_progress' && "bg-cyan-500/20"
                )}>
                  <svg className={cn(
                    "w-5 h-5",
                    deployment.status === 'success' && "text-green-400",
                    deployment.status === 'failed' && "text-red-400",
                    deployment.status === 'in_progress' && "text-cyan-400 animate-spin"
                  )} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {deployment.status === 'in_progress' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    ) : deployment.status === 'success' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    )}
                  </svg>
                </div>
                
                <div>
                  <p className="font-medium text-white">
                    Deployment #{deployment.id.slice(0, 8)}
                  </p>
                  <p className="text-sm text-slate-400">
                    {formatTimeAgo(deployment.createdAt)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <span className={cn(
                  "px-2 py-1 rounded text-xs font-medium capitalize",
                  getStatusColor(deployment.status)
                )}>
                  {deployment.status}
                </span>
                
                {deployment.url && (
                  <a
                    href={deployment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Logs Tab
function LogsTab({ serviceId }: { serviceId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm text-slate-400">Live logs</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="btn-glass px-3 py-1.5 rounded text-sm">
            Download
          </button>
          
          <button className="btn-glass px-3 py-1.5 rounded text-sm">
            Clear
          </button>
        </div>
      </div>
      
      <div className="glass-card p-4 font-mono text-sm h-96 overflow-auto">
        <div className="space-y-1">
          <LogLine level="info" timestamp="2025-01-18T10:30:00" >
            Server started on port 3000
          </LogLine>
          
          <LogLine level="info" timestamp="2025-01-18T10:30:01" >
            Connected to database
          </LogLine>
          
          <LogLine level="warn" timestamp="2025-01-18T10:30:05" >
            High memory usage detected: 78%
          </LogLine>
          
          <LogLine level="info" timestamp="2025-01-18T10:30:10" >
            Health check: OK
          </LogLine>
          
          <LogLine level="error" timestamp="2025-01-18T10:30:15" >
            API request timeout: /api/v1/users
          </LogLine>
        </div>
      </div>
    </div>
  );
}

// Log Line Component
function LogLine({ level, timestamp, children }: { 
  level: 'info' | 'warn' | 'error';
  timestamp: string;
  children: React.ReactNode;
}) {
  const colors = {
    info: 'text-slate-300',
    warn: 'text-yellow-400',
    error: 'text-red-400',
  };
  
  return (
    <div className="flex items-start gap-3">
      <span className="text-slate-500 text-xs whitespace-nowrap">
        {new Date(timestamp).toLocaleTimeString()}
      </span>
      <span className={cn(
        "uppercase text-xs font-medium w-12",
        level === 'info' && "text-blue-400",
        level === 'warn' && "text-yellow-400",
        level === 'error' && "text-red-400"
      )}>
        {level}
      </span>
      <span className={colors[level]}>{children}</span>
    </div>
  );
}

// Icon Component
function Icon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, JSX.Element> = {
    Activity: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    Cpu: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6v6H9z" />
      </svg>
    ),
    HardDrive: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="4" y="6" width="16" height="12" rx="2" strokeWidth={2} />
        <line x1="8" y1="15" x2="8" y2="15" strokeWidth={2} />
        <line x1="16" y1="15" x2="16" y2="15" strokeWidth={2} />
      </svg>
    ),
    Key: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
    Layout: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={2} />
        <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={2} />
        <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={2} />
        <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={2} />
      </svg>
    ),
    Rocket: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 5.841m5.96-5.96a6 6 0 00-5.84-7.38v4.8m5.84 2.58a14.924 14.924 0 00-5.841-5.841M12 2.252A8.992 8.992 0 0112 21a8.992 8.992 0 010-18.748z" />
      </svg>
    ),
    FileText: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  };

  return icons[name] || null;
}

// Loading Skeleton
function ServiceDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-8 w-64 rounded" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-20 rounded" />
        ))}
      </div>
      <div className="skeleton h-96 rounded" />
    </div>
  );
}
