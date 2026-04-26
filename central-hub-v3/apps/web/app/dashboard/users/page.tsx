'use client';

import React, { useState, useMemo } from 'react';
import { DataTable, type Column } from '@/app/components/ui';
import { MetricCard } from '@/app/components/ui';
import { StatusBadge } from '@/app/components/ui';

interface UserItem {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin' | 'moderator';
  lastSeen: string;
  status: 'active' | 'inactive' | 'banned';
}

const mockUsers: UserItem[] = [
  { id: '1', username: 'alice', email: 'alice@example.com', role: 'admin', lastSeen: '2026-04-26T08:00:00Z', status: 'active' },
  { id: '2', username: 'bob', email: 'bob@example.com', role: 'moderator', lastSeen: '2026-04-25T20:30:00Z', status: 'active' },
  { id: '3', username: 'charlie', email: 'charlie@example.com', role: 'user', lastSeen: '2026-04-24T14:15:00Z', status: 'active' },
  { id: '4', username: 'dave', email: 'dave@example.com', role: 'user', lastSeen: '2026-04-20T10:00:00Z', status: 'inactive' },
  { id: '5', username: 'eve', email: 'eve@example.com', role: 'user', lastSeen: '2026-04-22T18:45:00Z', status: 'banned' },
  { id: '6', username: 'frank', email: 'frank@example.com', role: 'user', lastSeen: '2026-04-26T07:00:00Z', status: 'active' },
  { id: '7', username: 'grace', email: 'grace@example.com', role: 'moderator', lastSeen: '2026-04-26T06:30:00Z', status: 'active' },
  { id: '8', username: 'heidi', email: 'heidi@example.com', role: 'user', lastSeen: '2026-04-26T05:00:00Z', status: 'active' },
];

export default function UsersPage() {
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [users, setUsers] = useState<UserItem[]>([...mockUsers]);

  const toggleStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        const next = u.status === 'active' ? 'inactive' : u.status === 'inactive' ? 'active' : 'active';
        return { ...u, status: next };
      })
    );
  };

  const saveRole = (id: string) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: editRole as UserItem['role'] } : u)));
    setEditingId(null);
  };

  const columns: Column<UserItem>[] = [
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
            onClick={() => saveRole(row.id)}
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
              onClick={(e) => { e.stopPropagation(); toggleStatus(row.id); }}
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
    newThisMonth: users.filter((u) => true).length,
  };

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
