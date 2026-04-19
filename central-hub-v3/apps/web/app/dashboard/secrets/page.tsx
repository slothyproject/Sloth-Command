/**
 * Encrypted Secrets Vault
 * Secure management of service secrets and sensitive variables
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useSecrets, useCreateSecret, useUpdateSecret, useDeleteSecret, useRotateSecret, useBulkImportSecrets } from '@/app/hooks/use-secrets';
import { useServices } from '@/app/hooks/use-services';
import { StatusBadge } from '@/app/components/ui';
import { cn } from '@/app/lib/utils';
import { useToast } from '@/app/components/providers/toast-provider';

// Types
interface Secret {
  id: string;
  key: string;
  value?: string;
  serviceId?: string;
  serviceName?: string;
  category: 'discord' | 'database' | 'api' | 'jwt' | 'oauth' | 'other';
  isEncrypted: boolean;
  required: boolean;
  description?: string;
  lastRotated?: string;
  createdAt: string;
  updatedAt: string;
}

const categories = [
  { id: 'discord', name: 'Discord', icon: '💬', color: 'bg-indigo-500/20 text-indigo-400' },
  { id: 'database', name: 'Database', icon: '🗄️', color: 'bg-green-500/20 text-green-400' },
  { id: 'api', name: 'API Keys', icon: '🔑', color: 'bg-yellow-500/20 text-yellow-400' },
  { id: 'jwt', name: 'JWT/Auth', icon: '🛡️', color: 'bg-red-500/20 text-red-400' },
  { id: 'oauth', name: 'OAuth', icon: '🔐', color: 'bg-blue-500/20 text-blue-400' },
  { id: 'other', name: 'Other', icon: '📦', color: 'bg-slate-500/20 text-slate-400' },
];

export default function SecretsVaultPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  
  const { toast } = useToast();
  
  // Fetch data
  const { data: secrets, isLoading } = useSecrets();
  const { data: services } = useServices();
  
  // Mutations
  const createSecret = useCreateSecret();
  const updateSecret = useUpdateSecret();
  const deleteSecret = useDeleteSecret();
  const rotateSecret = useRotateSecret();
  const bulkImport = useBulkImportSecrets();
  
  // Filter secrets
  const filteredSecrets = React.useMemo(() => {
    if (!secrets) return [];
    
    return secrets.filter((secret: Secret) => {
      const matchesSearch = 
        secret.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        secret.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        secret.serviceName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = !selectedCategory || secret.category === selectedCategory;
      const matchesService = !selectedService || secret.serviceId === selectedService;
      
      return matchesSearch && matchesCategory && matchesService;
    });
  }, [secrets, searchQuery, selectedCategory, selectedService]);
  
  // Group secrets by category
  const secretsByCategory = React.useMemo(() => {
    const grouped: Record<string, Secret[]> = {};
    categories.forEach(cat => grouped[cat.id] = []);
    
    filteredSecrets.forEach((secret: Secret) => {
      if (!grouped[secret.category]) grouped[secret.category] = [];
      grouped[secret.category].push(secret);
    });
    
    return grouped;
  }, [filteredSecrets]);
  
  // Stats
  const stats = React.useMemo(() => {
    if (!secrets) return { total: 0, encrypted: 0, missing: 0, byCategory: {} };
    
    return {
      total: secrets.length,
      encrypted: secrets.filter((s: Secret) => s.isEncrypted).length,
      missing: secrets.filter((s: Secret) => s.required && !s.value).length,
      byCategory: categories.reduce((acc, cat) => {
        acc[cat.id] = secrets.filter((s: Secret) => s.category === cat.id).length;
        return acc;
      }, {} as Record<string, number>),
    };
  }, [secrets]);
  
  // Toggle secret visibility
  const toggleReveal = useCallback((secretId: string) => {
    setRevealedSecrets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(secretId)) {
        newSet.delete(secretId);
      } else {
        newSet.add(secretId);
      }
      return newSet;
    });
  }, []);
  
  // Copy to clipboard
  const copyToClipboard = useCallback(async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copied to clipboard', `${key} has been copied`);
    } catch {
      toast.error('Failed to copy', 'Please copy manually');
    }
  }, [toast]);
  
  // Handle secret rotation
  const handleRotate = useCallback(async (secretId: string) => {
    try {
      await rotateSecret.mutateAsync(secretId);
      toast.success('Secret rotated', 'New value generated and encrypted');
    } catch {
      toast.error('Rotation failed', 'Could not rotate secret');
    }
  }, [rotateSecret, toast]);
  
  // Handle delete
  const handleDelete = useCallback(async (secretId: string, key: string) => {
    if (!confirm(`Are you sure you want to delete "${key}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      await deleteSecret.mutateAsync(secretId);
      toast.success('Secret deleted', `${key} has been removed`);
    } catch {
      toast.error('Delete failed', 'Could not delete secret');
    }
  }, [deleteSecret, toast]);
  
  if (isLoading) {
    return <SecretsVaultSkeleton />;
  }
  
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </span>
            Secrets Vault
          </h1>
          <p className="text-slate-400 mt-1">
            {stats.encrypted} of {stats.total} secrets encrypted • {stats.missing} missing
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Bulk Import
          </button>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-medium hover:opacity-90 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Secret
          </button>
        </div>
      </div>
      
      {/* Security Warning */}
      {stats.missing > 0 && (
        <div className="glass-card p-4 border-l-4 border-red-500 bg-red-500/10">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-red-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-medium text-white">Missing Required Secrets</h3>
              <p className="text-slate-400 text-sm mt-1">
                {stats.missing} required secret(s) are not configured. Some services may not function correctly.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Category Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
            className={cn(
              "glass-card p-4 text-left transition-all",
              selectedCategory === cat.id && "ring-2 ring-cyan-500/50",
              stats.byCategory[cat.id] === 0 && "opacity-50"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{cat.icon}</span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full", cat.color)}>
                {stats.byCategory[cat.id] || 0}
              </span>
            </div>
            <div className="font-medium text-white">{cat.name}</div>
          </button>
        ))}
      </div>
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search secrets..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-900/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-yellow-500"
          />
        </div>
        
        <select
          value={selectedService || ''}
          onChange={(e) => setSelectedService(e.target.value || null)}
          className="px-4 py-2 rounded-lg bg-slate-900/50 border border-white/10 text-white focus:outline-none focus:border-yellow-500"
        >
          <option value="">All Services</option>
          {services?.map((service: any) => (
            <option key={service.id} value={service.id}>{service.name}</option>
          ))}
        </select>
      </div>
      
      {/* Secrets List */}
      <div className="space-y-6">
        {categories.map(category => {
          const catSecrets = secretsByCategory[category.id];
          if (catSecrets.length === 0) return null;
          
          return (
            <div key={category.id} className="glass-card overflow-hidden">
              <div className={cn("px-6 py-4 border-b border-white/10 flex items-center gap-3", category.color)}>
                <span className="text-2xl">{category.icon}</span>
                <h3 className="font-semibold">{category.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10">
                  {catSecrets.length}
                </span>
              </div>
              
              <div className="divide-y divide-white/5">
                {catSecrets.map((secret: Secret) => (
                  <SecretRow
                    key={secret.id}
                    secret={secret}
                    isRevealed={revealedSecrets.has(secret.id)}
                    onToggleReveal={() => toggleReveal(secret.id)}
                    onCopy={() => secret.value && copyToClipboard(secret.value, secret.key)}
                    onEdit={() => setEditingSecret(secret)}
                    onRotate={() => handleRotate(secret.id)}
                    onDelete={() => handleDelete(secret.id, secret.key)}
                    isRotating={rotateSecret.isPending && rotateSecret.variables === secret.id}
                  />
                ))}
              </div>
            </div>
          );
        })}
        
        {filteredSecrets.length === 0 && (
          <div className="glass-card p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No secrets found</h3>
            <p className="text-slate-400">
              {searchQuery || selectedCategory || selectedService
                ? 'Try adjusting your filters'
                : 'Add your first secret to get started'}
            </p>
          </div>
        )}
      </div>
      
      {/* Modals */}
      {showCreateModal && (
        <SecretModal
          services={services || []}
          onSave={async (data) => {
            await createSecret.mutateAsync(data);
            setShowCreateModal(false);
            toast.success('Secret created', `${data.key} has been added securely`);
          }}
          onClose={() => setShowCreateModal(false)}
          isSaving={createSecret.isPending}
        />
      )}
      
      {editingSecret && (
        <SecretModal
          secret={editingSecret}
          services={services || []}
          onSave={async (data) => {
            await updateSecret.mutateAsync({ id: editingSecret.id, data });
            setEditingSecret(null);
            toast.success('Secret updated', `${data.key} has been updated`);
          }}
          onClose={() => setEditingSecret(null)}
          isSaving={updateSecret.isPending}
        />
      )}
      
      {showImportModal && (
        <BulkImportModal
          services={services || []}
          onImport={async (secrets) => {
            await bulkImport.mutateAsync(secrets);
            setShowImportModal(false);
            toast.success('Import complete', `${secrets.length} secrets imported`);
          }}
          onClose={() => setShowImportModal(false)}
          isImporting={bulkImport.isPending}
        />
      )}
    </div>
  );
}

// Sub-components
function SecretRow({ 
  secret, 
  isRevealed, 
  onToggleReveal, 
  onCopy, 
  onEdit, 
  onRotate, 
  onDelete,
  isRotating 
}: {
  secret: Secret;
  isRevealed: boolean;
  onToggleReveal: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onRotate: () => void;
  onDelete: () => void;
  isRotating: boolean;
}) {
  const [showValue, setShowValue] = useState(false);
  
  const isMissing = secret.required && !secret.value;
  
  return (
    <div className={cn(
      "px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors",
      isMissing && "bg-red-500/5"
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-white">{secret.key}</span>
          {secret.required && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Required</span>
          )}
          {secret.isEncrypted && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">Encrypted</span>
          )}
          {isMissing && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Missing</span>
          )}
        </div>
        
        {secret.serviceName && (
          <div className="text-sm text-slate-400 mb-1">
            Service: {secret.serviceName}
          </div>
        )}
        
        {secret.description && (
          <div className="text-sm text-slate-500">
            {secret.description}
          </div>
        )}
        
        {/* Value display */}
        {!isMissing && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 font-mono text-sm text-slate-400 bg-slate-900/50 px-3 py-1.5 rounded">
              {isRevealed ? secret.value : '•'.repeat(20)}
            </div>
            <button
              onClick={onToggleReveal}
              className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
              title={isRevealed ? 'Hide' : 'Reveal'}
            >
              {isRevealed ? (
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
            <button
              onClick={onCopy}
              className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
              title="Copy"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-1 ml-4">
        <button
          onClick={onEdit}
          className="p-2 rounded hover:bg-white/10 text-slate-400 hover:text-white"
          title="Edit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.433-4.932L18 9.932M14 7.93l4.868 4.868M14 7.93l2.12-2.12a2.5 2.5 0 013.535 0l.707.707a2.5 2.5 0 010 3.535L18 13.12" />
          </svg>
        </button>
        <button
          onClick={onRotate}
          disabled={isRotating}
          className="p-2 rounded hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-50"
          title="Rotate Secret"
        >
          {isRotating ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
        </button>
        <button
          onClick={onDelete}
          className="p-2 rounded hover:bg-white/10 text-red-400 hover:text-red-300"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function SecretModal({ secret, services, onSave, onClose, isSaving }: {
  secret?: Secret;
  services: any[];
  onSave: (data: any) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    key: secret?.key || '',
    value: secret?.value || '',
    serviceId: secret?.serviceId || '',
    category: secret?.category || 'other',
    required: secret?.required ?? true,
    description: secret?.description || '',
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative glass-card max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-white mb-4">
          {secret ? 'Edit Secret' : 'Add New Secret'}
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Key Name *</label>
            <input
              type="text"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              placeholder="e.g., DISCORD_TOKEN"
              className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-white/10 text-white focus:outline-none focus:border-yellow-500 font-mono"
              required
              disabled={!!secret}
            />
          </div>
          
          <div>
            <label className="block text-sm text-slate-400 mb-1">Value {secret ? '' : '*'}</label>
            <textarea
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              placeholder={secret ? 'Leave empty to keep current value' : 'Enter secret value'}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-white/10 text-white focus:outline-none focus:border-yellow-500 font-mono"
              required={!secret}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-white/10 text-white focus:outline-none focus:border-yellow-500"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-slate-400 mb-1">Service (Optional)</label>
              <select
                value={formData.serviceId}
                onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-white/10 text-white focus:outline-none focus:border-yellow-500"
              >
                <option value="">Global (All Services)</option>
                {services.map((service: any) => (
                  <option key={service.id} value={service.id}>{service.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-slate-400 mb-1">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What is this secret used for?"
              className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-white/10 text-white focus:outline-none focus:border-yellow-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="required"
              checked={formData.required}
              onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-yellow-500"
            />
            <label htmlFor="required" className="text-sm text-slate-300">
              Required - Service will fail without this secret
            </label>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving && (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {secret ? 'Update Secret' : 'Add Secret'}
          </button>
        </div>
      </form>
    </div>
  );
}

function BulkImportModal({ services, onImport, onClose, isImporting }: {
  services: any[];
  onImport: (secrets: any[]) => void;
  onClose: () => void;
  isImporting: boolean;
}) {
  const [importText, setImportText] = useState('');
  const [parsedSecrets, setParsedSecrets] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const parseEnvFile = (text: string) => {
    const secrets: any[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        secrets.push({
          key: key.trim(),
          value: value.trim().replace(/^["']|["']$/g, ''),
          category: detectCategory(key.trim()),
          required: true,
        });
      }
    }
    
    return secrets;
  };
  
  const detectCategory = (key: string): string => {
    const lower = key.toLowerCase();
    if (lower.includes('discord')) return 'discord';
    if (lower.includes('database') || lower.includes('postgres') || lower.includes('mongodb')) return 'database';
    if (lower.includes('jwt') || lower.includes('auth') || lower.includes('session')) return 'jwt';
    if (lower.includes('api_key') || lower.includes('token') || lower.includes('secret')) return 'api';
    if (lower.includes('oauth') || lower.includes('client_id') || lower.includes('client_secret')) return 'oauth';
    return 'other';
  };
  
  const handleParse = () => {
    try {
      const secrets = parseEnvFile(importText);
      setParsedSecrets(secrets);
      setError(null);
    } catch (err) {
      setError('Failed to parse .env file');
      setParsedSecrets([]);
    }
  };
  
  const handleImport = () => {
    onImport(parsedSecrets);
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-white mb-4">Bulk Import Secrets</h3>
        
        <p className="text-slate-400 text-sm mb-4">
          Paste the contents of your .env file below. We'll automatically detect and categorize your secrets.
        </p>
        
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="# Paste .env content here&#10;DISCORD_TOKEN=your_token_here&#10;DATABASE_URL=postgres://..."
          rows={8}
          className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-yellow-500 font-mono text-sm"
        />
        
        <button
          onClick={handleParse}
          disabled={!importText.trim()}
          className="mt-4 px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50"
        >
          Parse Secrets
        </button>
        
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}
        
        {parsedSecrets.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium text-white mb-2">Found {parsedSecrets.length} secrets:</h4>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {parsedSecrets.map((secret, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm p-2 rounded bg-white/5">
                  <span className="font-mono text-yellow-400">{secret.key}</span>
                  <span className="text-slate-500">=</span>
                  <span className="text-slate-400">••••••••</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded bg-white/10 text-slate-400">
                    {categories.find(c => c.id === secret.category)?.name}
                  </span>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={onClose}
                disabled={isImporting}
                className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting || parsedSecrets.length === 0}
                className="px-4 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 flex items-center gap-2 disabled:opacity-50"
              >
                {isImporting && (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                Import {parsedSecrets.length} Secrets
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SecretsVaultSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-12 bg-slate-800 rounded animate-pulse" />
      <div className="grid grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-800 rounded animate-pulse" />
        ))}
      </div>
      <div className="h-96 bg-slate-800 rounded animate-pulse" />
    </div>
  );
}
