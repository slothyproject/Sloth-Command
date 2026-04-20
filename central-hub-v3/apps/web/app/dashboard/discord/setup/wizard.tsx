/**
 * Discord Setup Wizard Component
 * Step-by-step guided interface for Discord server configuration
 */

'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/app/lib/api-client';

interface WizardStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface SetupWizardProps {
  guildId: string;
  onComplete?: (setupRunId: string) => void;
  onError?: (error: Error) => void;
}

export function DiscordSetupWizard({ guildId, onComplete, onError }: SetupWizardProps) {
  const [step, setStep] = useState<number>(0);
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [setupRunId, setSetupRunId] = useState<string | null>(null);
  const [setupPlan, setSetupPlan] = useState<any>(null);
  const [isApproving, setIsApproving] = useState(false);

  // Fetch templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['discord-setup', 'templates'],
    queryFn: async () => {
      const response = await api.post('/discord/setup/templates');
      return response.data || [];
    },
  });

  // Mutation: Generate plan
  const generatePlanMutation = useMutation({
    mutationFn: async (data: { guildId: string; userPrompt: string; templateId?: string }) => {
      const response = await api.post('/discord/setup/generate-plan', data);
      return response.data;
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
      setIsApproving(true);
      const response = await api.post(`/discord/setup/${setupId}/approve`);
      return response.data;
    },
    onSuccess: () => {
      setStep(3);
    },
    onError: (error) => {
      onError?.(error instanceof Error ? error : new Error('Failed to approve setup'));
    },
    onSettled: () => {
      setIsApproving(false);
    },
  });

  // Mutation: Execute setup
  const executeMutation = useMutation({
    mutationFn: async (setupId: string) => {
      const response = await api.post(`/discord/setup/${setupId}/execute-all`);
      return response.data;
    },
    onSuccess: (data) => {
      setStep(4);
      if (data.status === 'completed') {
        onComplete?.(setupRunId!);
      }
    },
    onError: (error) => {
      onError?.(error instanceof Error ? error : new Error('Failed to execute setup'));
    },
  });

  const handleNext = () => {
    if (step === 0) {
      // Welcome step
      setStep(1);
    } else if (step === 1) {
      // Template/prompt selection
      if (userPrompt.trim()) {
        generatePlanMutation.mutate({
          guildId,
          userPrompt,
          templateId: selectedTemplate || undefined,
        });
      }
    }
  };

  const handleApprove = () => {
    if (setupRunId) {
      approveMutation.mutate(setupRunId);
    }
  };

  const handleExecute = () => {
    if (setupRunId) {
      executeMutation.mutate(setupRunId);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[
              { step: 0, label: 'Welcome' },
              { step: 1, label: 'Configure' },
              { step: 2, label: 'Review' },
              { step: 3, label: 'Execute' },
              { step: 4, label: 'Complete' },
            ].map(({ step: s, label }) => (
              <div key={s} className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                    s <= step
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-400'
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
          {step === 0 && (
            <div className="text-center">
              <h1 className="text-4xl font-bold text-white mb-4">Discord Setup Advisor</h1>
              <p className="text-xl text-slate-300 mb-8">
                Let AI guide you through configuring your Discord server for optimal community management
              </p>
              <div className="grid grid-cols-3 gap-6 mt-12">
                <div className="bg-slate-700 p-6 rounded-lg">
                  <div className="text-3xl mb-2">🤖</div>
                  <h3 className="font-bold text-white mb-2">AI-Powered</h3>
                  <p className="text-sm text-slate-300">Smart recommendations based on your needs</p>
                </div>
                <div className="bg-slate-700 p-6 rounded-lg">
                  <div className="text-3xl mb-2">🔒</div>
                  <h3 className="font-bold text-white mb-2">Safe</h3>
                  <p className="text-sm text-slate-300">Preview and approve before making changes</p>
                </div>
                <div className="bg-slate-700 p-6 rounded-lg">
                  <div className="text-3xl mb-2">⚡</div>
                  <h3 className="font-bold text-white mb-2">Fast</h3>
                  <p className="text-sm text-slate-300">Get your server ready in minutes</p>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Configure Your Server</h2>

              {/* Template selection */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">Choose a template (optional)</h3>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {templatesLoading ? (
                    <p className="text-slate-400">Loading templates...</p>
                  ) : (
                    templates?.map((template: any) => (
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
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Natural language prompt */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">
                  Describe your server setup (required)
                </h3>
                <textarea
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="E.g., 'I'm creating a gaming community server. I need general chat, voice channels organized by game, an LFG system, and basic moderation.'"
                  className="w-full h-32 bg-slate-700 text-white rounded-lg p-4 border border-slate-600 focus:border-blue-500 focus:outline-none resize-none"
                />
                <p className="text-sm text-slate-400 mt-2">
                  Be specific about your server's purpose and features you want
                </p>
              </div>
            </div>
          )}

          {step === 2 && setupPlan && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Review Your Setup Plan</h2>

              <div className="bg-slate-700 rounded-lg p-6 mb-6">
                <h3 className="font-bold text-white mb-2">Plan Summary</h3>
                <p className="text-slate-300">{setupPlan.summary}</p>
              </div>

              <div className="mb-6">
                <h3 className="font-bold text-white mb-4">
                  Setup Steps ({setupPlan.steps?.length || 0})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {setupPlan.steps?.map((step: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 bg-slate-700 p-3 rounded">
                      <div className="text-blue-400 font-bold min-w-6">{idx + 1}.</div>
                      <div className="flex-1">
                        <p className="font-semibold text-white">{step.description}</p>
                        <p className="text-xs text-slate-400">{step.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-sm text-yellow-200">
                  ⚠️ Please review the plan carefully. You'll have a chance to approve before
                  making any changes to your server.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Executing Setup</h2>
              <div className="bg-slate-700 rounded-lg p-6">
                <p className="text-slate-300 mb-4">Setting up your Discord server...</p>
                <div className="w-full bg-slate-600 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full animate-pulse"></div>
                </div>
                <p className="text-sm text-slate-400 mt-4">
                  Please don't close this page while setup is in progress.
                </p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-3xl font-bold text-white mb-4">Setup Complete!</h2>
              <p className="text-slate-300 mb-8">
                Your Discord server has been successfully configured with all the recommended settings.
              </p>
              <div className="bg-slate-700 rounded-lg p-6 text-left mb-8">
                <h3 className="font-bold text-white mb-4">Next Steps:</h3>
                <ul className="space-y-2 text-slate-300">
                  <li>✓ Roles created and configured</li>
                  <li>✓ Channels organized by category</li>
                  <li>✓ Moderation policies set</li>
                  <li>✓ Welcome system ready</li>
                  <li>• Invite your members to the server</li>
                  <li>• Customize messages and settings as needed</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex justify-between gap-4">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0 || isApproving || generatePlanMutation.isPending}
            className="px-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Previous
          </button>

          <button
            onClick={() => {
              if (step === 2) {
                handleApprove();
              } else if (step === 3) {
                handleExecute();
              } else {
                handleNext();
              }
            }}
            disabled={
              (step === 1 && !userPrompt.trim()) ||
              isApproving ||
              approveMutation.isPending ||
              executeMutation.isPending ||
              generatePlanMutation.isPending ||
              step === 4
            }
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold"
          >
            {step === 2 ? 'Approve & Continue' : step === 3 ? 'Execute' : 'Next'}
            {(isApproving ||
              approveMutation.isPending ||
              executeMutation.isPending ||
              generatePlanMutation.isPending) && (
              <span className="ml-2">...</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
