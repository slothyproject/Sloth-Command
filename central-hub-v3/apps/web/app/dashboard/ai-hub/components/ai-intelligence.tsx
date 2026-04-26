/**
 * AI Intelligence Component
 * Agentic AI capabilities, active plans, and execution status - with real API
 */

'use client';

import React, { useState } from 'react';
import { 
  useAgents, 
  useAgentPlans, 
  useCreateAgentPlan,
  useExecuteAgentPlan,
  useApproveAgentPlan,
  useCancelAgentPlan,
} from '@/app/hooks/use-ai';
import { cn } from '@/app/lib/utils';
import type { AgentPlan } from '@/app/types';

interface AIIntelligenceProps {
  services?: unknown[];
}

export function AIIntelligence({ services: _services }: AIIntelligenceProps) {
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: plans, isLoading: plansLoading } = useAgentPlans();
  const createPlan = useCreateAgentPlan();
  const executePlan = useExecuteAgentPlan();
  const approvePlan = useApproveAgentPlan();
  const cancelPlan = useCancelAgentPlan();
  
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [goalInput, setGoalInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const isLoading = agentsLoading || plansLoading;

  // Filter plans by status
  const pendingPlans = plans?.filter(p => p.status === 'pending') || [];
  const runningPlans = plans?.filter(p => p.status === 'in_progress') || [];
  const completedPlans = plans?.filter(p => p.status === 'completed') || [];
  const failedPlans = plans?.filter(p => p.status === 'failed') || [];

  const handleCreatePlan = async () => {
    if (!goalInput.trim() || !selectedAgent) return;
    
    setIsCreating(true);
    try {
      await createPlan.mutateAsync({
        goal: goalInput,
        agentType: selectedAgent,
      });
      setGoalInput('');
      setSelectedAgent(null);
    } catch (error) {
      console.error('Failed to create plan:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleExecutePlan = async (planId: string) => {
    try {
      await executePlan.mutateAsync(planId);
    } catch (error) {
      console.error('Failed to execute plan:', error);
    }
  };

  const handleApprovePlan = async (planId: string, approved: boolean) => {
    try {
      await approvePlan.mutateAsync({ planId, approved });
    } catch (error) {
      console.error('Failed to approve plan:', error);
    }
  };

  const handleCancelPlan = async (planId: string) => {
    try {
      await cancelPlan.mutateAsync(planId);
    } catch (error) {
      console.error('Failed to cancel plan:', error);
    }
  };

  if (isLoading) {
    return <IntelligenceSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Agent Selection & Plan Creation */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Create Agent Plan</h3>
        
        {/* Agent Selection */}
        <div className="mb-4">
          <label className="text-sm text-slate-400 mb-2 block">Select Agent Type</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {agents?.map((agent) => (
              <button
                key={agent.type}
                onClick={() => setSelectedAgent(agent.type)}
                className={cn(
                  "p-4 rounded-lg border transition-all text-left",
                  selectedAgent === agent.type
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-white/10 hover:border-white/20 hover:bg-white/5"
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center mb-2">
                  <Icon name="Bot" className="w-4 h-4 text-cyan-400" />
                </div>
                <p className="text-sm font-medium text-white">{agent.name}</p>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{agent.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Goal Input */}
        <div className="mb-4">
          <label className="text-sm text-slate-400 mb-2 block">Describe Your Goal</label>
          <textarea
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            placeholder="e.g., Deploy a new microservice with auto-scaling enabled, or analyze API performance issues..."
            className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none"
            rows={3}
          />
        </div>

        {/* Create Button */}
        <button
          onClick={handleCreatePlan}
          disabled={!goalInput.trim() || !selectedAgent || isCreating}
          className={cn(
            "px-6 py-2.5 rounded-lg font-medium transition-all",
            !goalInput.trim() || !selectedAgent || isCreating
              ? "bg-slate-700 text-slate-400 cursor-not-allowed"
              : "bg-gradient-to-r from-violet-500 to-cyan-500 text-white hover:opacity-90"
          )}
        >
          {isCreating ? 'Creating Plan...' : 'Create Plan'}
        </button>
      </div>

      {/* Active Plans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Running/Pending Plans */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Active Plans</h3>
          
          {runningPlans.length === 0 && pendingPlans.length === 0 && (
            <div className="glass-card p-6 text-center">
              <Icon name="Activity" className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No active plans</p>
              <p className="text-sm text-slate-500 mt-1">Create a plan to get started</p>
            </div>
          )}

          {runningPlans.map((plan) => (
            <PlanCard 
              key={plan.id} 
              plan={plan} 
              onExecute={() => handleExecutePlan(plan.id)}
              onApprove={(approved) => handleApprovePlan(plan.id, approved)}
              onCancel={() => handleCancelPlan(plan.id)}
              isExecuting={executePlan.isPending}
              isApproving={approvePlan.isPending}
              isCancelling={cancelPlan.isPending}
            />
          ))}

          {pendingPlans.map((plan) => (
            <PlanCard 
              key={plan.id} 
              plan={plan} 
              onExecute={() => handleExecutePlan(plan.id)}
              onApprove={(approved) => handleApprovePlan(plan.id, approved)}
              onCancel={() => handleCancelPlan(plan.id)}
              isExecuting={executePlan.isPending}
              isApproving={approvePlan.isPending}
              isCancelling={cancelPlan.isPending}
            />
          ))}
        </div>

        {/* Recent Completed/Failed Plans */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Recent History</h3>
          
          {[...completedPlans, ...failedPlans].slice(0, 5).map((plan) => (
            <PlanCard 
              key={plan.id} 
              plan={plan} 
              onExecute={() => {}}
              onApprove={() => {}}
              onCancel={() => {}}
              isExecuting={false}
              isApproving={false}
              isCancelling={false}
              compact
            />
          ))}

          {completedPlans.length === 0 && failedPlans.length === 0 && (
            <div className="glass-card p-6 text-center">
              <Icon name="History" className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No plan history yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Plan Card Component
function PlanCard({ 
  plan, 
  onExecute, 
  onApprove, 
  onCancel,
  isExecuting,
  isApproving,
  isCancelling,
  compact = false,
}: { 
  plan: AgentPlan; 
  onExecute: () => void;
  onApprove: (approved: boolean) => void;
  onCancel: () => void;
  isExecuting: boolean;
  isApproving: boolean;
  isCancelling: boolean;
  compact?: boolean;
}) {
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    in_progress: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    cancelled: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  const canExecute = plan.status === 'pending' || plan.status === 'in_progress';
  const needsApproval = plan.status === 'pending' && plan.metadata?.requiresApproval;

  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={cn(
              "px-2 py-0.5 rounded text-xs font-medium border capitalize",
              statusColors[plan.status]
            )}>
              {plan.status}
            </span>
            <span className="text-xs text-slate-500">
              {new Date(plan.createdAt).toLocaleString()}
            </span>
          </div>
          
          <h4 className="font-medium text-white">{plan.goal}</h4>
          
          {!compact && plan.steps && (
            <div className="mt-3 space-y-2">
              {plan.steps.slice(0, 3).map((step, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-xs",
                    step.status === 'completed' && "bg-green-500/20 text-green-400",
                    step.status === 'in_progress' && "bg-violet-500/20 text-violet-400",
                    step.status === 'pending' && "bg-slate-700 text-slate-400",
                    step.status === 'failed' && "bg-red-500/20 text-red-400",
                  )}>
                    {step.status === 'completed' ? '✓' : idx + 1}
                  </div>
                  <span className="text-slate-400">{step.description}</span>
                </div>
              ))}
              {plan.steps.length > 3 && (
                <p className="text-xs text-slate-500 ml-7">
                  +{plan.steps.length - 3} more steps
                </p>
              )}
            </div>
          )}

          {plan.result && (
            <div className="mt-3 p-2 rounded bg-white/5">
              <p className="text-sm text-slate-300">
                {plan.result.success ? '✓ Success' : '✗ Failed'}: {plan.result.message}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        {!compact && (
          <div className="flex flex-col gap-2 ml-4">
            {needsApproval && (
              <>
                <button
                  onClick={() => onApprove(true)}
                  disabled={isApproving}
                  className="px-3 py-1.5 rounded bg-green-500/20 text-green-400 text-sm hover:bg-green-500/30 disabled:opacity-50"
                >
                  {isApproving ? '...' : 'Approve'}
                </button>
                <button
                  onClick={() => onApprove(false)}
                  disabled={isApproving}
                  className="px-3 py-1.5 rounded bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30 disabled:opacity-50"
                >
                  Reject
                </button>
              </>
            )}
            
            {canExecute && !needsApproval && (
              <button
                onClick={onExecute}
                disabled={isExecuting}
                className="px-3 py-1.5 rounded bg-violet-500/20 text-violet-400 text-sm hover:bg-violet-500/30 disabled:opacity-50"
              >
                {isExecuting ? '...' : 'Execute'}
              </button>
            )}

            {(plan.status === 'pending' || plan.status === 'in_progress') && (
              <button
                onClick={onCancel}
                disabled={isCancelling}
                className="px-3 py-1.5 rounded bg-slate-700 text-slate-400 text-sm hover:bg-slate-600 disabled:opacity-50"
              >
                {isCancelling ? '...' : 'Cancel'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Skeleton Loading State
function IntelligenceSkeleton() {
  return (
    <div className="space-y-6">
      <div className="glass-card p-6 animate-pulse">
        <div className="h-6 bg-slate-800 rounded w-48 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-800 rounded" />
          ))}
        </div>
        <div className="h-20 bg-slate-800 rounded" />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="space-y-4">
            <div className="h-6 bg-slate-800 rounded w-32" />
            {[...Array(2)].map((_, j) => (
              <div key={j} className="glass-card p-4 animate-pulse">
                <div className="h-20 bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Icon Component
function Icon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    Bot: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    Activity: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    History: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return icons[name] || null;
}
