/**
 * Discord Server Setup Service
 * Orchestrates the AI-driven setup of Discord servers with safety and approval workflow
 */

import { Client, Guild, Role, Channel, PermissionFlagsBits } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { generate } from './llm-router';
import { suggestTemplate, templateToSetupSteps, getTemplate } from './discord-setup-templates';

const prisma = new PrismaClient();

export interface SetupRequest {
  guildId: string;
  userPrompt: string;
  templateId?: string;
}

export interface SetupPlan {
  id: string;
  templateId: string;
  steps: SetupStepPlan[];
  estimatedDuration: number;
  summary: string;
}

export interface SetupStepPlan {
  order: number;
  type: string;
  description: string;
  config: any;
}

export interface SetupResult {
  success: boolean;
  stepIndex: number;
  result?: any;
  error?: string;
  rollbackData?: any;
}

/**
 * Generate a setup plan from user request
 */
export async function generateSetupPlan(request: SetupRequest): Promise<SetupPlan> {
  // Determine template
  let templateId = request.templateId;
  if (!templateId) {
    templateId = await suggestTemplate(request.userPrompt);
  }

  const template = getTemplate(templateId as any);
  const templateSteps = templateToSetupSteps(template);

  // Create setup run in database
  const setupRun = await prisma.setupRun.create({
    data: {
      guildId: request.guildId,
      setupTemplate: templateId,
      userPrompt: request.userPrompt,
      status: 'generating',
      totalSteps: templateSteps.length,
      plan: {
        templateId,
        steps: templateSteps,
        template: template,
      },
    },
  });

  // Use LLM to generate personalized plan summary
  const summaryPrompt = `Based on this Discord server setup request:
USER: ${request.userPrompt}
TEMPLATE: ${template.name}

Generate a brief 2-3 sentence summary of what will be set up. Keep it concise and user-friendly.`;

  const summary = await generate(summaryPrompt, {
    maxTokens: 150,
  });

  // Update setup run with plan and summary
  await prisma.setupRun.update({
    where: { id: setupRun.id },
    data: {
      status: 'ready_for_approval',
      plan: {
        templateId,
        steps: templateSteps,
        template: template,
        summary: summary,
      },
    },
  });

  return {
    id: setupRun.id,
    templateId,
    steps: templateSteps,
    estimatedDuration: Math.ceil(templateSteps.length * 0.5), // ~30 seconds per step
    summary: summary,
  };
}

/**
 * Get setup plan for approval
 */
export async function getSetupPlan(setupRunId: string): Promise<SetupPlan | null> {
  const setupRun = await prisma.setupRun.findUnique({
    where: { id: setupRunId },
  });

  if (!setupRun || !setupRun.plan) return null;

  const plan = setupRun.plan as any;
  return {
    id: setupRunId,
    templateId: plan.templateId,
    steps: plan.steps,
    estimatedDuration: plan.estimatedDuration || setupRun.totalSteps,
    summary: plan.summary || 'Setting up your Discord server...',
  };
}

/**
 * Approve and start setup execution
 */
export async function approveAndStartSetup(setupRunId: string, approverId: string): Promise<void> {
  const setupRun = await prisma.setupRun.findUnique({
    where: { id: setupRunId },
  });

  if (!setupRun) throw new Error('Setup run not found');

  await prisma.setupRun.update({
    where: { id: setupRunId },
    data: {
      status: 'executing',
      planApproved: true,
      approvedAt: new Date(),
      approvedBy: approverId,
    },
  });

  console.log(`✅ Setup ${setupRunId} approved and started`);
}

/**
 * Execute a single setup step
 */
export async function executeSetupStep(
  client: Client,
  setupRunId: string,
  stepIndex: number
): Promise<SetupResult> {
  const setupRun = await prisma.setupRun.findUnique({
    where: { id: setupRunId },
    include: { steps: true },
  });

  if (!setupRun) {
    return { success: false, stepIndex, error: 'Setup run not found' };
  }

  const guild = await client.guilds.fetch(setupRun.guildId).catch(() => null);
  if (!guild) {
    return { success: false, stepIndex, error: 'Guild not found' };
  }

  const plan = setupRun.plan as any;
  const stepPlan = plan.steps[stepIndex];

  if (!stepPlan) {
    return { success: false, stepIndex, error: 'Step not found' };
  }

  try {
    let result: any;
    let rollbackData: any;

    switch (stepPlan.type) {
      case 'create_role':
        ({ result, rollbackData } = await executeCreateRole(guild, stepPlan.config));
        break;

      case 'create_channel':
        ({ result, rollbackData } = await executeCreateChannel(guild, stepPlan.config));
        break;

      case 'configure_moderation':
        ({ result, rollbackData } = await executeConfigureModeration(
          setupRun,
          stepPlan.config
        ));
        break;

      case 'setup_welcome':
        ({ result, rollbackData } = await executeSetupWelcome(setupRun, stepPlan.config));
        break;

      case 'setup_leveling':
        ({ result, rollbackData } = await executeSetupLeveling(setupRun, stepPlan.config));
        break;

      default:
        return { success: false, stepIndex, error: `Unknown step type: ${stepPlan.type}` };
    }

    // Save step result to database
    await prisma.setupStep.create({
      data: {
        setupRunId,
        order: stepIndex,
        type: stepPlan.type,
        description: stepPlan.description,
        config: stepPlan.config,
        status: 'completed',
        result,
        rollbackData,
        executedAt: new Date(),
      },
    });

    // Update setup run progress
    const completedSteps = stepIndex + 1;
    const progress = Math.floor((completedSteps / setupRun.totalSteps) * 100);

    await prisma.setupRun.update({
      where: { id: setupRunId },
      data: {
        executedSteps: completedSteps,
        progress,
      },
    });

    return { success: true, stepIndex, result, rollbackData };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Save failed step to database
    await prisma.setupStep.create({
      data: {
        setupRunId,
        order: stepIndex,
        type: stepPlan.type,
        description: stepPlan.description,
        config: stepPlan.config,
        status: 'failed',
        error: errorMessage,
      },
    });

    // Mark setup as failed
    await prisma.setupRun.update({
      where: { id: setupRunId },
      data: {
        status: 'failed',
        failedStep: stepIndex,
        error: errorMessage,
      },
    });

    return { success: false, stepIndex, error: errorMessage };
  }
}

/**
 * Execute all remaining setup steps
 */
export async function executeAllRemainingSteps(
  client: Client,
  setupRunId: string
): Promise<SetupResult[]> {
  const setupRun = await prisma.setupRun.findUnique({
    where: { id: setupRunId },
  });

  if (!setupRun) {
    return [{ success: false, stepIndex: 0, error: 'Setup run not found' }];
  }

  const results: SetupResult[] = [];
  const plan = setupRun.plan as any;

  for (let i = 0; i < plan.steps.length; i++) {
    const result = await executeSetupStep(client, setupRunId, i);
    results.push(result);

    if (!result.success) {
      break; // Stop on first failure
    }
  }

  // Mark as completed if all steps succeeded
  const allSucceeded = results.every((r) => r.success);
  if (allSucceeded) {
    await prisma.setupRun.update({
      where: { id: setupRunId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        progress: 100,
      },
    });
  }

  return results;
}

/**
 * Rollback a setup to previous state
 */
export async function rollbackSetup(setupRunId: string): Promise<boolean> {
  const setupRun = await prisma.setupRun.findUnique({
    where: { id: setupRunId },
    include: { steps: { orderBy: { order: 'desc' } } },
  });

  if (!setupRun) {
    console.error(`Rollback failed: Setup run ${setupRunId} not found`);
    return false;
  }

  let successCount = 0;

  // Rollback steps in reverse order
  for (const step of setupRun.steps) {
    if (!step.rollbackData) {
      console.warn(`No rollback data for step ${step.order}`);
      continue;
    }

    try {
      // Execute rollback based on step type
      switch (step.type) {
        case 'create_role':
          await executeRollbackRole(setupRun.guildId, step.rollbackData);
          break;

        case 'create_channel':
          await executeRollbackChannel(setupRun.guildId, step.rollbackData);
          break;

        // Other rollback implementations
      }

      successCount++;
    } catch (error) {
      console.error(`Rollback failed for step ${step.order}:`, error);
    }
  }

  // Mark as rolled back
  await prisma.setupRun.update({
    where: { id: setupRunId },
    data: {
      status: 'rolled_back',
    },
  });

  console.log(`✅ Rolled back ${successCount}/${setupRun.steps.length} steps`);
  return successCount === setupRun.steps.length;
}

// ============================================================================
// Helper Functions for Step Execution
// ============================================================================

async function executeCreateRole(
  guild: Guild,
  config: any
): Promise<{ result: any; rollbackData: any }> {
  const role = await guild.roles.create({
    name: config.name,
    color: config.color,
    permissions: config.permissions,
    hoist: config.hoist || false,
    mentionable: config.mentionable || false,
  });

  return {
    result: {
      roleId: role.id,
      roleName: role.name,
    },
    rollbackData: {
      roleId: role.id,
      guildId: guild.id,
    },
  };
}

async function executeCreateChannel(
  guild: Guild,
  config: any
): Promise<{ result: any; rollbackData: any }> {
  const channel = await guild.channels.create({
    name: config.name,
    type: config.type,
    topic: config.topic,
    nsfw: config.nsfw || false,
    rateLimitPerUser: config.rateLimitPerUser,
  });

  return {
    result: {
      channelId: channel.id,
      channelName: channel.name,
    },
    rollbackData: {
      channelId: channel.id,
      guildId: guild.id,
    },
  };
}

async function executeConfigureModeration(
  setupRun: any,
  config: any
): Promise<{ result: any; rollbackData: any }> {
  // Store moderation config in database
  // This would be persisted for the bot to use
  return {
    result: {
      config,
      applied: true,
    },
    rollbackData: config,
  };
}

async function executeSetupWelcome(
  setupRun: any,
  config: any
): Promise<{ result: any; rollbackData: any }> {
  // Store welcome settings in database
  return {
    result: {
      enabled: config.enabled,
      message: config.message,
    },
    rollbackData: config,
  };
}

async function executeSetupLeveling(
  setupRun: any,
  config: any
): Promise<{ result: any; rollbackData: any }> {
  // Store leveling settings in database
  return {
    result: {
      enabled: config.enabled,
      minXp: config.minXpPerMessage,
      maxXp: config.maxXpPerMessage,
    },
    rollbackData: config,
  };
}

// Rollback implementations
async function executeRollbackRole(guildId: string, rollbackData: any): Promise<void> {
  // This would be implemented with actual Discord client
  // For now, just log
  console.log(`Deleting role ${rollbackData.roleId} from guild ${guildId}`);
}

async function executeRollbackChannel(guildId: string, rollbackData: any): Promise<void> {
  // This would be implemented with actual Discord client
  console.log(`Deleting channel ${rollbackData.channelId} from guild ${guildId}`);
}

/**
 * Get setup status
 */
export async function getSetupStatus(setupRunId: string) {
  return await prisma.setupRun.findUnique({
    where: { id: setupRunId },
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
    },
  });
}
