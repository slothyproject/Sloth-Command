/**
 * Services List Page
 * Grid and list view of all services
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useServices, useSyncServices } from '@/app/hooks/use-services';
import { cn, formatTimeAgo, getStatusColor, getStatusIcon } from '@/app/lib/utils';

interface Service {
  id: string;
  name: string;
  description?: string;
  status: string;
  cpuPercent?: number;
  memoryPercent?: number;
  lastDeploymentAt?: string;
  url?: string;
}

export default function ServicesPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  
  const { data: services, isLoading, error } = useServices();
  const syncMutation = useSyncServices();
  
  // Filter services
  const filteredServices = services?.filter((service) =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Toggle selection
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedServices);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedServices(newSet);
  };
  
  // Select all
  const selectAll = () => {
    if (selectedServices.size === filteredServices?.length) {
      setSelectedServices(new Set());
    } else {
      setSelectedServices(new Set(filteredServices?.map((s) => s.id) || []));
    }
  };
  
  if (isLoading) {
    return <ServicesSkeleton viewMode={viewMode} />;
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Failed to load services</h2>
          <p className="text-slate-400">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 btn-primary px-4 py-2 rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Services</h1>
          <p className="text-slate-400 mt-1">
            Manage {services?.length || 0} services across your projects
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className={cn(
              "btn-glass px-4 py-2 rounded-lg flex items-center gap-2",
              syncMutation.isPending && "opacity-50 cursor-not-allowed"
            )}
          >
            {syncMutation.isPending ? (
              <>
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync
              </>
            )}
          </button>
          
          <Link
            href="/dashboard/services/new"
            className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Service
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg input-glass text-white placeholder-slate-500 focus:outline-none"
            />
          </div>
          
          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 rounded-lg transition-colors",
                viewMode === 'grid' 
                  ? "bg-cyan-500/20 text-cyan-400" 
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
              title="Grid view"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={2} />
                <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={2} />
                <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={2} />
                <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={2} />
              </svg>
            </button>
            
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-lg transition-colors",
                viewMode === 'list' 
                  ? "bg-cyan-500/20 text-cyan-400" 
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
              title="List view"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedServices.size > 0 && (
        <div className="glass-card p-4 flex items-center justify-between">
          <span className="text-slate-300">
            {selectedServices.size} service{selectedServices.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded btn-glass text-sm">
              Restart
            </button>
            <button className="px-3 py-1.5 rounded btn-glass text-sm">
              Deploy
            </button>
            <button 
              onClick={() => setSelectedServices(new Set())}
              className="px-3 py-1.5 rounded text-slate-400 hover:text-white text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Services Grid/List */}
      {filteredServices?.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-slate-400">No services found</p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-cyan-400 hover:text-cyan-300"
            >
              Clear search
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices?.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              isSelected={selectedServices.has(service.id)}
              onToggle={() => toggleSelection(service.id)}
            />
          ))}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-white/10">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      (filteredServices?.length ?? 0) > 0 && 
                      selectedServices.size === (filteredServices?.length ?? 0)
                    }
                    onChange={selectAll}
                    className="rounded border-slate-600"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Service</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">CPU / Memory</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Last Deploy</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices?.map((service) => (
                <ServiceRow
                  key={service.id}
                  service={service}
                  isSelected={selectedServices.has(service.id)}
                  onToggle={() => toggleSelection(service.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Service Card Component
function ServiceCard({ 
  service, 
  isSelected, 
  onToggle 
}: { 
  service: Service; 
  isSelected: boolean;
  onToggle: () => void;
}) {
  const statusColor = getStatusColor(service.status);
  
  return (
    <div
      className={cn(
        "glass-card p-5 transition-all",
        isSelected && "ring-2 ring-cyan-500"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            className="rounded border-slate-600"
          />
          <div className={`w-3 h-3 rounded-full ${statusColor}`} />
        </div>
        
        <div className="flex items-center gap-1">
          <Link
            href={`/dashboard/services/${service.id}`}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </Link>
        </div>
      </div>
      
      <Link href={`/dashboard/services/${service.id}`} className="block">
        <h3 className="text-lg font-semibold text-white mb-1">{service.name}</h3>
        
        {service.description && (
          <p className="text-sm text-slate-400 mb-3 line-clamp-2">{service.description}</p>
        )}
      </Link>
      
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10">
        <div className="flex-1">
          <p className="text-xs text-slate-400 mb-1">CPU</p>
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-violet-500"
              style={{ width: `${service.cpuPercent || 0}%` }}
            />
          </div>
          <p className="text-xs text-slate-300 mt-1">{service.cpuPercent || 0}%</p>
        </div>
        
        <div className="flex-1">
          <p className="text-xs text-slate-400 mb-1">Memory</p>
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-violet-500"
              style={{ width: `${service.memoryPercent || 0}%` }}
            />
          </div>
          <p className="text-xs text-slate-300 mt-1">{service.memoryPercent || 0}%</p>
        </div>
      </div>
      
      {service.lastDeploymentAt && (
        <p className="text-xs text-slate-500 mt-3">
          Deployed {formatTimeAgo(service.lastDeploymentAt)}
        </p>
      )}
    </div>
  );
}

// Service Row Component (List view)
function ServiceRow({
  service,
  isSelected,
  onToggle,
}: {
  service: Service;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const statusColor = getStatusColor(service.status);
  
  return (
    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
      <td className="px-4 py-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="rounded border-slate-600"
        />
      </td>
      
      <td className="px-4 py-4">
        <Link href={`/dashboard/services/${service.id}`} className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${statusColor}`} />
          <div>
            <p className="font-medium text-white">{service.name}</p>
            {service.url && (
              <p className="text-xs text-slate-400">{service.url}</p>
            )}
          </div>
        </Link>
      </td>
      
      <td className="px-4 py-4">
        <span className={cn(
          "px-2 py-1 rounded text-xs font-medium capitalize",
          statusColor
        )}>
          {service.status}
        </span>
      </td>
      
      <td className="px-4 py-4">
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-300">
            CPU: {service.cpuPercent || 0}%
          </div>
          <div className="text-sm text-slate-300">
            Memory: {service.memoryPercent || 0}%
          </div>
        </div>
      </td>
      
      <td className="px-4 py-4">
        <span className="text-sm text-slate-400">
          {service.lastDeploymentAt 
            ? formatTimeAgo(service.lastDeploymentAt) 
            : 'Never'}
        </span>
      </td>
      
      <td className="px-4 py-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/dashboard/services/${service.id}`}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </Link>
        </div>
      </td>
    </tr>
  );
}

// Loading Skeleton
function ServicesSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-card p-5">
            <div className="skeleton h-4 w-1/2 mb-4 rounded" />
            <div className="skeleton h-3 w-full mb-2 rounded" />
            <div className="skeleton h-3 w-3/4 mb-4 rounded" />
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="skeleton h-2 w-full rounded-full mb-1" />
              </div>
              <div className="flex-1">
                <div className="skeleton h-2 w-full rounded-full mb-1" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <div className="skeleton h-8 w-full rounded" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="p-4 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="skeleton w-4 h-4 rounded" />
            <div className="skeleton h-4 w-32 rounded" />
            <div className="skeleton h-4 w-20 rounded ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}
