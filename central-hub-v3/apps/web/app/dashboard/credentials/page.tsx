/**
 * Credentials Page
 * AES-256-GCM encrypted token vault — add, view metadata, delete
 */

'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';
import { cn } from '@/app/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Credential {
  id: string;
  serviceType: string;
  name: string;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Service type options ───────────────────────────────────────────────────────

const SERVICE_TYPES = [
  { value: 'discord', label: 'Discord', icon: '💬' },
  { value: 'railway', label: 'Railway', icon: '🚂' },
  { value: 'github', label: 'GitHub', icon: '🐙' },
  { value: 'openai', label: 'OpenAI', icon: '🤖' },
  { value: 'anthropic', label: 'Anthropic', icon: '🧠' },
  { value: 'database', label: 'Database', icon: '🗄️' },
  { value: 'webhook', label: 'Webhook', icon: '🪝' },
  { value: 'other', label: 'Other', icon: '🔑' },
];

function serviceLabel(type: string) {
  return SERVICE_TYPES.find(s => s.value === type) ?? { label: type, icon: '🔑' };
}

// ── Add Credential Modal ───────────────────────────────────────────────────────

interface AddModalProps {
  onClose: () => void;
  onAdd: (data: { serviceType: string; name: string; token: string; expiresAt?: string }) => void;
  isLoading: boolean;
}

function AddCredentialModal({ onClose, onAdd, isLoading }: AddModalProps) {
  const [form, setForm] = useState({ serviceType: 'discord', name: '', token: '', expiresAt: '' });
  const [showToken, setShowToken] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.token.trim()) return;
    onAdd({
      serviceType: form.serviceType,
      name: form.name.trim(),
      token: form.token.trim(),
      expiresAt: form.expiresAt || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-elevated border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-4">Add Credential</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Service Type</label>
            <select
              value={form.serviceType}
              onChange={e => setForm(f => ({ ...f, serviceType: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
            >
              {SERVICE_TYPES.map(s => (
                <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Name / Label</label>
            <input
              type="text"
              placeholder="e.g. Production Bot Token"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Token / Secret</label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                placeholder="Paste your secret here"
                value={form.token}
                onChange={e => setForm(f => ({ ...f, token: e.target.value }))}
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowToken(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                {showToken ? (
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
            </div>
            <p className="text-xs text-slate-500 mt-1">Encrypted with AES-256-GCM before storage. Never stored in plaintext.</p>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Expires At <span className="text-slate-600">(optional)</span></label>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-slate-400 hover:bg-white/5 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !form.name.trim() || !form.token.trim()}
              className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-medium text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {isLoading ? 'Saving…' : 'Save Encrypted'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CredentialsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['credentials'],
    queryFn: async () => {
      const resp = await api.credentials.list();
      return resp.data.data as Credential[];
    },
  });

  const credentials = data ?? [];

  const addMutation = useMutation({
    mutationFn: (payload: { serviceType: string; name: string; token: string; expiresAt?: string }) =>
      api.credentials.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      setShowAddModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.credentials.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      setDeleteConfirmId(null);
    },
  });

  // Group by service type
  const grouped = credentials.reduce<Record<string, Credential[]>>((acc, c) => {
    (acc[c.serviceType] ??= []).push(c);
    return acc;
  }, {});

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function isExpired(iso?: string) {
    return iso ? new Date(iso) < new Date() : false;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Credentials</h1>
          <p className="text-slate-400 text-sm mt-1">
            AES-256-GCM encrypted token vault · tokens never stored in plaintext
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Credential
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: credentials.length, color: 'text-cyan-400' },
          {
            label: 'Expiring Soon',
            value: credentials.filter(c => c.expiresAt && !isExpired(c.expiresAt) && new Date(c.expiresAt) < new Date(Date.now() + 7 * 86400 * 1000)).length,
            color: 'text-yellow-400',
          },
          {
            label: 'Expired',
            value: credentials.filter(c => isExpired(c.expiresAt)).length,
            color: 'text-red-400',
          },
        ].map(stat => (
          <div key={stat.label} className="glass-card p-4">
            <div className={cn('text-2xl font-bold', stat.color)}>{stat.value}</div>
            <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="glass-card p-12 text-center text-slate-400">Loading credentials…</div>
      ) : isError ? (
        <div className="glass-card p-12 text-center text-red-400">Failed to load credentials.</div>
      ) : credentials.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-3">
          <div className="text-4xl">🔐</div>
          <p className="text-slate-400">No credentials stored yet.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-cyan-400 hover:text-cyan-300 text-sm"
          >
            Add your first credential →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, items]) => {
            const svc = serviceLabel(type);
            return (
              <div key={type} className="glass-card overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                  <span className="text-lg">{svc.icon}</span>
                  <span className="font-medium text-white">{svc.label}</span>
                  <span className="ml-auto text-xs text-slate-500">{items.length} credential{items.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-white/5">
                  {items.map(cred => (
                    <div key={cred.id} className="px-4 py-3 flex items-center gap-4 hover:bg-white/3 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium truncate">{cred.name}</span>
                          {isExpired(cred.expiresAt) && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded border border-red-500/30">
                              EXPIRED
                            </span>
                          )}
                          {cred.expiresAt && !isExpired(cred.expiresAt) && new Date(cred.expiresAt) < new Date(Date.now() + 7 * 86400 * 1000) && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30">
                              EXPIRES SOON
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-0.5 text-xs text-slate-500">
                          <span>Added {formatDate(cred.createdAt)}</span>
                          {cred.expiresAt && <span>Expires {formatDate(cred.expiresAt)}</span>}
                          {cred.lastUsedAt && <span>Last used {formatDate(cred.lastUsedAt)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30 font-mono">
                          AES-256-GCM
                        </span>
                        {deleteConfirmId === cred.id ? (
                          <div className="flex items-center gap-2 ml-2">
                            <span className="text-xs text-slate-400">Confirm?</span>
                            <button
                              onClick={() => deleteMutation.mutate(cred.id)}
                              disabled={deleteMutation.isPending}
                              className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-1 text-xs text-slate-400 rounded hover:bg-white/5 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(cred.id)}
                            className="ml-2 p-1.5 text-slate-500 hover:text-red-400 rounded transition-colors"
                            title="Delete credential"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddCredentialModal
          onClose={() => setShowAddModal(false)}
          onAdd={addMutation.mutate}
          isLoading={addMutation.isPending}
        />
      )}
    </div>
  );
}
