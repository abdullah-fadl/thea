/**
 * SCM BC8 Analytics — Single Alert Rule
 *
 * GET    /api/imdad/analytics/alert-rules/:id — Get alert rule
 * PUT    /api/imdad/analytics/alert-rules/:id — Update alert rule (optimistic locking)
 * DELETE /api/imdad/analytics/alert-rules/:id — Soft-delete alert rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single alert rule
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const alertRule = await prisma.imdadAlertRule.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!alertRule) {
        return NextResponse.json({ error: 'Alert rule not found' }, { status: 404 });
      }

      return NextResponse.json({ data: alertRule });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.alerts.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update alert rule with optimistic locking
// ---------------------------------------------------------------------------

const updateAlertRuleSchema = z.object({
  version: z.number().int(),
  ruleName: z.string().min(1).max(200).optional(),
  kpiCode: z.string().optional(),
  conditionType: z.string().optional(),
  thresholdValue: z.number().optional(),
  severity: z.string().optional(),
  scopeType: z.string().optional(),
  scopeId: z.string().optional(),
  isActive: z.boolean().optional(),
  cooldownMinutes: z.number().int().optional(),
  notificationChannels: z.array(z.string()).optional(),
  escalationConfig: z.record(z.string(), z.any()).optional(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateAlertRuleSchema.parse(body);

      const { version, ...updates } = parsed;

      const existing = await prisma.imdadAlertRule.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Alert rule not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — alert rule was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const alertRule = await prisma.imdadAlertRule.update({
        where: { id },
        data: {
          ...updates,
          version: { increment: 1 },
          updatedBy: userId,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'ALERT_RULE',
        resourceId: id,
        boundedContext: 'BC8_ANALYTICS',
        previousData: existing as any,
        newData: alertRule as any,
        request: req,
      });

      return NextResponse.json({ data: alertRule });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.alerts.update' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft-delete alert rule
// ---------------------------------------------------------------------------

const deleteAlertRuleSchema = z.object({
  version: z.number().int(),
});

export const DELETE = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = deleteAlertRuleSchema.parse(body);

      const existing = await prisma.imdadAlertRule.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Alert rule not found' }, { status: 404 });
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict — alert rule was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const alertRule = await prisma.imdadAlertRule.update({
        where: { id },
        data: {
          isDeleted: true,
          version: { increment: 1 },
          updatedBy: userId,
        },
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'DELETE',
        resourceType: 'ALERT_RULE',
        resourceId: id,
        boundedContext: 'BC8_ANALYTICS',
        previousData: existing as any,
        request: req,
      });

      return NextResponse.json({ data: { id, deleted: true } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.alerts.update' }
);
