/**
 * Discord Setup Safety & Approval Middleware
 * Ensures all Discord modification operations are properly reviewed and approved
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ApprovalContext {
  setupRunId: string;
  action: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  requires_approval: boolean;
  reason: string;
}

declare global {
  namespace Express {
    interface Request {
      approvalContext?: ApprovalContext;
      safetyLevel?: 'safe' | 'moderate' | 'risky';
    }
  }
}

/**
 * Determine risk level for a Discord action
 */
function assessRiskLevel(action: string, config: any): 'safe' | 'moderate' | 'risky' {
  // Safe operations: viewing, reading configuration
  if (action.match(/get|fetch|read|view|status/)) {
    return 'safe';
  }

  // Risky operations: role hierarchy changes, permission changes
  if (action.match(/delete|remove.*role|change.*permission|edit.*admin/)) {
    return 'risky';
  }

  // Moderate: channel creation, basic role creation, welcome setup
  if (action.match(/create|setup|configure/)) {
    return 'moderate';
  }

  return 'moderate';
}

/**
 * Middleware to assess and enforce approval for Discord setup changes
 */
export async function discordSetupSafety(req: Request, res: Response, next: NextFunction) {
  try {
    const setupRunId = req.params.setupRunId;
    const action = req.path.split('/').pop() || 'unknown';

    if (!setupRunId) {
      return next();
    }

    // Fetch setup run to check approval status
    const setupRun = await prisma.setupRun.findUnique({
      where: { id: setupRunId },
    });

    if (!setupRun) {
      return res.status(404).json({
        success: false,
        error: 'Setup run not found',
      });
    }

    // Determine risk level
    const safetyLevel = assessRiskLevel(action, setupRun.plan);
    req.safetyLevel = safetyLevel;

    // Check approval requirements based on risk level
    if (safetyLevel === 'risky') {
      if (!setupRun.planApproved) {
        return res.status(403).json({
          success: false,
          error: 'This operation requires explicit approval',
          approvalRequired: true,
          severity: 'high',
        });
      }

      if (!setupRun.approvedBy || !setupRun.approvedAt) {
        return res.status(403).json({
          success: false,
          error: 'Approval information is missing or invalid',
        });
      }
    }

    // Risky operations also require the setup to be in 'ready_for_approval' or 'executing' state
    if (action === 'execute-all' && setupRun.status !== 'executing' && setupRun.status !== 'ready_for_approval') {
      return res.status(409).json({
        success: false,
        error: `Cannot execute setup in state: ${setupRun.status}`,
      });
    }

    // Store approval context
    req.approvalContext = {
      setupRunId,
      action,
      severity:
        safetyLevel === 'risky' ? 'critical' : safetyLevel === 'moderate' ? 'medium' : 'low',
      requires_approval: safetyLevel === 'risky',
      reason: `Discord setup operation: ${action} with safety level ${safetyLevel}`,
    };

    next();
  } catch (error) {
    console.error('Discord setup safety check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Safety check failed',
    });
  }
}

/**
 * Enforce plan approval before setup execution
 */
export async function requireApprovedPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const setupRunId = req.params.setupRunId;

    if (!setupRunId) {
      return next();
    }

    const setupRun = await prisma.setupRun.findUnique({
      where: { id: setupRunId },
    });

    if (!setupRun) {
      return res.status(404).json({
        success: false,
        error: 'Setup run not found',
      });
    }

    if (!setupRun.planApproved) {
      return res.status(403).json({
        success: false,
        error: 'Setup plan must be approved before execution',
        status: setupRun.status,
        action: 'approve',
      });
    }

    if (!setupRun.approvedBy) {
      return res.status(403).json({
        success: false,
        error: 'Setup plan approval information is invalid',
      });
    }

    // Check approval timestamp (approvals valid for 24 hours)
    const approvalAge = Date.now() - (setupRun.approvedAt?.getTime() || 0);
    const APPROVAL_TTL = 24 * 60 * 60 * 1000; // 24 hours

    if (approvalAge > APPROVAL_TTL) {
      return res.status(403).json({
        success: false,
        error: 'Plan approval has expired. Please re-approve.',
        action: 'reapprove',
      });
    }

    next();
  } catch (error) {
    console.error('Plan approval check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Approval check failed',
    });
  }
}

/**
 * Audit log for all Discord setup operations
 */
export async function auditDiscordSetupOperation(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const originalJson = res.json;

  res.json = function (body: any) {
    if (req.approvalContext && req.user) {
      // Log the operation
      prisma.auditLog
        .create({
          data: {
            action: `discord_setup.${req.approvalContext.action}`,
            resourceType: 'discord_setup',
            resourceId: req.approvalContext.setupRunId,
            userId: req.user.id,
            severity: req.approvalContext.severity,
            changes: {
              action: req.approvalContext.action,
              status: body?.data?.status,
              result: body?.success ? 'success' : 'failure',
            },
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
          },
        })
        .catch((error) => console.error('Failed to log audit entry:', error));
    }

    return originalJson.call(this, body);
  };

  next();
}

/**
 * Rate limiting for destructive operations
 * Prevents accidental bulk operations
 */
interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

const rateLimitStore: RateLimitStore = {};

export function rateLimitDiscordSetup(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id || 'anonymous';
  const action = req.path;
  const key = `${userId}:${action}`;

  const now = Date.now();
  const limit = rateLimitStore[key];

  // Reset if window expired
  if (!limit || limit.resetTime < now) {
    rateLimitStore[key] = {
      count: 1,
      resetTime: now + 60 * 1000, // 1 minute window
    };
    return next();
  }

  // Check if limit exceeded (3 requests per minute per action)
  if (limit.count >= 3) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please wait before trying again.',
      retryAfter: Math.ceil((limit.resetTime - now) / 1000),
    });
  }

  rateLimitStore[key].count++;
  res.set('X-RateLimit-Remaining', String(3 - limit.count));
  next();
}

/**
 * Validate setup configuration before approval
 */
export async function validateSetupConfiguration(req: Request, res: Response, next: NextFunction) {
  try {
    const setupRunId = req.params.setupRunId;

    if (!setupRunId) {
      return next();
    }

    const setupRun = await prisma.setupRun.findUnique({
      where: { id: setupRunId },
    });

    if (!setupRun) {
      return res.status(404).json({
        success: false,
        error: 'Setup run not found',
      });
    }

    const plan = setupRun.plan as any;

    if (!plan || !plan.steps || plan.steps.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Setup plan is empty or invalid',
      });
    }

    // Validate all steps have required fields
    for (const step of plan.steps) {
      if (!step.type || !step.description || !step.config) {
        return res.status(400).json({
          success: false,
          error: `Invalid step configuration at step ${step.order}`,
        });
      }
    }

    next();
  } catch (error) {
    console.error('Configuration validation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Configuration validation failed',
    });
  }
}
