/**
 * audit-log.ts — Persistent audit trail for all mutating operations
 * Ported from Dissident-Tokens-Vault (audit_logs table concept)
 *
 * Call auditLog() from any route handler after a successful mutating operation.
 * Non-blocking: failures are logged to console but never surface to callers.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import type { Request } from 'express';

const prisma = new PrismaClient();

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AuditOptions {
  action: string;           // e.g. 'auth.login', 'service.deploy', 'variable.update'
  resourceType?: string;    // e.g. 'service', 'variable', 'credential'
  resourceId?: string;
  changes?: Record<string, unknown>; // before/after snapshot — never include plaintext secrets
  userId?: string;
  severity?: AuditSeverity;
  req?: Request;            // Pass the Express request to capture IP + user-agent
}

export async function auditLog(opts: AuditOptions): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: opts.action,
        resourceType: opts.resourceType ?? null,
        resourceId: opts.resourceId ?? null,
        changes: (opts.changes as Prisma.InputJsonValue | undefined) ?? undefined,
        userId: opts.userId ?? null,
        severity: opts.severity ?? 'info',
        ipAddress: opts.req
          ? (opts.req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
              ?? opts.req.socket.remoteAddress
              ?? null
          : null,
        userAgent: opts.req ? (opts.req.headers['user-agent'] ?? null) : null,
      },
    });
  } catch (err) {
    // Audit logging must never crash the caller
    console.error('[AuditLog] Failed to write audit entry:', err);
  }
}

/** Read recent audit log entries. Used by the GET /api/audit-logs route. */
export async function getAuditLogs(opts: {
  limit?: number;
  offset?: number;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  severity?: AuditSeverity;
}) {
  const where: Record<string, unknown> = {};
  if (opts.action)       where.action       = opts.action;
  if (opts.resourceType) where.resourceType = opts.resourceType;
  if (opts.resourceId)   where.resourceId   = opts.resourceId;
  if (opts.severity)     where.severity     = opts.severity;

  const [total, entries] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take:  opts.limit  ?? 50,
      skip:  opts.offset ?? 0,
    }),
  ]);

  return { total, entries };
}
