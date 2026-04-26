'use client';

import React, { useState, useMemo } from 'react';
import { DataTable, type Column } from '@/app/components/ui';
import { MetricCard } from '@/app/components/ui';
import { StatusBadge } from '@/app/components/ui';
import { cn } from '@/app/lib/utils';

// ── Types ──

interface ModerationCase {
  id: string;
  caseNumber: string;
  action: 'warn' | 'kick' | 'ban' | 'mute';
  target: string;
  moderator: string;
  reason: string;
  duration?: string;
  createdAt: string;
  status: 'open' | 'resolved' | 'appealed';
}

// ── Mock Data ──

const mockCases: ModerationCase[] = [
  { id: '1', caseNumber: 'MOD-001', action: 'warn', target: 'user_1', moderator: 'ModA', reason: 'Spam in general channel', duration: '—', createdAt: '2026-04-25T10:00:00Z', status: 'resolved' },
  { id: '2', caseNumber: 'MOD-002', action: 'mute', target: 'user_2', moderator: 'ModB', reason: 'Excessive caps', duration: '1h', createdAt: '2026-04-24T14:30:00Z', status: 'open' },
  { id: '3', caseNumber: 'MOD-003', action: 'kick', target: 'user_3', moderator: 'ModA', reason: 'Inappropriate nickname', duration: '—', createdAt: '2026-04-23T09:15:00Z', status: 'resolved' },
  { id: '4', caseNumber: 'MOD-004', action: 'ban', target: 'user_4', moderator: 'ModC', reason: 'Harassment', duration: 'Permanent', createdAt: '2026-04-25T08:00:00Z', status: 'open' },
  { id: '5', caseNumber: 'MOD-005', action: 'warn', target: 'user_5', moderator: 'ModB', reason: 'Off-topic promotion', duration: '—', createdAt: '2026-04-22T11:20:00Z', status: 'appealed' },
  { id: '6', caseNumber: 'MOD-006', action: 'mute', target: 'user_6', moderator: 'ModA', reason: 'Repeated posting of invite links', duration: '24h', createdAt: '2026-04-21T16:45:00Z', status: 'resolved' },
];

// ── Page ──

export default function ModerationPage() {
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateSort, setDateSort] = useState('newest');

  const columns: Column<ModerationCase>[] = [
    { key: 'caseNumber', title: 'Case #', sortable: true },
    {
      key: 'action',
      title: 'Action',
      sortable: true,
      render: (row) => (
        <StatusBadge
          status={row.action === 'ban' ? 'critical' : row.action === 'kick' ? 'warning' : row.action === 'mute' ? 'info' : 'info'}
          label={row.action.toUpperCase()}
          size="sm"
          variant="outline"
        />
      ),
    },
    { key: 'target', title: 'Target', sortable: true },
    { key: 'moderator', title: 'Moderator', sortable: true },
    { key: 'reason', title: 'Reason', sortable: true },
    { key: 'duration', title: 'Duration', sortable: true, render: (row) => <span className="text-slate-400 text-xs">{row.duration}</span> },
    {
      key: 'createdAt',
      title: 'Created',
      sortable: true,
      render: (row) => (
        <span className="text-slate-400 text-xs">{new Date(row.createdAt).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      sortable: true,
      render: (row) => (
        <StatusBadge
          status={row.status === 'open' ? 'open' : row.status === 'appealed' ? 'pending' : 'resolved'}
          size="sm"
        />
      ),
    },
  ];

  const filteredData = useMemo(() => {
    let data = [...mockCases];
    if (actionFilter) data = data.filter((c) => c.action === actionFilter);
    if (statusFilter) data = data.filter((c) => c.status === statusFilter);
    data.sort((a, b) => {
      const ad = new Date(a.createdAt).getTime();
      const bd = new Date(b.createdAt).getTime();
      return dateSort === 'newest' ? bd - ad : ad - bd;
    });
    return data;
  }, [actionFilter, statusFilter, dateSort]);

  const total = mockCases.length;
  const open = mockCases.filter((c) => c.status === 'open').length;
  const thisWeek = mockCases.filter((c) => new Date(c.createdAt) > new Date(Date.now() - 7 * 86400000)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Moderation</h1>
        <p className="text-slate-400 mt-1">Review moderation cases, actions, and appeals</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard title="Total Cases" value={total.toString()} color="cyan" size="sm" />
        <MetricCard title="Open Cases" value={open.toString()} color="yellow" size="sm" />
        <MetricCard title="This Week" value={thisWeek.toString()} color="green" size="sm" />
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
        >
          <option value="">All Actions</option>
          <option value="warn">Warn</option>
          <option value="mute">Mute</option>
          <option value="kick">Kick</option>
          <option value="ban">Ban</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="appealed">Appealed</option>
        </select>
        <select
          value={dateSort}
          onChange={(e) => setDateSort(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
        {(actionFilter || statusFilter) && (
          <button
            onClick={() => { setActionFilter(''); setStatusFilter(''); }}
            className="px-3 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* DataTable */}
      <DataTable
        data={filteredData}
        columns={columns}
        keyExtractor={(row) => row.id}
        searchable
        searchKeys={['caseNumber', 'target', 'moderator', 'reason']}
        pagination
        pageSize={5}
        emptyMessage="No moderation cases found"
      />
    </div>
  );
}
