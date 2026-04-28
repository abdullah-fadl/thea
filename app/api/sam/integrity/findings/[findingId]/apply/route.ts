import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { validateBody } from '@/lib/validation/helpers';
import { integrityFindingApplySchema } from '@/lib/validation/sam.schema';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Build a human-readable description of the remediation action based on
 * the finding's severity, category, and suggested action (if any).
 */
function describeRemediationAction(finding: {
  severity?: string | null;
  category?: string | null;
  title?: string | null;
  metadata?: any;
}): string {
  const suggestedAction =
    finding.metadata?.suggestedAction ||
    finding.metadata?.suggested_action ||
    null;

  if (suggestedAction && typeof suggestedAction === 'string') {
    return `Applied suggested action: ${suggestedAction}`;
  }

  const sev = (finding.severity || 'MEDIUM').toUpperCase();
  const cat = finding.category || 'general';
  return `Auto-resolved ${sev}-severity "${cat}" finding: ${finding.title || 'Untitled'}`;
}

export const POST = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const findingId = String((resolvedParams as Record<string, string>)?.findingId || '').trim();
      if (!findingId) {
        return NextResponse.json({ error: 'findingId is required' }, { status: 400 });
      }

      const rawBody = await req.json().catch(() => ({}));
      const v = validateBody(rawBody, integrityFindingApplySchema);
      if ('error' in v) return v.error;
      const { confirm } = v.data;

      // ── Fetch the finding ──────────────────────────────────────
      const finding = await prisma.integrityFinding.findFirst({
        where: { tenantId, id: findingId, archivedAt: null },
      });
      if (!finding) {
        return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
      }

      // ── Guard: only OPEN findings can be remediated ────────────
      if (finding.status === 'RESOLVED') {
        return NextResponse.json(
          { error: 'Finding is already resolved', resolvedAt: finding.resolvedAt },
          { status: 409 }
        );
      }
      if (finding.status === 'IGNORED') {
        return NextResponse.json(
          { error: 'Finding has been dismissed and cannot be remediated' },
          { status: 409 }
        );
      }

      // ── Preview mode (confirm=false) ───────────────────────────
      const actionDescription = describeRemediationAction(finding);

      if (confirm !== true) {
        return NextResponse.json(
          {
            preview: true,
            summary: {
              willResolve: 1,
              mayCreate: 0,
            },
            finding: {
              id: finding.id,
              severity: finding.severity,
              category: finding.category,
              title: finding.title,
              status: finding.status,
            },
            proposedAction: actionDescription,
          },
          { status: 200 }
        );
      }

      // ── Apply remediation ──────────────────────────────────────
      const resolvedAt = new Date();

      // 1. Update finding status to RESOLVED
      await prisma.integrityFinding.update({
        where: { id: findingId },
        data: {
          status: 'RESOLVED',
          resolvedAt,
          resolvedBy: userId || null,
          updatedAt: resolvedAt,
          updatedBy: userId || null,
          metadata: {
            ...(typeof finding.metadata === 'object' && finding.metadata !== null
              ? finding.metadata as Record<string, unknown>
              : {}),
            remediationAppliedAt: resolvedAt.toISOString(),
            remediationAppliedBy: userId || 'system',
            remediationAction: actionDescription,
          } as Prisma.InputJsonValue,
        },
      });

      // 2. Record the remediation activity in the audit log
      await prisma.integrityActivity.create({
        data: {
          tenantId,
          type: 'REMEDIATION_APPLIED',
          message: actionDescription,
          userId: userId || null,
          metadata: {
            findingId,
            ruleId: finding.ruleId,
            rulesetId: finding.rulesetId,
            runId: finding.runId,
            severity: finding.severity,
            category: finding.category,
            previousStatus: finding.status,
            newStatus: 'RESOLVED',
          } as Prisma.InputJsonValue,
          createdAt: resolvedAt,
        },
      });

      logger.info('Integrity finding remediation applied', {
        category: 'system',
        tenantId,
        findingId,
        userId,
        findingSeverity: finding.severity,
        findingCategory: finding.category,
      });

      return NextResponse.json({
        success: true,
        findingId,
        resolvedAt: resolvedAt.toISOString(),
        action: actionDescription,
      });
    } catch (error: any) {
      logger.error('Integrity finding apply error:', { error: error });
      // [SEC-06]
      return NextResponse.json(
        { error: 'Failed to apply integrity remediation' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.integrity.apply' }
);
