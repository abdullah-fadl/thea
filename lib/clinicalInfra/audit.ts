import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { logger } from '@/lib/monitoring/logger';

export async function startAudit(args: {
  db?: any; // ignored — kept for call-site compat
  tenantId: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'ARCHIVE' | 'DELETE';
  before: any;
  after: any;
  ip?: string | null;
  path?: string | null;
}): Promise<{ auditId: string }> {
  const auditId = uuidv4();

  // Resolve tenant UUID from tenantId key
  const tenant = await prisma.tenant.findFirst({
    where: tenantWhere(args.tenantId),
    select: { id: true },
  });

  if (!tenant) {
    logger.warn('Skipping audit — no tenant found', { category: 'general', tenantId: args.tenantId });
    return { auditId };
  }

  try {
    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorUserId: args.userId,
        actorRole: 'unknown',
        action: args.action,
        resourceType: args.entityType,
        resourceId: args.entityId,
        ip: args.ip ?? null,
        path: args.path ?? null,
        success: true, // PENDING — will be updated by finishAudit
        metadata: {
          auditId,
          status: 'PENDING',
          before: args.before ?? null,
          after: args.after ?? null,
        },
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Failed to start audit', { category: 'general', error });
  }

  return { auditId };
}

export async function finishAudit(args: { db?: any; tenantId: string; auditId: string; ok: boolean; error?: string | null }) {
  try {
    // Find the audit log row by the embedded auditId in metadata
    const tenant = await prisma.tenant.findFirst({
      where: tenantWhere(args.tenantId),
      select: { id: true },
    });

    if (!tenant) return;

    // We stored auditId in metadata.auditId during startAudit.
    // Prisma JSON filter to find the matching row.
    const existing = await prisma.auditLog.findFirst({
      where: {
        tenantId: tenant.id,
        metadata: { path: ['auditId'], equals: args.auditId },
      },
    });

    if (!existing) return;

    await prisma.auditLog.update({
      where: { id: existing.id },
      data: {
        success: args.ok,
        errorMessage: args.error ?? null,
        metadata: {
          ...(typeof existing.metadata === 'object' && existing.metadata !== null ? existing.metadata as Record<string, any> : {}),
          status: args.ok ? 'DONE' : 'FAILED',
          finishedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Failed to finish audit', { category: 'general', error });
  }
}
