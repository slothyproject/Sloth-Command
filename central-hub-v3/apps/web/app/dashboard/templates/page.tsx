/**
 * Service Templates Page
 * One-click deployment templates for Discord bots, APIs, and websites
 */

'use client';

import React, { useState } from 'react';
import { useServiceTemplates, useCreateFromTemplate, type ServiceTemplate } from '@/app/hooks/use-automation';
import { useServices } from '@/app/hooks/use-services';
import { useSecrets } from '@/app/hooks/use-automation';
import { StatusBadge } from '@/app/components/ui';
import { useToast } from '@/app/components/providers/toast-provider';
import { cn } from '@/app/lib/utils';
import Link from 'next/link';

interface DeployConfig {
  name: string;
  variables: Record<string, string>;
}

export default function TemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<ServiceTemplate | null>(null);
  const [deployConfig, setDeployConfig] = useState<DeployConfig>({ name: '', variables: {} });
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'discord' | 'api' | 'website'>('all');
  
  const { toast } = useToast();
  const { data: templates, isLoading } = useServiceTemplates();
  const { data: existingServices } = useServices();
  const { data: secrets } = useSecrets();
  const createFromTemplate = useCreateFromTemplate();
  
  // Filter templates by category
  const filteredTemplates = React.useMemo(() => {
    if (!templates) return [];
    if (activeTab === 'all') return templates;
    return templates.filter(t => t.type === activeTab);
  }, [templates, activeTab]);
  
  // Check if service name already exists
  const nameExists = React.useMemo(() => {
    return existingServices?.some((s: any) => 
      s.name.toLowerCase() === deployConfig.name.toLowerCase()
    );
  }, [existingServices, deployConfig.name]);
  
  // Handle template selection
  const handleSelectTemplate = (template: ServiceTemplate) => {
    setSelectedTemplate(template);
    
    // Pre-fill variables from existing secrets
    const prefilledVars: Record<string, string> = {};
    template.defaultConfig.variables.forEach((variable: any) => {
      const existingSecret = secrets?.find((s: any) => s.key === variable.key);
      if (existingSecret?.value) {
        prefilledVars[variable.key] = existingSecret.value;
      }
    });
    
    setDeployConfig({
      name: '',
      variables: prefilledVars,
    });
    setShowDeployModal(true);
  };
  
  // Handle deployment
  const handleDeploy = async () => {
    if (!selectedTemplate || !deployConfig.name) return;
    
    if (nameExists) {
      toast.error('Service name already exists', 'Please choose a different name');
      return;
    }
    
    try {
      await createFromTemplate.mutateAsync({
        templateId: selectedTemplate.id,
        name: deployConfig.name,
        variables: deployConfig.variables,
      });
      
      toast.success(
        'Service created!',
        `${deployConfig.name} is being deployed. Check Mission Control for status.`
      );
      
      setShowDeployModal(false);
      setSelectedTemplate(null);
      setDeployConfig({ name: '', variables: {} });
    } catch (error) {
      toast.error('Deployment failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };
  
  // Check if all required variables are filled
  const canDeploy = React.useMemo(() => {
    if (!selectedTemplate || !deployConfig.name) return false;
    
    return selectedTemplate.defaultConfig.variables
      .filter((v: any) => v.required)
      .every((v: any) => deployConfig.variables[v.key]?.trim());
  }, [selectedTemplate, deployConfig]);
  
  if (isLoading) {
    return <TemplatesSkeleton />;
  }
  
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM5 13a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zM5 21a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2z" />
              </svg>
            </span>
            Service Templates
          </h1>
          <p className="text-slate-400 mt-1">
            One-click deployment for common service types
          </p>
        </div>
        
        <Link
          href="/dashboard/mission-control"
          className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 flex items-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Go to Mission Control
        </Link>
      </div>
      
      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'All Templates', count: templates?.length || 0 },
          { id: 'discord', label: 'Discord Bots', count: templates?.filter((t: any) => t.type === 'discord-bot').length || 0 },
          { id: 'api', label: 'API Backends', count: templates?.filter((t: any) => t.type === 'api-backend').length || 0 },
          { id: 'website', label: 'Websites', count: templates?.filter((t: any) => t.type === 'website').length || 0 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2",
              activeTab === tab.id
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            )}
          >
            {tab.label}
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs">
              {tab.count}
            </span>
          </button>
        ))}
      </div>
      
      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onSelect={() => handleSelectTemplate(template)}
          />
        ))}
      </div>
      
      {filteredTemplates.length === 0 && (
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM5 13a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zM5 21a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No templates found</h3>
          <p className="text-slate-400">
            No templates available for this category
          </p>
        </div>
      )}
      
      {/* Deploy Modal */}
      {showDeployModal && selectedTemplate && (
        <DeployModal
          template={selectedTemplate}
          config={deployConfig}
          setConfig={setDeployConfig}
          onDeploy={handleDeploy}
          onClose={() => {
            setShowDeployModal(false);
            setSelectedTemplate(null);
          }}
          isDeploying={createFromTemplate.isPending}
          canDeploy={canDeploy}
          nameExists={!!nameExists}
          existingSecrets={secrets || []}
        />
      )}
    </div>
  );
}

// Sub-components
function TemplateCard({ template, onSelect }: {
  template: ServiceTemplate;
  onSelect: () => void;
}) {
  const typeColors: Record<string, string> = {
    'discord-bot': 'from-indigo-500 to-purple-500',
    'api-backend': 'from-green-500 to-teal-500',
    'website': 'from-cyan-500 to-blue-500',
  };
  
  const typeLabels: Record<string, string> = {
    'discord-bot': 'Discord Bot',
    'api-backend': 'API Backend',
    'website': 'Website',
  };
  
  const requiredVars = template.defaultConfig.variables.filter((v: any) => v.required).length;
  const optionalVars = template.defaultConfig.variables.length - requiredVars;
  
  return (
    <div className="glass-card overflow-hidden hover:bg-white/5 transition-colors group">
      {/* Header */}
      <div className={cn("h-32 bg-gradient-to-br flex items-center justify-center", typeColors[template.type])}>
        <span className="text-6xl">{template.icon}</span>
      </div>
      
      {/* Content */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-white">{template.name}</h3>
          <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-slate-400">
            {typeLabels[template.type]}
          </span>
        </div>
        
        <p className="text-slate-400 text-sm mb-4 line-clamp-2">
          {template.description}
        </p>
        
        {/* Features */}
        <div className="space-y-2 mb-4">
          {template.defaultConfig.healthCheck && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Health monitoring included
            </div>
          )}
          {template.defaultConfig.healingRules && template.defaultConfig.healingRules.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              Auto-healing enabled
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {requiredVars} required, {optionalVars} optional variables
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <div className="text-sm text-slate-500">
            Est. deploy: ~{Math.round(template.estimatedDeployTime / 60)} min
          </div>
          <button
            onClick={onSelect}
            className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 font-medium transition-colors"
          >
            Deploy
          </button>
        </div>
      </div>
    </div>
  );
}

function DeployModal({
  template,
  config,
  setConfig,
  onDeploy,
  onClose,
  isDeploying,
  canDeploy,
  nameExists,
  existingSecrets,
}: {
  template: ServiceTemplate;
  config: DeployConfig;
  setConfig: React.Dispatch<React.SetStateAction<DeployConfig>>;
  onDeploy: () => void;
  onClose: () => void;
  isDeploying: boolean;
  canDeploy: boolean;
  nameExists: boolean;
  existingSecrets: any[];
}) {
  const updateVariable = (key: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      variables: { ...prev.variables, [key]: value },
    }));
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-4xl">{template.icon}</span>
          <div>
            <h3 className="text-xl font-semibold text-white">Deploy {template.name}</h3>
            <p className="text-slate-400 text-sm">Configure your new service</p>
          </div>
        </div>
        
        {/* Service Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Service Name *
          </label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
            placeholder={`my-${template.type.replace('-', '-')}`}
            className={cn(
              "w-full px-4 py-3 rounded-lg bg-slate-900/50 border text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500",
              nameExists ? "border-red-500" : "border-white/10"
            )}
          />
          {nameExists && (
            <p className="text-red-400 text-sm mt-1">A service with this name already exists</p>
          )}
        </div>
        
        {/* Variables */}
        <div className="space-y-4 mb-6">
          <h4 className="font-medium text-white">Environment Variables</h4>
          
          {template.defaultConfig.variables.map((variable: any) => {
            const existingSecret = existingSecrets.find((s: any) => s.key === variable.key);
            const hasValue = config.variables[variable.key]?.trim();
            
            return (
              <div key={variable.key} className="p-4 rounded-lg bg-white/5">
                <div className="flex items-start justify-between mb-2">
                  <label className="font-mono text-sm text-cyan-400">
                    {variable.key}
                    {variable.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {existingSecret && (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                      Saved in vault
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-slate-400 mb-2">{variable.description}</p>
                
                <input
                  type="password"
                  value={config.variables[variable.key] || ''}
                  onChange={(e) => updateVariable(variable.key, e.target.value)}
                  placeholder={existingSecret ? 'Using saved value' : `Enter ${variable.key}`}
                  className={cn(
                    "w-full px-3 py-2 rounded bg-slate-900/50 border text-white text-sm focus:outline-none focus:border-cyan-500",
                    hasValue || existingSecret?.value ? "border-green-500/30" : "border-white/10"
                  )}
                />
                
                {(hasValue || existingSecret?.value) && (
                  <p className="text-green-400 text-xs mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {existingSecret?.value && !hasValue ? 'Using saved secret' : 'Value set'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={isDeploying}
            className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={onDeploy}
            disabled={!canDeploy || isDeploying || nameExists}
            className="px-6 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isDeploying ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Deploying...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Deploy Service
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplatesSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-12 bg-slate-800 rounded animate-pulse" />
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 w-32 bg-slate-800 rounded animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-96 bg-slate-800 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}
