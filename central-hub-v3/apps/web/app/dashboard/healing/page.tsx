/**
 * Self-Healing Dashboard Page
 * Central Hub v4.0 - Automated Issue Detection & Remediation
 */

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';
import type { DetectedIssue, IssueSeverity, HealingStatus, Diagnosis, RemediationAction } from '@/app/types';
import { cn } from '@/app/lib/utils';

export default function HealingDashboardPage() {
  const queryClient = useQueryClient();
  const [selectedIssue, setSelectedIssue] = useState<DetectedIssue | null>(null);
  const [showDiagnosis, setShowDiagnosis] = useState(false);

  // Fetch healing status
  const { data: status, isLoading } = useQuery({
    queryKey: ['healing', 'status'],
    queryFn: async () => {
      const response = await api.healing.getStatus();
      return response.data as HealingStatus;
    },
    refetchInterval: 15000,
  });

  // Fetch active issues
  const { data: issues } = useQuery({
    queryKey: ['healing', 'issues'],
    queryFn: async () => {
      const response = await api.healing.getIssues();
      return response.data as DetectedIssue[];
    },
  });

  // Diagnose mutation
  const diagnoseMutation = useMutation({
    mutationFn: (issueId: string) => api.healing.diagnoseIssue(issueId),
    onSuccess: () => setShowDiagnosis(true),
  });

  // Remediate mutation
  const remediateMutation = useMutation({
    mutationFn: ({ id, action, type }: { id: string; action: string; type?: string }) =>
      api.healing.remediate(id, action, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['healing'] });
      setSelectedIssue(null);
    },
  });

  if (isLoading) return <HealingDashboardSkeleton />;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Self-Healing Dashboard</h1>
        <p className="text-slate-400 mt-1">Automated issue detection, diagnosis, and remediation</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Issues"
          value={status?.activeIssues || 0}
          color="red"
          icon="alert"
        />
        <StatCard
          title="Resolved Today"
          value={status?.resolved || 0}
          color="green"
          icon="check"
        />
        <StatCard
          title="Auto-Healed"
          value={status?.autoHealed || 0}
          color="cyan"
          icon="refresh"
        />
        <StatCard
          title="Avg Fix Time"
          value={`${Math.round(status?.avgTimeToResolution || 0)}m`}
          color="violet"
          icon="clock"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Issues List */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Active Issues</h3>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <span className="text-slate-400">Live updates</span>
            </div>
          </div>

          {issues && issues.length > 0 ? (
            <div className="space-y-3">
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  onClick={() => setSelectedIssue(issue)}
                  className={cn(
                    'p-4 rounded-lg cursor-pointer transition-all',
                    selectedIssue?.id === issue.id
                      ? 'bg-cyan-500/20 border border-cyan-500/30'
                      : 'bg-white/5 hover:bg-white/10 border border-transparent'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <IssueIcon type={issue.type} severity={issue.severity} />
                      <div>
                        <p className="font-medium text-white">{issue.description}</p>
                        <p className="text-sm text-slate-400 mt-1">
                          {issue.serviceName} • Detected {new Date(issue.detectedAt).toLocaleTimeString()}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          {issue.metrics.errorRate !== undefined && (
                            <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                              Error: {(issue.metrics.errorRate * 100).toFixed(1)}%
                            </span>
                          )}
                          {issue.metrics.cpuUsage !== undefined && (
                            <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">
                              CPU: {issue.metrics.cpuUsage.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <SeverityBadge severity={issue.severity} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No active issues detected" icon="heart" />
          )}
        </div>

        {/* Issue Details / Actions */}
        <div className="space-y-4">
          {selectedIssue ? (
            <>
              {/* Issue Detail Card */}
              <div className="glass-card p-5">
                <h4 className="font-semibold text-white mb-4">Issue Details</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status</span>
                    <span className={cn(
                      'font-medium',
                      selectedIssue.status === 'detected' && 'text-yellow-400',
                      selectedIssue.status === 'remediating' && 'text-blue-400',
                      selectedIssue.status === 'resolved' && 'text-green-400',
                    )}>
                      {selectedIssue.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Service</span>
                    <span className="text-white">{selectedIssue.serviceName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Type</span>
                    <span className="text-white capitalize">{selectedIssue.type.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Detected</span>
                    <span className="text-white">{new Date(selectedIssue.detectedAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-sm text-slate-400 mb-2">Symptoms:</p>
                  <ul className="space-y-1">
                    {selectedIssue.symptoms.map((symptom, idx) => (
                      <li key={idx} className="text-sm text-white flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        {symptom}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Actions Card */}
              <div className="glass-card p-5">
                <h4 className="font-semibold text-white mb-4">Actions</h4>
                <div className="space-y-2">
                  <button
                    onClick={() => diagnoseMutation.mutate(selectedIssue.id)}
                    disabled={diagnoseMutation.isPending}
                    className="w-full btn-glass py-2 rounded-lg text-sm text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    {diagnoseMutation.isPending ? 'Diagnosing...' : '🔍 Run AI Diagnosis'}
                  </button>
                  <button
                    onClick={() => remediateMutation.mutate({ id: selectedIssue.id, action: 'restart' })}
                    disabled={remediateMutation.isPending}
                    className="w-full btn-glass py-2 rounded-lg text-sm text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    🔄 Restart Service
                  </button>
                  <button
                    onClick={() => remediateMutation.mutate({ id: selectedIssue.id, action: 'scale', type: 'scale_up' })}
                    disabled={remediateMutation.isPending}
                    className="w-full btn-glass py-2 rounded-lg text-sm text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    📈 Scale Up Resources
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card p-6 text-center">
              <p className="text-slate-400">Select an issue to view details and actions</p>
            </div>
          )}

          {/* Healing Statistics */}
          <div className="glass-card p-5">
            <h4 className="font-semibold text-white mb-4">Healing Statistics</h4>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">By Severity</span>
              </div>
              {status?.bySeverity && Object.entries(status.bySeverity).map(([severity, count]) => (
                <div key={severity} className="flex items-center justify-between">
                  <span className={cn('text-sm capitalize', {
                    'text-red-400': severity === 'critical',
                    'text-orange-400': severity === 'high',
                    'text-yellow-400': severity === 'medium',
                    'text-blue-400': severity === 'low',
                  })}>{severity}</span>
                  <span className="text-white font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Diagnosis Modal */}
      {showDiagnosis && diagnoseMutation.data && (
        <DiagnosisModal
          diagnosis={diagnoseMutation.data.data as Diagnosis}
          onClose={() => setShowDiagnosis(false)}
          onRemediate={(action) => {
            if (selectedIssue) {
              remediateMutation.mutate({ id: selectedIssue.id, action });
            }
            setShowDiagnosis(false);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// COMPONENTS
// ============================================================================

function StatCard({ title, value, color, icon }: { title: string; value: string | number; color: string; icon: string }) {
  const colors: Record<string, string> = {
    red: 'from-red-500/20 to-red-600/20 border-red-500/30',
    green: 'from-green-500/20 to-green-600/20 border-green-500/30',
    cyan: 'from-cyan-500/20 to-cyan-600/20 border-cyan-500/30',
    violet: 'from-violet-500/20 to-violet-600/20 border-violet-500/30',
  };

  return (
    <div className={cn('glass-card p-5 bg-gradient-to-br', colors[color])}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
          {icon === 'alert' && (
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          {icon === 'check' && (
            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {icon === 'refresh' && (
            <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          {icon === 'clock' && (
            <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

function IssueIcon({ type, severity }: { type: string; severity: IssueSeverity }) {
  const colors: Record<IssueSeverity, string> = {
    critical: 'bg-red-500/20 text-red-400',
    high: 'bg-orange-500/20 text-orange-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    low: 'bg-blue-500/20 text-blue-400',
  };

  return (
    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', colors[severity])}>
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {type === 'crash' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />}
        {type === 'error_spike' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />}
        {type === 'high_latency' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />}
        {type === 'resource_exhaustion' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />}
        {!['crash', 'error_spike', 'high_latency', 'resource_exhaustion'].includes(type) && (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        )}
      </svg>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  const colors: Record<IssueSeverity, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  return (
    <span className={cn('px-2 py-1 text-xs font-medium rounded border uppercase', colors[severity])}>
      {severity}
    </span>
  );
}

function DiagnosisModal({ diagnosis, onClose, onRemediate }: { diagnosis: Diagnosis; onClose: () => void; onRemediate: (action: string) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-elevated rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">AI Diagnosis</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <p className="text-sm text-cyan-400 font-medium mb-1">Root Cause Identified</p>
              <p className="text-white">{diagnosis.rootCause}</p>
              <p className="text-sm text-slate-400 mt-2">Confidence: {(diagnosis.confidence * 100).toFixed(0)}%</p>
            </div>

            {diagnosis.possibleCauses.length > 0 && (
              <div>
                <p className="text-sm text-slate-400 mb-2">Possible Causes:</p>
                <ul className="space-y-1">
                  {diagnosis.possibleCauses.map((cause, idx) => (
                    <li key={idx} className="text-sm text-white flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      {cause}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="text-sm text-slate-400 mb-2">Recommended Actions:</p>
              <div className="space-y-2">
                {diagnosis.recommendedActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => onRemediate(action.action)}
                    className="w-full p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">{action.action}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded', {
                        'bg-green-500/20 text-green-400': action.risk === 'low',
                        'bg-yellow-500/20 text-yellow-400': action.risk === 'medium',
                        'bg-red-500/20 text-red-400': action.risk === 'high',
                      })}>
                        {action.risk} risk
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {(action.confidence * 100).toFixed(0)}% confidence • ~{action.estimatedTimeToFix} min fix time
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message, icon }: { message: string; icon: string }) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </div>
      <p className="text-slate-400">{message}</p>
    </div>
  );
}

function HealingDashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-48 bg-white/10 rounded animate-pulse" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-white/5 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6 h-96">
        <div className="col-span-2 bg-white/5 rounded-lg animate-pulse" />
        <div className="bg-white/5 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
