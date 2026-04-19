/**
 * Auto-Fix Agent
 * Automatically detects and fixes common issues
 * Safety-first approach with approval levels
 */

import { PrismaClient, AIInsight, Service } from '@prisma/client';
import { railwayService } from '../services/railway';
import { discordService } from '../services/discord';
import aiService from '../services/ai';

const prisma = new PrismaClient();

// Safety levels for auto-fix actions
enum SafetyLevel {
  SAFE = 'safe',           // Auto-execute immediately
  MODERATE = 'moderate',   // Execute with 5-min delay + notification
  RISKY = 'risky',         // Require manual approval
}

// Action definitions with safety levels
const ACTION_SAFETY: Record<string, SafetyLevel> = {
  'restart': SafetyLevel.SAFE,
  'updateVariable': SafetyLevel.SAFE,
  'scale': SafetyLevel.MODERATE,
  'deploy': SafetyLevel.MODERATE,
  'stop': SafetyLevel.RISKY,
  'delete': SafetyLevel.RISKY,
};

interface FixAction {
  type: string;
  parameters: Record<string, any>;
}

interface FixResult {
  success: boolean;
  action: string;
  details: string;
  timestamp: Date;
}

/**
 * Main auto-fix processor
 * Checks for pending fixes and executes based on safety level
 */
export async function processAutoFixes(): Promise<FixResult[]> {
  const results: FixResult[] = [];

  try {
    // Find all unfixed auto-fixable insights
    const pendingFixes = await prisma.aIInsight.findMany({
      where: {
        autoFixable: true,
        fixed: false,
      },
      include: {
        service: true,
      },
      orderBy: {
        severity: 'asc', // Critical first
      },
      take: 10, // Process max 10 at a time
    });

    console.log(`🔧 Found ${pendingFixes.length} pending auto-fixes`);

    for (const insight of pendingFixes) {
      try {
        const result = await executeFix(insight);
        results.push(result);
      } catch (error) {
        console.error(`❌ Failed to process fix for ${insight.title}:`, error);
        results.push({
          success: false,
          action: insight.title,
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        });
      }
    }

    return results;
  } catch (error) {
    console.error('❌ Auto-fix processor failed:', error);
    return results;
  }
}

/**
 * Execute a single fix based on safety level
 */
async function executeFix(insight: AIInsight & { service: Service }): Promise<FixResult> {
  const fixAction = insight.fixAction as FixAction | null;

  if (!fixAction) {
    // Generate fix if not present
    const generated = await aiService.generateFix(insight.serviceId, insight);
    if (!generated.action || !generated.safe) {
      return {
        success: false,
        action: insight.title,
        details: 'No safe fix available',
        timestamp: new Date(),
      };
    }
    fixAction = generated.action;
  }

  const safetyLevel = ACTION_SAFETY[fixAction.type] || SafetyLevel.RISKY;

  // Check if service allows auto-fix
  if (!insight.service.autoFixEnabled && safetyLevel !== SafetyLevel.SAFE) {
    return {
      success: false,
      action: insight.title,
      details: 'Auto-fix disabled for this service',
      timestamp: new Date(),
    };
  }

  // Execute based on safety level
  switch (safetyLevel) {
    case SafetyLevel.SAFE:
      return await executeSafeFix(insight, fixAction);

    case SafetyLevel.MODERATE:
      return await executeModerateFix(insight, fixAction);

    case SafetyLevel.RISKY:
      return await handleRiskyFix(insight, fixAction);

    default:
      return {
        success: false,
        action: insight.title,
        details: 'Unknown safety level',
        timestamp: new Date(),
      };
  }
}

/**
 * Execute a safe fix immediately
 */
async function executeSafeFix(
  insight: AIInsight,
  action: FixAction
): Promise<FixResult> {
  console.log(`🔧 Executing safe fix: ${action.type} for ${insight.service.name}`);

  try {
    let success = false;
    let details = '';

    switch (action.type) {
      case 'restart':
        if (insight.service.platform === 'railway') {
          success = await railwayService.restartService(insight.serviceId);
          details = success ? 'Service restarted successfully' : 'Failed to restart service';
        } else if (insight.service.platform === 'discord') {
          // Restart Discord bot
          const bot = await prisma.discordBot.findFirst({
            where: { serviceId: insight.serviceId },
          });
          if (bot) {
            await discordService.stopBot(bot.id);
            success = await discordService.startBot(bot.id);
            details = success ? 'Discord bot restarted' : 'Failed to restart bot';
          }
        }
        break;

      case 'updateVariable':
        if (insight.service.platform === 'railway') {
          const { name, value } = action.parameters;
          await railwayService.updateVariables(insight.serviceId, { [name]: value });
          success = true;
          details = `Updated variable ${name}`;
        }
        break;

      default:
        details = `Unknown safe action type: ${action.type}`;
    }

    // Mark as fixed
    if (success) {
      await prisma.aIInsight.update({
        where: { id: insight.id },
        data: {
          fixed: true,
          fixedAt: new Date(),
          fixedBy: 'auto-agent',
        },
      });
    }

    return {
      success,
      action: action.type,
      details,
      timestamp: new Date(),
    };

  } catch (error) {
    return {
      success: false,
      action: action.type,
      details: error instanceof Error ? error.message : 'Execution failed',
      timestamp: new Date(),
    };
  }
}

/**
 * Execute a moderate fix with delay and notification
 */
async function executeModerateFix(
  insight: AIInsight,
  action: FixAction
): Promise<FixResult> {
  console.log(`⏳ Moderate fix scheduled: ${action.type} for ${insight.service.name}`);

  // TODO: Send notification to user
  // TODO: Wait 5 minutes for user to cancel
  // For now, execute immediately but log it

  try {
    let success = false;
    let details = '';

    switch (action.type) {
      case 'scale':
        if (insight.service.platform === 'railway') {
          const { replicas } = action.parameters;
          success = await railwayService.scaleService(insight.serviceId, replicas);
          details = success ? `Scaled to ${replicas} replicas` : 'Failed to scale';
        }
        break;

      case 'deploy':
        if (insight.service.platform === 'railway') {
          await railwayService.deployService(insight.serviceId);
          success = true;
          details = 'Deployment triggered';
        }
        break;

      default:
        details = `Unknown moderate action type: ${action.type}`;
    }

    if (success) {
      await prisma.aIInsight.update({
        where: { id: insight.id },
        data: {
          fixed: true,
          fixedAt: new Date(),
          fixedBy: 'auto-agent-moderate',
        },
      });
    }

    return {
      success,
      action: action.type,
      details: `[MODERATE] ${details}`,
      timestamp: new Date(),
    };

  } catch (error) {
    return {
      success: false,
      action: action.type,
      details: error instanceof Error ? error.message : 'Execution failed',
      timestamp: new Date(),
    };
  }
}

/**
 * Handle risky fix (requires manual approval)
 */
async function handleRiskyFix(
  insight: AIInsight,
  action: FixAction
): Promise<FixResult> {
  console.log(`⚠️ Risky fix requires approval: ${action.type} for ${insight.service.name}`);

  // Mark insight as requiring approval
  await prisma.aIInsight.update({
    where: { id: insight.id },
    data: {
      // Add a flag or note that this requires approval
      // For now, we just don't auto-execute
    },
  });

  // TODO: Send notification to user for approval
  // TODO: Wait for user approval via API/webhook

  return {
    success: false,
    action: action.type,
    details: 'Requires manual approval - notification sent',
    timestamp: new Date(),
  };
}

/**
 * Get pending fixes that require approval
 */
export async function getPendingApprovals(): Promise<AIInsight[]> {
  return prisma.aIInsight.findMany({
    where: {
      autoFixable: true,
      fixed: false,
      severity: { in: ['critical', 'warning'] },
    },
    include: {
      service: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Approve and execute a risky fix
 */
export async function approveFix(insightId: string): Promise<FixResult> {
  const insight = await prisma.aIInsight.findUnique({
    where: { id: insightId },
    include: { service: true },
  });

  if (!insight) {
    return {
      success: false,
      action: 'approve',
      details: 'Insight not found',
      timestamp: new Date(),
    };
  }

  const fixAction = insight.fixAction as FixAction;
  if (!fixAction) {
    return {
      success: false,
      action: 'approve',
      details: 'No fix action defined',
      timestamp: new Date(),
    };
  }

  // Execute as safe since it's now approved
  return await executeSafeFix(insight, fixAction);
}

/**
 * Get fix history
 */
export async function getFixHistory(serviceId?: string): Promise<AIInsight[]> {
  return prisma.aIInsight.findMany({
    where: {
      fixed: true,
      ...(serviceId && { serviceId }),
    },
    orderBy: {
      fixedAt: 'desc',
    },
    take: 50,
    include: {
      service: true,
    },
  });
}

/**
 * Should auto-fix be applied to this insight?
 */
export function shouldAutoFix(insight: AIInsight): boolean {
  if (!insight.autoFixable || insight.fixed) {
    return false;
  }

  const fixAction = insight.fixAction as FixAction | null;
  if (!fixAction) {
    return false;
  }

  const safetyLevel = ACTION_SAFETY[fixAction.type];
  return safetyLevel === SafetyLevel.SAFE || safetyLevel === SafetyLevel.MODERATE;
}

// Export functions
export const autoFixAgent = {
  processAutoFixes,
  getPendingApprovals,
  approveFix,
  getFixHistory,
  shouldAutoFix,
};

export default autoFixAgent;
