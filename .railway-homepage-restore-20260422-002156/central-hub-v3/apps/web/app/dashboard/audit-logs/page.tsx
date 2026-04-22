/**
 * Audit Logs Page
 * Immutable trail of all system actions with filtering and auto-refresh
 */

'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';
import { cn } from '@/app/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  changes?: Record<string, unknown>;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  createdAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  info:     'bg-slate-500/20 text-slate-300 border-slate-500/30',
  warning:  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  error:    'bg-red-500/20 text-red-400 border-red-500/30',
  critical: 'bg-red-600/30 text-red-300 border-red-600/40',
};

const SEVERITY_DOT: Record<string, string> = {
  info:     'bg-slate-400',
  warning:  'bg-yellow-400',
  error:    'bg-red-400',
  critical: 'bg-red-300 animate-pulse',
};

const ACTION_PREFIXES = [
  { prefix: 'auth.', label: 'Auth', color: 'text-violet-400' },
  { prefix: 'variable.', label: 'Variables', color: 'text-cyan-400' },
  { prefix: 'credential.', label: 'Credentials', color: 'text-emerald-400' },
  { prefix: 'deployment.', label: 'Deployments', color: 'text-orange-400' },
  { prefix: 'service.', label: 'Services', color: 'text-blue-400' },
];

function actionColor(action: string): string {
  const match = ACTION_PREFIXES.find(a => action.startsWith(a.prefix));
  return match?.color ?? 'text-slate-300';
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const [page, setPage] = useState(0);
  const [filterAction, setFilterAction] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterResourceType, setFilterResourceType] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const PAGE_SIZE = 50;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-logs', page, filterAction, filterSeverity, filterResourceType],
    queryFn: async () => {
      const resp = await api.auditLogs.list({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        action: filterAction || undefined,
        severity: (filterSeverity as AuditLog['severity']) || undefined,
        resourceType: filterResourceType || undefined,
      });
      return resp.data as { data: AuditLog[]; total: number };
    },
    refetchInterval: 30_000,
  });

  const logs: AuditLog[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
          <p className="text-slate-400 text-sm mt-1">
            Immutable record of all system actions · auto-refreshes every 30s
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse inline-block" />
          Live
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Filter by action (e.g. auth.login)"
          value={filterAction}
          onChange={e => { setFilterAction(e.target.value); setPage(0); }}
          className="flex-1 min-w-40 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
        />
        <select
          value={filterSeverity}
          onChange={e => { setFilterSeverity(e.target.value); setPage(0); }}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
        >
          <option value="">All severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="critical">Critical</option>
        </select>
        <select
          value={filterResourceType}
          onChange={e => { setFilterResourceType(e.target.value); setPage(0); }}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
        >
          <option value="">All resource types</option>
          <option value="service">service</option>
          <option value="variable">variable</option>
          <option value="credential">credential</option>
          <option value="deployment">deployment</option>
        </select>
        {(filterAction || filterSeverity || filterResourceType) && (
          <button
            onClick={() => { setFilterAction(''); setFilterSeverity(''); setFilterResourceType(''); setPage(0); }}
            className="px-3 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            Clear
          </button>
        )}
        <span className="ml-auto self-center text-xs text-slate-500">{total.toLocaleString()} entries</span>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">Loading audit logs…</div>
        ) : isError ? (
          <div className="p-12 text-center text-red-400">Failed to load audit logs.</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No audit logs match your filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3 w-4" />
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={cn('w-2 h-2 rounded-full inline-block', SEVERITY_DOT[log.severity] ?? 'bg-slate-400')}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap font-mono text-xs">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('font-mono', actionColor(log.action))}>{log.action}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {log.resourceType && (
                        <span>{log.resourceType}{log.resourceId ? ` / ${log.resourceId.slice(0, 8)}…` : ''}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded text-xs border', SEVERITY_STYLES[log.severity])}>
                        {log.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-mono">{log.ipAddress ?? '—'}</td>
                  </tr>
                  {expandedId === log.id && (
                    <tr className="bg-slate-900/60 border-b border-white/5">
                      <td colSpan={6} className="px-8 py-4">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-slate-500 uppercase tracking-wider">Log ID</span>
                            <p className="text-slate-300 font-mono mt-1">{log.id}</p>
                          </div>
                          {log.userId && (
                            <div>
                              <span className="text-slate-500 uppercase tracking-wider">User ID</span>
                              <p className="text-slate-300 font-mono mt-1">{log.userId}</p>
                            </div>
                          )}
                          {log.userAgent && (
                            <div className="col-span-2">
                              <span className="text-slate-500 uppercase tracking-wider">User Agent</span>
                              <p className="text-slate-400 mt-1 truncate">{log.userAgent}</p>
                            </div>
                          )}
                          {log.changes && Object.keys(log.changes).length > 0 && (
                            <div className="col-span-2">
                              <span className="text-slate-500 uppercase tracking-wider">Changes</span>
                              <pre className="text-slate-300 mt-1 bg-black/30 rounded p-3 overflow-auto text-xs">
                                {JSON.stringify(log.changes, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-slate-400 disabled:opacity-40 hover:bg-white/5 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-slate-400 disabled:opacity-40 hover:bg-white/5 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
