/**
 * SCM BC8 Analytics — Single Report Definition
 *
 * GET    /api/imdad/analytics/reports/:id — Get report definition
 * PUT    /api/imdad/analytics/reports/:id — Update report definition (optimistic locking)
 * DELETE /api/imdad/analytics/reports/:id — Soft-delete report definition (blocked if isSystem)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single report definition
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const report = await prisma.imdadReportDefinition.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!report) {
        return NextResponse.json({ error: 'Report definition not found' }, { status: 404 });
      }

      return NextResponse.json({ data: report });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.reports.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update report definition with optimistic locking
// ---------------------------------------------------------------------------

const updateReportSchema = z.object({
  version: z.number().int(),
  reportName: z.string().min(1).max(200).optional(),
  reportCategory: z.string().optional(),
  queryConfig: z.record(z.string(), z.any()).optional(),
  description: z.string().optional(),
  outputFormats: z.array(z.string()).optional(),
  isScheduled: z.boolean().optional(),
  scheduleConfig: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
  parameters: z.array(z.record(z.string(), z.any())).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateReportSchema.parse(body);

      const { version, ...updates } = parsed;

      const existing = await prisma.imdadReportDefinition.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Report definition not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — report definition was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const report = await prisma.imdadReportDefinition.update({
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
        resourceType: 'REPORT_DEFINITION',
        resourceId: id,
        boundedContext: 'BC8_ANALYTICS',
        previousData: existing as any,
        newData: report as any,
        request: req,
      });

      return NextResponse.json({ data: report });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.reports.update' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft-delete report definition (blocked if isSystem is true)
// ---------------------------------------------------------------------------

const deleteReportSchema = z.object({
  version: z.number().int(),
});

export const DELETE = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = deleteReportSchema.parse(body);

      const existing = await prisma.imdadReportDefinition.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Report definition not found' }, { status: 404 });
      }

      if (existing.isSystem) {
        return NextResponse.json(
          { error: 'System report definitions cannot be deleted' },
          { status: 400 }
        );
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict — report definition was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const report = await prisma.imdadReportDefinition.update({
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
        resourceType: 'REPORT_DEFINITION',
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
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.reports.update' }
);
