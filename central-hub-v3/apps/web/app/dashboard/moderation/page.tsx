'use client';

import React, { useState, useMemo } from 'react';
import { useModerationCases } from '@/app/hooks/use-moderation';
import { DataTable, type Column } from '@/app/components/ui';
import { MetricCard } from '@/app/components/ui';
import { StatusBadge } from '@/app/components/ui';
import { Loading, SectionError } from '@/app/components/ui';
import { cn } from '@/app/lib/utils';
import type { ModerationCase } from '@/app/types';

// ── Page ──

export default function ModerationPage() {
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateSort, setDateSort] = useState('newest');

  const { data: cases = [], isLoading, isError, refetch } = useModerationCases({
    ...(actionFilter ? { action: actionFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  });

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
    let data = [...cases];
    // client-side sort
    data.sort((a, b) => {
      const ad = new Date(a.createdAt).getTime();
      const bd = new Date(b.createdAt).getTime();
      return dateSort === 'newest' ? bd - ad : ad - bd;
    });
    return data;
  }, [cases, dateSort]);

  const total = cases.length;
  const open = cases.filter((c) => c.status === 'open').length;
  const thisWeek = cases.filter((c) => new Date(c.createdAt) > new Date(Date.now() - 7 * 86400000)).length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Moderation</h1>
          <p className="text-slate-400 mt-1">Loading moderation cases...</p>
        </div>
        <Loading.StatsGrid count={3} />
        <Loading.Table rows={5} columns={8} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Moderation</h1>
          <p className="text-slate-400 mt-1">Review moderation cases, actions, and appeals</p>
        </div>
        <SectionError
          title="Failed to load moderation cases"
          message="There was an error loading the moderation cases. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

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
