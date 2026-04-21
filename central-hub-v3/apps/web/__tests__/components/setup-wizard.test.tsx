/**
 * DiscordSetupWizard Component Tests
 */

import React from 'react';
import { render, screen, waitFor } from '@/__tests__/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { DiscordSetupWizard } from '@/app/dashboard/discord/setup/wizard';

// Mock the API client
jest.mock('@/app/lib/api-client', () => ({
  api: {
    discordSetup: {
      getTemplates: jest.fn(),
      generatePlan: jest.fn(),
      approve: jest.fn(),
      executeAll: jest.fn(),
      getStatus: jest.fn(),
    },
  },
}));

import { api } from '@/app/lib/api-client';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const mockTemplates = [
  {
    id: 'gaming',
    name: 'Gaming Community',
    description: 'Perfect for gaming communities',
    emoji: '🎮',
    channels: 10,
    roles: 5,
    hasModeration: true,
    hasWelcome: true,
    hasLeveling: false,
  },
  {
    id: 'professional',
    name: 'Professional Team',
    description: 'For professional teams and organisations',
    emoji: '💼',
    channels: 8,
    roles: 6,
    hasModeration: false,
    hasWelcome: true,
    hasLeveling: false,
  },
];

const mockPlan = {
  id: 'plan-abc123',
  templateId: 'gaming',
  steps: [
    { order: 1, type: 'create_category', description: 'Create General category' },
    { order: 2, type: 'create_channel', description: 'Create #general channel' },
    { order: 3, type: 'create_role', description: 'Create Member role' },
  ],
  estimatedDuration: 30,
  summary: 'Set up a gaming community server with essential channels and roles.',
};

const mockCompletedStatus = {
  id: 'plan-abc123',
  status: 'completed' as const,
  progress: 100,
  currentStep: 3,
  executedSteps: 3,
  totalSteps: 3,
  steps: mockPlan.steps.map((s) => ({ ...s, status: 'completed' as const })),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupMocks() {
  (api.discordSetup.getTemplates as jest.Mock).mockResolvedValue({
    data: { data: mockTemplates },
  });
  (api.discordSetup.generatePlan as jest.Mock).mockResolvedValue({
    data: { data: mockPlan },
  });
  (api.discordSetup.approve as jest.Mock).mockResolvedValue({ data: { success: true } });
  (api.discordSetup.executeAll as jest.Mock).mockResolvedValue({
    data: { data: { status: 'in_progress' } },
  });
  (api.discordSetup.getStatus as jest.Mock).mockResolvedValue({
    data: { data: mockCompletedStatus },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DiscordSetupWizard', () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const onComplete = jest.fn();
  const onError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    setupMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Step 0 — Welcome
  // -------------------------------------------------------------------------

  describe('Step 0: Welcome', () => {
    it('renders the welcome screen on load', () => {
      render(<DiscordSetupWizard guildId="guild-1" />);

      expect(screen.getByText('Discord Setup Advisor')).toBeInTheDocument();
      expect(screen.getByText('AI-Powered')).toBeInTheDocument();
      expect(screen.getByText('Safe')).toBeInTheDocument();
      expect(screen.getByText('Fast')).toBeInTheDocument();
    });

    it('highlights step 1 in progress indicator', () => {
      const { container } = render(<DiscordSetupWizard guildId="guild-1" />);
      const activeStep = container.querySelector('.bg-blue-600');
      expect(activeStep).toBeInTheDocument();
      expect(activeStep?.textContent).toBe('1');
    });

    it('Previous button is disabled on first step', () => {
      render(<DiscordSetupWizard guildId="guild-1" />);
      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    });

    it('advances to Configure step when Next is clicked', async () => {
      render(<DiscordSetupWizard guildId="guild-1" />);
      await user.click(screen.getByRole('button', { name: /next/i }));
      expect(await screen.findByText('Configure Your Server')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Step 1 — Configure
  // -------------------------------------------------------------------------

  describe('Step 1: Configure', () => {
    async function goToStep1() {
      render(<DiscordSetupWizard guildId="guild-1" onComplete={onComplete} onError={onError} />);
      await user.click(screen.getByRole('button', { name: /next/i }));
      await screen.findByText('Configure Your Server');
    }

    it('fetches and displays templates', async () => {
      await goToStep1();
      await waitFor(() => {
        expect(screen.getByText('Gaming Community')).toBeInTheDocument();
        expect(screen.getByText('Professional Team')).toBeInTheDocument();
      });
      expect(api.discordSetup.getTemplates).toHaveBeenCalled();
    });

    it('Next is disabled when prompt is empty', async () => {
      await goToStep1();
      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    });

    it('Next is enabled once a prompt is typed', async () => {
      await goToStep1();
      await user.type(screen.getByRole('textbox'), 'Gaming server with voice channels');
      expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();
    });

    it('highlights selected template', async () => {
      await goToStep1();
      await waitFor(() => screen.getByText('Gaming Community'));

      const templateBtn = screen.getByRole('button', { name: /gaming community/i });
      await user.click(templateBtn);
      expect(templateBtn).toHaveClass('border-blue-500');
    });

    it('deselects a template on second click', async () => {
      await goToStep1();
      await waitFor(() => screen.getByText('Gaming Community'));

      const templateBtn = screen.getByRole('button', { name: /gaming community/i });
      await user.click(templateBtn);
      await user.click(templateBtn);
      expect(templateBtn).not.toHaveClass('border-blue-500');
    });

    it('generates a plan and advances to Review', async () => {
      await goToStep1();
      await user.type(screen.getByRole('textbox'), 'Gaming community with LFG channels');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(api.discordSetup.generatePlan).toHaveBeenCalledWith({
          guildId: 'guild-1',
          userPrompt: 'Gaming community with LFG channels',
          templateId: undefined,
        });
      });

      expect(await screen.findByText('Review Your Setup Plan')).toBeInTheDocument();
    });

    it('passes selected templateId to generatePlan', async () => {
      await goToStep1();
      await waitFor(() => screen.getByText('Gaming Community'));

      await user.click(screen.getByRole('button', { name: /gaming community/i }));
      await user.type(screen.getByRole('textbox'), 'My gaming server');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(api.discordSetup.generatePlan).toHaveBeenCalledWith(
          expect.objectContaining({ templateId: 'gaming' })
        );
      });
    });

    it('calls onError when plan generation fails', async () => {
      (api.discordSetup.generatePlan as jest.Mock).mockRejectedValueOnce(
        new Error('LLM unavailable')
      );

      await goToStep1();
      await user.type(screen.getByRole('textbox'), 'My server');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'LLM unavailable' })
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // Step 2 — Review
  // -------------------------------------------------------------------------

  describe('Step 2: Review', () => {
    async function goToStep2() {
      render(<DiscordSetupWizard guildId="guild-1" onComplete={onComplete} onError={onError} />);
      await user.click(screen.getByRole('button', { name: /next/i }));
      await screen.findByText('Configure Your Server');
      await user.type(screen.getByRole('textbox'), 'My community');
      await user.click(screen.getByRole('button', { name: /next/i }));
      await screen.findByText('Review Your Setup Plan');
    }

    it('displays plan summary', async () => {
      await goToStep2();
      expect(screen.getByText(mockPlan.summary)).toBeInTheDocument();
    });

    it('lists each setup step', async () => {
      await goToStep2();
      expect(screen.getByText('Create General category')).toBeInTheDocument();
      expect(screen.getByText('Create #general channel')).toBeInTheDocument();
      expect(screen.getByText('Create Member role')).toBeInTheDocument();
    });

    it('shows estimated duration', async () => {
      await goToStep2();
      expect(screen.getByText(/~30s/)).toBeInTheDocument();
    });

    it('displays a caution warning', async () => {
      await goToStep2();
      expect(screen.getByText(/please review the plan carefully/i)).toBeInTheDocument();
    });

    it('action button is labelled "Approve & Continue"', async () => {
      await goToStep2();
      expect(screen.getByRole('button', { name: /approve & continue/i })).toBeInTheDocument();
    });

    it('approves plan and advances to Execute step', async () => {
      await goToStep2();
      await user.click(screen.getByRole('button', { name: /approve & continue/i }));

      await waitFor(() => expect(api.discordSetup.approve).toHaveBeenCalledWith('plan-abc123'));
      expect(await screen.findByText('Executing Setup')).toBeInTheDocument();
    });

    it('calls onError when approval fails', async () => {
      (api.discordSetup.approve as jest.Mock).mockRejectedValueOnce(new Error('Forbidden'));

      await goToStep2();
      await user.click(screen.getByRole('button', { name: /approve & continue/i }));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Forbidden' }));
      });
    });
  });

  // -------------------------------------------------------------------------
  // Step 3 — Execute
  // -------------------------------------------------------------------------

  describe('Step 3: Execute', () => {
    async function goToStep3() {
      render(<DiscordSetupWizard guildId="guild-1" onComplete={onComplete} onError={onError} />);
      await user.click(screen.getByRole('button', { name: /next/i }));
      await screen.findByText('Configure Your Server');
      await user.type(screen.getByRole('textbox'), 'My community');
      await user.click(screen.getByRole('button', { name: /next/i }));
      await screen.findByText('Review Your Setup Plan');
      await user.click(screen.getByRole('button', { name: /approve & continue/i }));
      await screen.findByText('Executing Setup');
    }

    it('renders the execution screen with instructions', async () => {
      await goToStep3();
      expect(screen.getByText(/executing setup/i)).toBeInTheDocument();
      expect(screen.getByText(/don.*t close this page/i)).toBeInTheDocument();
    });

    it('Previous button is disabled during execution', async () => {
      await goToStep3();
      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    });

    it('Execute button calls executeAll', async () => {
      await goToStep3();
      await user.click(screen.getByRole('button', { name: /execute/i }));

      await waitFor(() => {
        expect(api.discordSetup.executeAll).toHaveBeenCalledWith('plan-abc123');
      });
    });

    it('polls status after execution and advances to Complete', async () => {
      await goToStep3();
      await user.click(screen.getByRole('button', { name: /execute/i }));

      jest.advanceTimersByTime(3000);

      await waitFor(() => expect(api.discordSetup.getStatus).toHaveBeenCalledWith('plan-abc123'));
      expect(await screen.findByText('Setup Complete!')).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalledWith('plan-abc123');
    });

    it('calls onError when execution polling reports failure', async () => {
      (api.discordSetup.getStatus as jest.Mock).mockResolvedValue({
        data: { data: { ...mockCompletedStatus, status: 'failed' } },
      });

      await goToStep3();
      await user.click(screen.getByRole('button', { name: /execute/i }));
      jest.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Setup execution failed' })
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // Step 4 — Complete
  // -------------------------------------------------------------------------

  describe('Step 4: Complete', () => {
    async function goToStep4() {
      render(<DiscordSetupWizard guildId="guild-1" onComplete={onComplete} onError={onError} />);
      await user.click(screen.getByRole('button', { name: /next/i }));
      await screen.findByText('Configure Your Server');
      await user.type(screen.getByRole('textbox'), 'My community');
      await user.click(screen.getByRole('button', { name: /next/i }));
      await screen.findByText('Review Your Setup Plan');
      await user.click(screen.getByRole('button', { name: /approve & continue/i }));
      await screen.findByText('Executing Setup');
      await user.click(screen.getByRole('button', { name: /execute/i }));
      jest.advanceTimersByTime(3000);
      await screen.findByText('Setup Complete!');
    }

    it('shows success screen', async () => {
      await goToStep4();
      expect(screen.getByText('Setup Complete!')).toBeInTheDocument();
    });

    it('Next button is disabled on the completion screen', async () => {
      await goToStep4();
      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    });

    it('calls onComplete callback with the setup run ID', async () => {
      await goToStep4();
      expect(onComplete).toHaveBeenCalledWith('plan-abc123');
    });
  });
});
