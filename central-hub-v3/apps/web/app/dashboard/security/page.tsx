/**
 * Security Dashboard Page
 * Central Hub v4.0 - Security Automation
 * Vulnerability management, compliance checking, and auto-patching
 */

'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';
import type {
  SecurityDashboard,
  Vulnerability,
  SecurityScan,
  VulnSeverity,
  ComplianceCheck,
  SecurityEvent,
} from '@/app/types';
import { cn } from '@/app/lib/utils';

// ============================================================================
// SECURITY DASHBOARD PAGE
// ============================================================================

export default function SecurityDashboardPage() {
  const queryClient = useQueryClient();
  const [selectedSeverity, setSelectedSeverity] = useState<VulnSeverity | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'vulnerabilities' | 'compliance' | 'events'>('overview');

  // Fetch security dashboard data
  const { data: dashboard, isLoading: isDashboardLoading, error: dashboardError } = useQuery({
    queryKey: ['security', 'dashboard'],
    queryFn: async () => {
      const response = await api.security.getDashboard();
      return response.data as SecurityDashboard;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch vulnerabilities
  const { data: vulnerabilities, isLoading: isVulnsLoading } = useQuery({
    queryKey: ['security', 'vulnerabilities', selectedSeverity, selectedStatus],
    queryFn: async () => {
      const filters: Record<string, string> = {};
      if (selectedSeverity !== 'all') filters.severity = selectedSeverity;
      if (selectedStatus !== 'all') filters.status = selectedStatus;
      const response = await api.security.getVulnerabilities(filters);
      return response.data as Vulnerability[];
    },
  });

  // Fetch recent scans
  const { data: scans, isLoading: isScansLoading } = useQuery({
    queryKey: ['security', 'scans'],
    queryFn: async () => {
      const response = await api.security.getScans(undefined, 10);
      return response.data as SecurityScan[];
    },
  });

  // Fetch recent events
  const { data: events, isLoading: isEventsLoading } = useQuery({
    queryKey: ['security', 'events'],
    queryFn: async () => {
      const response = await api.security.getEvents({ acknowledged: false }, 20);
      return response.data as SecurityEvent[];
    },
  });

  // Mutations
  const patchMutation = useMutation({
    mutationFn: (vulnId: string) => api.security.applyPatch(vulnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security'] });
    },
  });

  const scanMutation = useMutation({
    mutationFn: (serviceId: string) => api.security.runScan(serviceId, 'full'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security', 'scans'] });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: ({ eventId, userId }: { eventId: string; userId: string }) =>
      api.security.acknowledgeEvent(eventId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security', 'events'] });
    },
  });

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (isDashboardLoading) {
    return <SecurityDashboardSkeleton />;
  }

  if (dashboardError) {
    return (
      <div className="p-8">
        <div className="glass-card p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Failed to Load Security Data</h3>
          <p className="text-slate-400">Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

  const stats = dashboard?.summary;
  const compliance = dashboard?.compliance;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Security Dashboard</h1>
          <p className="text-slate-400 mt-1">
            Vulnerability management, compliance checking, and automated patching
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => scanMutation.mutate('all')}
            disabled={scanMutation.isPending}
            className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {scanMutation.isPending ? (
              <LoadingSpinner size="sm" />
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            Run Security Scan
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10">
        {(['overview', 'vulnerabilities', 'compliance', 'events'] as const).map((tab) => (
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
        <div className="space-y-6">
          {/* Security Score & Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Security Score Card */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-medium text-slate-400 mb-4">Security Score</h3>
              <div className="flex items-center justify-center">
                <SecurityScoreGauge
                  score={calculateSecurityScore(stats)}
                  size={180}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.open || 0}</p>
                  <p className="text-xs text-slate-400">Open Vulnerabilities</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-400">{stats?.resolved || 0}</p>
                  <p className="text-xs text-slate-400">Resolved</p>
                </div>
              </div>
            </div>

            {/* Vulnerability Breakdown */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-medium text-slate-400 mb-4">Vulnerability Breakdown</h3>
              <div className="space-y-3">
                <SeverityRow severity="critical" count={stats?.critical || 0} total={stats?.totalVulnerabilities || 1} />
                <SeverityRow severity="high" count={stats?.high || 0} total={stats?.totalVulnerabilities || 1} />
                <SeverityRow severity="medium" count={stats?.medium || 0} total={stats?.totalVulnerabilities || 1} />
                <SeverityRow severity="low" count={stats?.low || 0} total={stats?.totalVulnerabilities || 1} />
                <SeverityRow severity="info" count={0} total={stats?.totalVulnerabilities || 1} />
              </div>
            </div>

            {/* Compliance Status */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-medium text-slate-400 mb-4">Compliance Status</h3>
              <div className="flex items-center justify-center mb-6">
                <ComplianceDonut
                  passed={compliance?.passed || 0}
                  failed={compliance?.failed || 0}
                  total={compliance?.totalChecks || 1}
                  size={140}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Compliance Rate</span>
                  <span className={cn(
                    'font-medium',
                    (compliance?.complianceRate || 0) >= 80 ? 'text-green-400' : 'text-yellow-400'
                  )}>
                    {compliance?.complianceRate?.toFixed(1) || 0}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total Checks</span>
                  <span className="text-white font-medium">{compliance?.totalChecks || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity & Top Services */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Scans */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Recent Scans</h3>
                <button
                  onClick={() => setActiveTab('vulnerabilities')}
                  className="text-sm text-cyan-400 hover:text-cyan-300"
                >
                  View All →
                </button>
              </div>
              <div className="space-y-3">
                {isScansLoading ? (
                  <ScanSkeleton />
                ) : scans && scans.length > 0 ? (
                  scans.slice(0, 5).map((scan) => (
                    <ScanRow key={scan.id} scan={scan} />
                  ))
                ) : (
                  <EmptyState message="No recent scans" />
                )}
              </div>
            </div>

            {/* Top Vulnerable Services */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Top Vulnerable Services</h3>
              </div>
              <div className="space-y-3">
                {dashboard?.topVulnerableServices && dashboard.topVulnerableServices.length > 0 ? (
                  dashboard.topVulnerableServices.map((service) => (
                    <div
                      key={service.serviceId}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-white">{service.serviceName}</p>
                        <p className="text-xs text-slate-400">
                          {service.vulnerabilityCount} vulnerabilities
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {service.criticalCount > 0 && (
                          <span className="px-2 py-1 text-xs font-medium bg-red-500/20 text-red-400 rounded">
                            {service.criticalCount} Critical
                          </span>
                        )}
                        <span className="px-2 py-1 text-xs font-medium bg-white/10 text-slate-400 rounded">
                          {service.vulnerabilityCount} Total
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState message="No vulnerable services found" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vulnerabilities Tab */}
      {activeTab === 'vulnerabilities' && (
        <div className="glass-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h3 className="text-lg font-semibold text-white">Vulnerabilities</h3>
            <div className="flex items-center gap-3">
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value as VulnSeverity | 'all')}
                className="input-glass px-3 py-2 rounded-lg text-sm text-white bg-transparent"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="info">Info</option>
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="input-glass px-3 py-2 rounded-lg text-sm text-white bg-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          {isVulnsLoading ? (
            <VulnerabilityTableSkeleton />
          ) : vulnerabilities && vulnerabilities.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-white/10">
                    <th className="pb-3 text-sm font-medium text-slate-400">Severity</th>
                    <th className="pb-3 text-sm font-medium text-slate-400">Title</th>
                    <th className="pb-3 text-sm font-medium text-slate-400">Component</th>
                    <th className="pb-3 text-sm font-medium text-slate-400">Status</th>
                    <th className="pb-3 text-sm font-medium text-slate-400">Discovered</th>
                    <th className="pb-3 text-sm font-medium text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {vulnerabilities.map((vuln) => (
                    <tr key={vuln.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-4">
                        <SeverityBadge severity={vuln.severity} />
                      </td>
                      <td className="py-4">
                        <div>
                          <p className="font-medium text-white">{vuln.title}</p>
                          {vuln.cveId && (
                            <p className="text-xs text-cyan-400">{vuln.cveId}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-slate-300">{vuln.affectedComponent}</td>
                      <td className="py-4">
                        <StatusBadge status={vuln.status} />
                      </td>
                      <td className="py-4 text-slate-400 text-sm">
                        {new Date(vuln.discoveredAt).toLocaleDateString()}
                      </td>
                      <td className="py-4">
                        {vuln.status === 'open' && vuln.fixedVersion && (
                          <button
                            onClick={() => patchMutation.mutate(vuln.id)}
                            disabled={patchMutation.isPending}
                            className="btn-primary px-3 py-1.5 rounded text-sm disabled:opacity-50"
                          >
                            {patchMutation.isPending ? 'Patching...' : 'Apply Patch'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No vulnerabilities found" />
          )}
        </div>
      )}

      {/* Compliance Tab */}
      {activeTab === 'compliance' && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Compliance Frameworks</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ComplianceFrameworkCard
              name="SOC 2"
              description="Service Organization Control 2 compliance"
              checks={compliance?.totalChecks || 0}
              passed={compliance?.passed || 0}
              failed={compliance?.failed || 0}
              onRunCheck={() => scanMutation.mutate('soc2')}
              isRunning={scanMutation.isPending}
            />
            <ComplianceFrameworkCard
              name="GDPR"
              description="General Data Protection Regulation"
              checks={12}
              passed={10}
              failed={2}
              onRunCheck={() => scanMutation.mutate('gdpr')}
              isRunning={scanMutation.isPending}
            />
            <ComplianceFrameworkCard
              name="PCI DSS"
              description="Payment Card Industry Data Security Standard"
              checks={8}
              passed={7}
              failed={1}
              onRunCheck={() => scanMutation.mutate('pci')}
              isRunning={scanMutation.isPending}
            />
          </div>
        </div>
      )}

      {/* Events Tab */}
      {activeTab === 'events' && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Security Events</h3>
          </div>
          {isEventsLoading ? (
            <EventsSkeleton />
          ) : events && events.length > 0 ? (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-4 p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                    event.severity === 'critical' && 'bg-red-500/20',
                    event.severity === 'high' && 'bg-orange-500/20',
                    event.severity === 'medium' && 'bg-yellow-500/20',
                    event.severity === 'low' && 'bg-blue-500/20',
                    event.severity === 'info' && 'bg-slate-500/20',
                  )}>
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-white">{event.description}</p>
                        <p className="text-sm text-slate-400 mt-1">
                          {event.type} • {new Date(event.timestamp).toLocaleString()}
                        </p>
                      </div>
                      {!event.acknowledged && (
                        <button
                          onClick={() => acknowledgeMutation.mutate({ eventId: event.id, userId: 'user' })}
                          disabled={acknowledgeMutation.isPending}
                          className="btn-glass px-3 py-1.5 rounded text-sm text-slate-300 hover:text-white whitespace-nowrap"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No security events" />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function SecurityScoreGauge({ score, size = 180 }: { score: number; size?: number }) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  const getColor = () => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    if (score >= 40) return '#f97316';
    return '#ef4444';
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor()}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-white">{score}</span>
        <span className="text-sm text-slate-400">/ 100</span>
      </div>
    </div>
  );
}

function ComplianceDonut({ passed, failed, total, size = 140 }: { passed: number; failed: number; total: number; size?: number }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const passedOffset = circumference - (passed / total) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(239,68,68,0.3)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#22c55e"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={passedOffset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{passed}</span>
        <span className="text-xs text-slate-400">Passed</span>
      </div>
    </div>
  );
}

function SeverityRow({ severity, count, total }: { severity: VulnSeverity; count: number; total: number }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  const colors: Record<VulnSeverity, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-500',
    info: 'bg-slate-500',
  };

  const labels: Record<VulnSeverity, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    info: 'Info',
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300">{labels[severity]}</span>
        <span className="text-white font-medium">{count}</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', colors[severity])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: VulnSeverity }) {
  const styles: Record<VulnSeverity, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    info: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  return (
    <span className={cn('px-2 py-1 text-xs font-medium rounded border capitalize', styles[severity])}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-yellow-500/20 text-yellow-400',
    in_progress: 'bg-blue-500/20 text-blue-400',
    resolved: 'bg-green-500/20 text-green-400',
    false_positive: 'bg-slate-500/20 text-slate-400',
    accepted_risk: 'bg-purple-500/20 text-purple-400',
  };

  const labels: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    false_positive: 'False Positive',
    accepted_risk: 'Accepted Risk',
  };

  return (
    <span className={cn('px-2 py-1 text-xs font-medium rounded capitalize', styles[status] || 'bg-slate-500/20 text-slate-400')}>
      {labels[status] || status}
    </span>
  );
}

function ScanRow({ scan }: { scan: SecurityScan }) {
  const statusColors: Record<string, string> = {
    completed: 'text-green-400',
    failed: 'text-red-400',
    in_progress: 'text-blue-400',
    pending: 'text-yellow-400',
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
      <div className="flex items-center gap-3">
        <div className={cn('w-2 h-2 rounded-full', statusColors[scan.status])} />
        <div>
          <p className="text-sm font-medium text-white capitalize">{scan.scanType} Scan</p>
          <p className="text-xs text-slate-400">
            {scan.summary.total} vulnerabilities found
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className={cn('text-sm font-medium', statusColors[scan.status])}>
          {scan.status === 'completed' ? 'Completed' : scan.status}
        </p>
        <p className="text-xs text-slate-400">
          {new Date(scan.startedAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

function ComplianceFrameworkCard({
  name,
  description,
  checks,
  passed,
  failed,
  onRunCheck,
  isRunning,
}: {
  name: string;
  description: string;
  checks: number;
  passed: number;
  failed: number;
  onRunCheck: () => void;
  isRunning: boolean;
}) {
  const rate = checks > 0 ? (passed / checks) * 100 : 0;

  return (
    <div className="glass-card p-5 hover:bg-white/10 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="font-semibold text-white">{name}</h4>
          <p className="text-sm text-slate-400 mt-1">{description}</p>
        </div>
        <div className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold',
          rate >= 80 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
        )}>
          {rate.toFixed(0)}%
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="p-2 rounded bg-white/5">
          <p className="text-lg font-bold text-white">{checks}</p>
          <p className="text-xs text-slate-400">Total</p>
        </div>
        <div className="p-2 rounded bg-green-500/10">
          <p className="text-lg font-bold text-green-400">{passed}</p>
          <p className="text-xs text-slate-400">Passed</p>
        </div>
        <div className="p-2 rounded bg-red-500/10">
          <p className="text-lg font-bold text-red-400">{failed}</p>
          <p className="text-xs text-slate-400">Failed</p>
        </div>
      </div>

      <button
        onClick={onRunCheck}
        disabled={isRunning}
        className="w-full btn-glass py-2 rounded-lg text-sm text-slate-300 hover:text-white disabled:opacity-50"
      >
        {isRunning ? 'Running Check...' : 'Run Compliance Check'}
      </button>
    </div>
  );
}

function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <svg className={cn('animate-spin', sizes[size])} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
        <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-slate-400">{message}</p>
    </div>
  );
}

// ============================================================================
// SKELETON COMPONENTS
// ============================================================================

function SecurityDashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-64 bg-white/10 rounded animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 h-80 bg-white/5 animate-pulse" />
        <div className="glass-card p-6 h-80 bg-white/5 animate-pulse" />
        <div className="glass-card p-6 h-80 bg-white/5 animate-pulse" />
      </div>
    </div>
  );
}

function ScanSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

function VulnerabilityTableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

function EventsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-20 bg-white/5 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

// ============================================================================
// UTILITIES
// ============================================================================

function calculateSecurityScore(stats?: SecurityDashboard['summary']): number {
  if (!stats || stats.totalVulnerabilities === 0) return 100;

  const weights = {
    critical: 40,
    high: 25,
    medium: 15,
    low: 10,
  };

  const maxDeduction = Object.values(weights).reduce((a, b) => a + b, 0);
  let deduction = 0;

  deduction += (stats.critical / Math.max(stats.totalVulnerabilities, 1)) * weights.critical;
  deduction += (stats.high / Math.max(stats.totalVulnerabilities, 1)) * weights.high;
  deduction += (stats.medium / Math.max(stats.totalVulnerabilities, 1)) * weights.medium;
  deduction += (stats.low / Math.max(stats.totalVulnerabilities, 1)) * weights.low;

  return Math.max(0, Math.round(100 - deduction));
}
