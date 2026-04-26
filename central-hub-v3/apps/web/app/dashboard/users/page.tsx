'use client';

import React, { useState, useMemo } from 'react';
import { useUsers, useUpdateUserRole, useUpdateUserStatus } from '@/app/hooks/use-users';
import { DataTable, type Column } from '@/app/components/ui';
import { MetricCard } from '@/app/components/ui';
import { StatusBadge } from '@/app/components/ui';
import { Loading, SectionError } from '@/app/components/ui';
import type { DashboardUser } from '@/app/types';

export default function UsersPage() {
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');

  const { data: users = [], isLoading, isError, refetch } = useUsers({
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  });

  const updateRole = useUpdateUserRole();
  const updateStatus = useUpdateUserStatus();

  const handleSaveRole = (id: string) => {
    if (editRole) {
      updateRole.mutate({ id, role: editRole });
    }
    setEditingId(null);
  };

  const handleToggleStatus = (u: DashboardUser) => {
    const next = u.status === 'active' ? 'inactive' : u.status === 'inactive' ? 'active' : 'active';
    updateStatus.mutate({ id: u.id, status: next });
  };

  const columns: Column<DashboardUser>[] = [
    { key: 'username', title: 'Username', sortable: true },
    { key: 'email', title: 'Email', sortable: true },
    {
      key: 'role',
      title: 'Role',
      sortable: true,
      render: (row) =>
        editingId === row.id ? (
          <select
            value={editRole}
            onChange={(e) => setEditRole(e.target.value)}
            className="bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs text-white"
          >
            <option value="user">User</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
        ) : (
          <span className="text-sm text-slate-300">{row.role}</span>
        ),
    },
    {
      key: 'lastSeen',
      title: 'Last Seen',
      sortable: true,
      render: (row) => <span className="text-slate-400 text-xs">{new Date(row.lastSeen).toLocaleDateString()}</span>,
    },
    {
      key: 'status',
      title: 'Status',
      sortable: true,
      render: (row) => (
        <StatusBadge
          status={row.status === 'active' ? 'active' : row.status === 'banned' ? 'critical' : 'inactive'}
          size="sm"
        />
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      sortable: false,
      render: (row) =>
        editingId === row.id ? (
          <button
            onClick={() => handleSaveRole(row.id)}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            Save
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingId(row.id);
                setEditRole(row.role);
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              Edit Role
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleToggleStatus(row); }}
              className="text-xs text-slate-400 hover:text-white"
            >
              {row.status === 'active' ? 'Ban' : 'Activate'}
            </button>
          </div>
        ),
    },
  ];

  const filteredData = useMemo(() => {
    let data = [...users];
    if (roleFilter) data = data.filter((u) => u.role === roleFilter);
    if (statusFilter) data = data.filter((u) => u.status === statusFilter);
    return data;
  }, [users, roleFilter, statusFilter]);

  const stats = {
    total: users.length,
    activeThisWeek: users.filter((u) => new Date(u.lastSeen) > new Date(Date.now() - 7 * 86400000)).length,
    newThisMonth: users.filter(() => true).length,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-slate-400 mt-1">Loading users...</p>
        </div>
        <Loading.StatsGrid count={3} />
        <Loading.Table rows={6} columns={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-slate-400 mt-1">Manage community members, roles, and status</p>
        </div>
        <SectionError
          title="Failed to load users"
          message="There was an error loading the users. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-slate-400 mt-1">Manage community members, roles, and status</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard title="Total Users" value={stats.total.toString()} color="cyan" size="sm" />
        <MetricCard title="Active This Week" value={stats.activeThisWeek.toString()} color="green" size="sm" />
        <MetricCard title="New This Month" value={stats.newThisMonth.toString()} color="violet" size="sm" />
      </div>

      <div className="glass-card p-4 flex flex-wrap gap-3">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
        >
          <option value="">All Roles</option>
          <option value="user">User</option>
          <option value="moderator">Moderator</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="banned">Banned</option>
        </select>
        {(roleFilter || statusFilter) && (
          <button
            onClick={() => { setRoleFilter(''); setStatusFilter(''); }}
            className="px-3 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <DataTable
        data={filteredData}
        columns={columns}
        keyExtractor={(row) => row.id}
        searchable
        searchKeys={['username', 'email', 'role']}
        pagination
        pageSize={6}
        emptyMessage="No users found"
      />
    </div>
  );
}
