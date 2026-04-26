'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTickets } from '@/app/hooks/use-tickets';
import { DataTable, type Column } from '@/app/components/ui';
import { MetricCard } from '@/app/components/ui';
import { StatusBadge } from '@/app/components/ui';
import { Loading, SectionError } from '@/app/components/ui';
import { cn } from '@/app/lib/utils';
import type { Ticket, TicketStatus, TicketPriority } from '@/app/types';

// ── Page ──

export default function TicketsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sortPreset, setSortPreset] = useState('newest');

  const { data: tickets = [], isLoading, isError, refetch } = useTickets({
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(priorityFilter ? { priority: priorityFilter } : {}),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Tickets</h1>
          <p className="text-slate-400 mt-1">Loading tickets...</p>
        </div>
        <Loading.StatsGrid count={3} />
        <Loading.Table rows={5} columns={7} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Tickets</h1>
          <p className="text-slate-400 mt-1">Manage support tickets and track resolution status</p>
        </div>
        <SectionError
          title="Failed to load tickets"
          message="There was an error loading the tickets. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const columns: Column<Ticket>[] = [
    { key: 'number', title: 'Ticket #', sortable: true },
    { key: 'subject', title: 'Subject', sortable: true },
    {
      key: 'status',
      title: 'Status',
      sortable: true,
      render: (row) => (
        <StatusBadge
          status={
            row.status === 'in_progress'
              ? 'running'
              : row.status === 'resolved'
                ? 'resolved'
                : row.status === 'closed'
                  ? 'completed'
                  : 'open'
          }
          size="sm"
        />
      ),
    },
    {
      key: 'priority',
      title: 'Priority',
      sortable: true,
      render: (row) => (
        <span
          className={cn(
            'text-xs font-medium',
            row.priority === 'urgent' && 'text-red-400',
            row.priority === 'high' && 'text-orange-400',
            row.priority === 'medium' && 'text-yellow-400',
            row.priority === 'low' && 'text-slate-400'
          )}
        >
          {row.priority.toUpperCase()}
        </span>
      ),
    },
    { key: 'assignedTo', title: 'Assigned To', sortable: true },
    {
      key: 'createdAt',
      title: 'Created',
      sortable: true,
      render: (row) => (
        <span className="text-slate-400 text-xs">{new Date(row.createdAt).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'actions',
      title: '',
      sortable: false,
      render: (row) => (
        <Link href={`/dashboard/tickets/${row.id}`} className="text-cyan-400 hover:text-cyan-300 text-sm">
          View
        </Link>
      ),
    },
  ];

  const filteredData = useMemo(() => {
    let data = [...tickets];
    // client-side sort
    if (sortPreset === 'urgent') {
      const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      data.sort((a, b) => order[a.priority] - order[b.priority]);
    } else if (sortPreset === 'oldest') {
      data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortPreset === 'newest') {
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortPreset === 'unassigned') {
      data = data.filter((t) => t.assignedTo === 'Unassigned');
    }
    return data;
  }, [tickets, sortPreset]);

  const total = tickets.length;
  const open = tickets.filter((t) => t.status === 'open').length;
  const assigned = tickets.filter((t) => t.assignedTo !== 'Unassigned').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Tickets</h1>
        <p className="text-slate-400 mt-1">Manage support tickets and track resolution status</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard title="Total Tickets" value={total.toString()} color="cyan" size="sm" />
        <MetricCard title="Open Tickets" value={open.toString()} color="yellow" size="sm" />
        <MetricCard title="Assigned" value={assigned.toString()} color="green" size="sm" />
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
        >
          <option value="">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={sortPreset}
          onChange={(e) => setSortPreset(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="urgent">Urgent First</option>
          <option value="unassigned">Unassigned</option>
        </select>
        {(statusFilter || priorityFilter) && (
          <button
            onClick={() => {
              setStatusFilter('');
              setPriorityFilter('');
            }}
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
        searchKeys={['number', 'subject', 'assignedTo']}
        pagination
        pageSize={5}
        emptyMessage="No tickets found"
      />
    </div>
  );
}
