/**
 * SCM BC8 Analytics — Single Dashboard Configuration
 *
 * GET    /api/imdad/analytics/dashboards/:id — Get dashboard config
 * PUT    /api/imdad/analytics/dashboards/:id — Update dashboard config (optimistic locking)
 * DELETE /api/imdad/analytics/dashboards/:id — Soft-delete dashboard config
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single dashboard configuration
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const dashboard = await prisma.imdadDashboardConfig.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!dashboard) {
        return NextResponse.json({ error: 'Dashboard configuration not found' }, { status: 404 });
      }

      return NextResponse.json({ data: dashboard });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.dashboards.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update dashboard configuration with optimistic locking
// ---------------------------------------------------------------------------

const updateDashboardSchema = z.object({
  version: z.number().int(),
  configName: z.string().min(1).max(200).optional(),
  configType: z.string().optional(),
  layout: z.record(z.string(), z.any()).optional(),
  widgets: z.array(z.record(z.string(), z.any())).optional(),
  roleType: z.string().optional(),
  isDefault: z.boolean().optional(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateDashboardSchema.parse(body);

      const { version, ...updates } = parsed;

      const existing = await prisma.imdadDashboardConfig.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Dashboard configuration not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — dashboard configuration was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const dashboard = await prisma.imdadDashboardConfig.update({
        where: { id },
        data: {
          ...updates,
          version: { increment: 1 },
          updatedBy: userId,
        },
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'DASHBOARD_CONFIG',
        resourceId: id,
        boundedContext: 'BC8_ANALYTICS',
        previousData: existing as any,
        newData: dashboard as any,
        request: req,
      });

      return NextResponse.json({ data: dashboard });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.dashboards.update' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft-delete dashboard configuration
// ---------------------------------------------------------------------------

const deleteDashboardSchema = z.object({
  version: z.number().int(),
});

export const DELETE = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = deleteDashboardSchema.parse(body);

      const existing = await prisma.imdadDashboardConfig.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Dashboard configuration not found' }, { status: 404 });
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict — dashboard configuration was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const dashboard = await prisma.imdadDashboardConfig.update({
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
        resourceType: 'DASHBOARD_CONFIG',
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
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.dashboards.update' }
);
