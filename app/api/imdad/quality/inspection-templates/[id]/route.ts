/**
 * SCM BC6 Quality — Single Inspection Template
 *
 * GET    /api/imdad/quality/inspection-templates/[id] — Get inspection template by id
 * PUT    /api/imdad/quality/inspection-templates/[id] — Update template (optimistic locking)
 * DELETE /api/imdad/quality/inspection-templates/[id] — Soft-delete template
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — Get ImdadInspectionTemplate by id
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }, params) => {
    const { id } = (await params) as { id: string };

    const template = await prisma.imdadInspectionTemplate.findFirst({
      where: { id, tenantId, isDeleted: false },
    });

    if (!template) {
      return NextResponse.json({ error: 'Inspection template not found' }, { status: 404 });
    }

    return NextResponse.json({ data: template });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update ImdadInspectionTemplate (optimistic locking via version)
// ---------------------------------------------------------------------------
const checkSchema = z.object({
  checkId: z.string().min(1),
  checkName: z.string().min(1),
  checkType: z.string().min(1),
  description: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  isMandatory: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const updateTemplateSchema = z.object({
  version: z.number().int('version is required for optimistic locking'),
  templateName: z.string().min(1).optional(),
  templateNameAr: z.string().optional(),
  inspectionType: z.string().min(1).optional(),
  itemCategory: z.string().optional(),
  checks: z.array(checkSchema).min(1).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    const { id } = (await params) as { id: string };
    const body = await req.json();
    const parsed = updateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { version, ...updates } = parsed.data;

    const existing = await prisma.imdadInspectionTemplate.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Inspection template not found' }, { status: 404 });
    }
    if (existing.version !== version) {
      return NextResponse.json(
        { error: 'Version conflict — record was modified by another user', currentVersion: existing.version },
        { status: 409 }
      );
    }

    const oldData = { ...existing } as any;

    const template = await prisma.imdadInspectionTemplate.update({
      where: { id },
      data: {
        ...updates,
        checks: updates.checks as any,
        version: { increment: 1 },
        updatedBy: userId,
      } as any,
    });

    await imdadAudit.log({
      tenantId,
      organizationId: existing.organizationId,
      actorUserId: userId,
      action: 'UPDATE',
      resourceType: 'INSPECTION_TEMPLATE',
      resourceId: template.id,
      boundedContext: 'BC6_QUALITY',
      previousData: oldData,
      newData: template as any,
      request: req,
    });

    return NextResponse.json({ data: template });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.template.update' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft-delete ImdadInspectionTemplate
// ---------------------------------------------------------------------------
export const DELETE = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    const { id } = (await params) as { id: string };

    const existing = await prisma.imdadInspectionTemplate.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Inspection template not found' }, { status: 404 });
    }

    const template = await prisma.imdadInspectionTemplate.update({
      where: { id },
      data: {
        isDeleted: true,
        version: { increment: 1 },
        updatedBy: userId,
      },
    });

    await imdadAudit.log({
      tenantId,
      organizationId: existing.organizationId,
      actorUserId: userId,
      action: 'DELETE',
      resourceType: 'INSPECTION_TEMPLATE',
      resourceId: template.id,
      boundedContext: 'BC6_QUALITY',
      previousData: existing as any,
      request: req,
    });

    return NextResponse.json({ data: { id: template.id, deleted: true } });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.template.delete' }
);
