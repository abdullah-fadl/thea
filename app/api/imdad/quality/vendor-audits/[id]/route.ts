/**
 * SCM BC6 Quality — Single Vendor Audit
 *
 * GET   /api/imdad/quality/vendor-audits/:id — Get vendor audit with findings
 * PUT   /api/imdad/quality/vendor-audits/:id — Update audit (optimistic locking)
 * PATCH /api/imdad/quality/vendor-audits/:id — Complete audit (set outcome, findings, summary)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — Single vendor audit with findings
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const audit = await prisma.imdadVendorAudit.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: {
          findings: { where: { isDeleted: false }, orderBy: { createdAt: 'asc' } },
        } as any,
      });

      if (!audit) {
        return NextResponse.json({ error: 'Vendor audit not found' }, { status: 404 });
      }

      return NextResponse.json({ data: audit });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update vendor audit with optimistic locking
// ---------------------------------------------------------------------------

const updateAuditSchema = z.object({
  version: z.number().int({ message: 'version is required for optimistic locking' }),
  vendorName: z.string().min(1).optional(),
  auditType: z.string().optional(),
  plannedDate: z.string().optional(),
  leadAuditorId: z.string().optional(),
  scope: z.string().optional(),
  criteria: z.string().optional(),
  auditorTeam: z.array(z.string()).optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateAuditSchema.parse(body);

      const { version, ...updates } = parsed;

      const existing = await prisma.imdadVendorAudit.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Vendor audit not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — vendor audit was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const updateData: any = {
        ...updates,
        version: { increment: 1 },
        updatedBy: userId,
      };

      if (updates.plannedDate) {
        updateData.plannedDate = new Date(updates.plannedDate);
      }

      const audit = await prisma.imdadVendorAudit.update({
        where: { id },
        data: updateData as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'VENDOR_AUDIT',
        resourceId: id,
        boundedContext: 'BC6_QUALITY',
        previousData: existing as any,
        newData: audit as any,
        request: req,
      });

      return NextResponse.json({ data: audit });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.audit.update' }
);

// ---------------------------------------------------------------------------
// PATCH — Complete audit (set outcome, findings counts, summary)
// ---------------------------------------------------------------------------

const completeAuditSchema = z.object({
  version: z.number().int({ message: 'version is required for optimistic locking' }),
  outcome: z.string().min(1, 'outcome is required'),
  summary: z.string().optional(),
  findingsTotal: z.number().int().min(0).optional(),
  findingsCritical: z.number().int().min(0).optional(),
  findingsMajor: z.number().int().min(0).optional(),
  findingsMinor: z.number().int().min(0).optional(),
  findingsObservation: z.number().int().min(0).optional(),
  completedAt: z.string().optional(),
});

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = completeAuditSchema.parse(body);

      const { version, ...fields } = parsed;

      const existing = await prisma.imdadVendorAudit.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Vendor audit not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — vendor audit was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const audit = await prisma.imdadVendorAudit.update({
        where: { id },
        data: {
          outcome: fields.outcome as any,
          summary: fields.summary,
          findingsCount: fields.findingsTotal,
          criticalFindings: fields.findingsCritical,
          majorFindings: fields.findingsMajor,
          minorFindings: fields.findingsMinor,
          completedAt: fields.completedAt ? new Date(fields.completedAt) : new Date(),
          status: 'COMPLETED',
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
        resourceType: 'VENDOR_AUDIT',
        resourceId: id,
        boundedContext: 'BC6_QUALITY',
        previousData: existing as any,
        newData: audit as any,
        request: req,
        metadata: { action: 'COMPLETE_AUDIT', outcome: fields.outcome },
      });

      return NextResponse.json({ data: audit });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.audit.update' }
);
