/**
 * Discord Setup Wizard Component
 * Step-by-step guided interface for Discord server configuration
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';

interface SetupTemplate {
  id: string;
  name: string;
  description: string;
  emoji: string;
  channels: number;
  roles: number;
  hasModeration: boolean;
  hasWelcome: boolean;
  hasLeveling: boolean;
}

interface SetupStepPlan {
  order: number;
  type: string;
  description: string;
}

interface SetupPlan {
  id: string;
  templateId: string;
  steps: SetupStepPlan[];
  estimatedDuration: number;
  summary: string;
}

interface ExecutionStatus {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolling_back';
  progress: number;
  currentStep: number;
  executedSteps: number;
  totalSteps: number;
  steps?: Array<{
    order: number;
    type: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    error?: string;
  }>;
}

export interface SetupWizardProps {
  guildId: string;
  onComplete?: (setupRunId: string) => void;
  onError?: (error: Error) => void;
}

const STEPS = [
  { step: 0, label: 'Welcome' },
  { step: 1, label: 'Configure' },
  { step: 2, label: 'Review' },
  { step: 3, label: 'Execute' },
  { step: 4, label: 'Complete' },
] as const;

const STATUS_POLL_INTERVAL_MS = 2500;

export function DiscordSetupWizard({ guildId, onComplete, onError }: SetupWizardProps) {
  const [step, setStep] = useState<number>(0);
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [setupRunId, setSetupRunId] = useState<string | null>(null);
  const [setupPlan, setSetupPlan] = useState<SetupPlan | null>(null);
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Fetch templates (GET, not POST)
  const { data: templates, isLoading: templatesLoading } = useQuery<SetupTemplate[]>({
    queryKey: ['discord-setup', 'templates'],
    queryFn: async () => {
      const response = await api.discordSetup.getTemplates();
      return response.data?.data ?? [];
    },
  });

  // Mutation: Generate plan
  const generatePlanMutation = useMutation({
    mutationFn: async (data: { guildId: string; userPrompt: string; templateId?: string }) => {
      const response = await api.discordSetup.generatePlan(data);
      return response.data?.data as SetupPlan;
    },
    onSuccess: (data) => {
      setSetupPlan(data);
      setSetupRunId(data.id);
      setStep(2);
    },
    onError: (error) => {
      onError?.(error instanceof Error ? error : new Error('Failed to generate plan'));
    },
  });

  // Mutation: Approve and start
  const approveMutation = useMutation({
    mutationFn: async (setupId: string) => {
      const response = await api.discordSetup.approve(setupId);
      return response.data;
    },
    onSuccess: () => {
      setStep(3);
    },
    onError: (error) => {
      onError?.(error instanceof Error ? error : new Error('Failed to approve setup'));
    },
  });

  // Mutation: Execute all setup steps
  const executeMutation = useMutation({
    mutationFn: async (setupId: string) => {
      const response = await api.discordSetup.executeAll(setupId);
      return response.data?.data;
    },
    onSuccess: () => {
      // Begin polling for status updates
      if (setupRunId) {
        startStatusPolling(setupRunId);
      }
    },
    onError: (error) => {
      onError?.(error instanceof Error ? error : new Error('Failed to execute setup'));
    },
  });

  const startStatusPolling = (id: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const response = await api.discordSetup.getStatus(id);
        const status: ExecutionStatus = response.data?.data;
        setExecutionStatus(status);

        if (status.status === 'completed' || status.status === 'failed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (status.status === 'completed') {
            setStep(4);
            onComplete?.(id);
          } else {
            onError?.(new Error('Setup execution failed'));
          }
        }
      } catch {
        // Silently ignore transient polling errors
      }
    }, STATUS_POLL_INTERVAL_MS);
  };

  const handleNext = () => {
    if (step === 0) {
      setStep(1);
    } else if (step === 1 && userPrompt.trim()) {
      generatePlanMutation.mutate({
        guildId,
        userPrompt,
        templateId: selectedTemplate ?? undefined,
      });
    }
  };

  const handleApprove = () => {
    if (setupRunId) approveMutation.mutate(setupRunId);
  };

  const handleExecute = () => {
    if (setupRunId) executeMutation.mutate(setupRunId);
  };

  const isWorking =
    generatePlanMutation.isPending ||
    approveMutation.isPending ||
    executeMutation.isPending;

  const progressPercent = executionStatus
    ? Math.round((executionStatus.executedSteps / Math.max(executionStatus.totalSteps, 1)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map(({ step: s, label }) => (
              <div key={s} className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                    s <= step ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {s + 1}
                </div>
                <p className="text-xs mt-2 text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="bg-slate-800 rounded-lg p-8 mb-8 min-h-96">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center">
              <h1 className="text-4xl font-bold text-white mb-4">Discord Setup Advisor</h1>
              <p className="text-xl text-slate-300 mb-8">
                Let AI guide you through configuring your Discord server for optimal community
                management
              </p>
              <div className="grid grid-cols-3 gap-6 mt-12">
                {[
                  { emoji: '🤖', title: 'AI-Powered', desc: 'Smart recommendations based on your needs' },
                  { emoji: '🔒', title: 'Safe', desc: 'Preview and approve before making changes' },
                  { emoji: '⚡', title: 'Fast', desc: 'Get your server ready in minutes' },
                ].map(({ emoji, title, desc }) => (
                  <div key={title} className="bg-slate-700 p-6 rounded-lg">
                    <div className="text-3xl mb-2">{emoji}</div>
                    <h3 className="font-bold text-white mb-2">{title}</h3>
                    <p className="text-sm text-slate-300">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Configure */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Configure Your Server</h2>

              <div className="mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Choose a template (optional)
                </h3>
                {templatesLoading ? (
                  <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-24 bg-slate-700 animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {templates?.map((template) => (
                      <button
                        key={template.id}
                        onClick={() =>
                          setSelectedTemplate(
                            selectedTemplate === template.id ? null : template.id
                          )
                        }
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          selectedTemplate === template.id
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-slate-600 hover:border-slate-500'
                        }`}
                      >
                        <div className="text-2xl mb-2">{template.emoji}</div>
                        <h4 className="font-bold text-white">{template.name}</h4>
                        <p className="text-xs text-slate-300">{template.description}</p>
                        <div className="flex gap-3 mt-2 text-xs text-slate-400">
                          <span>{template.channels} channels</span>
                          <span>{template.roles} roles</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">
                  Describe your server setup{' '}
                  <span className="text-red-400 font-normal text-base">*</span>
                </h3>
                <textarea
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="E.g., 'I'm creating a gaming community server. I need general chat, voice channels organised by game, an LFG system, and basic moderation.'"
                  className="w-full h-32 bg-slate-700 text-white rounded-lg p-4 border border-slate-600 focus:border-blue-500 focus:outline-none resize-none"
                />
                <p className="text-sm text-slate-400 mt-2">
                  Be specific about your server's purpose and features you want
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Review plan */}
          {step === 2 && setupPlan && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Review Your Setup Plan</h2>

              <div className="bg-slate-700 rounded-lg p-6 mb-6">
                <h3 className="font-bold text-white mb-2">Plan Summary</h3>
                <p className="text-slate-300">{setupPlan.summary}</p>
                {setupPlan.estimatedDuration > 0 && (
                  <p className="text-xs text-slate-400 mt-2">
                    Estimated duration: ~{setupPlan.estimatedDuration}s
                  </p>
                )}
              </div>

              <div className="mb-6">
                <h3 className="font-bold text-white mb-4">
                  Setup Steps ({setupPlan.steps?.length ?? 0})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {setupPlan.steps?.map((s, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-slate-700 p-3 rounded">
                      <div className="text-blue-400 font-bold min-w-6">{idx + 1}.</div>
                      <div className="flex-1">
                        <p className="font-semibold text-white">{s.description}</p>
                        <p className="text-xs text-slate-400">{s.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-sm text-yellow-200">
                  ⚠️ Please review the plan carefully. Changes will be applied to your Discord
                  server after you approve.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Executing */}
          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Executing Setup</h2>
              <div className="bg-slate-700 rounded-lg p-6">
                {executionStatus ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-slate-300">
                        Step {executionStatus.executedSteps} of {executionStatus.totalSteps}
                      </p>
                      <span className="text-blue-400 font-semibold">{progressPercent}%</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-600 rounded-full h-2 mb-4">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    {/* Step list */}
                    {executionStatus.steps && (
                      <div className="space-y-2 max-h-48 overflow-y-auto mt-4">
                        {executionStatus.steps.map((s, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-3 text-sm p-2 rounded ${
                              s.status === 'completed'
                                ? 'text-green-400'
                                : s.status === 'in_progress'
                                ? 'text-blue-400'
                                : s.status === 'failed'
                                ? 'text-red-400'
                                : 'text-slate-500'
                            }`}
                          >
                            <span>
                              {s.status === 'completed'
                                ? '✓'
                                : s.status === 'in_progress'
                                ? '⏳'
                                : s.status === 'failed'
                                ? '✗'
                                : '○'}
                            </span>
                            <span>{s.description}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-slate-300 mb-4">Setting up your Discord server...</p>
                    <div className="w-full bg-slate-600 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full animate-pulse w-1/3" />
                    </div>
                  </>
                )}
                <p className="text-sm text-slate-400 mt-4">
                  Please don&apos;t close this page while setup is in progress.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 4 && (
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-3xl font-bold text-white mb-4">Setup Complete!</h2>
              <p className="text-slate-300 mb-8">
                Your Discord server has been successfully configured with all the recommended
                settings.
              </p>
              <div className="bg-slate-700 rounded-lg p-6 text-left mb-8">
                <h3 className="font-bold text-white mb-4">Next Steps:</h3>
                <ul className="space-y-2 text-slate-300">
                  <li>✓ Roles created and configured</li>
                  <li>✓ Channels organised by category</li>
                  <li>✓ Moderation policies set</li>
                  <li>✓ Welcome system ready</li>
                  <li>• Invite your members to the server</li>
                  <li>• Customise messages and settings as needed</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex justify-between gap-4">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || isWorking || step === 3}
            className="px-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Previous
          </button>

          <button
            onClick={() => {
              if (step === 2) handleApprove();
              else if (step === 3) handleExecute();
              else handleNext();
            }}
            disabled={
              (step === 1 && !userPrompt.trim()) ||
              isWorking ||
              step === 4 ||
              (step === 3 && executeMutation.isSuccess)
            }
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold"
          >
            {step === 2
              ? 'Approve & Continue'
              : step === 3
              ? executeMutation.isSuccess
                ? 'Running…'
                : 'Execute'
              : 'Next'}
            {isWorking && <span className="ml-2 opacity-75">…</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
