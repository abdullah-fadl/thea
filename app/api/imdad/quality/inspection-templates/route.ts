/**
 * SCM BC6 Quality — Inspection Templates
 *
 * GET  /api/imdad/quality/inspection-templates — List templates with pagination, search, filters
 * POST /api/imdad/quality/inspection-templates — Create a new inspection template
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List inspection templates
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
      const search = url.searchParams.get('search')?.trim() || '';
      const organizationId = url.searchParams.get('organizationId') || undefined;
      const inspectionType = url.searchParams.get('inspectionType') || undefined;
      const itemCategory = url.searchParams.get('itemCategory') || undefined;
      const isActive = url.searchParams.get('isActive');

      const where: any = { tenantId, isDeleted: false };

      if (organizationId) where.organizationId = organizationId;
      if (inspectionType) where.inspectionType = inspectionType;
      if (itemCategory) where.itemCategory = itemCategory;
      if (isActive !== null && isActive !== undefined) {
        where.isActive = isActive === 'true';
      }

      if (search) {
        where.OR = [
          { templateName: { contains: search, mode: 'insensitive' } },
          { templateCode: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadInspectionTemplate.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadInspectionTemplate.count({ where }),
      ]);

      return NextResponse.json({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.view' }
);

// ---------------------------------------------------------------------------
// POST — Create inspection template
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

const createTemplateSchema = z.object({
  templateCode: z.string().min(1, 'templateCode is required'),
  templateName: z.string().min(1, 'templateName is required'),
  inspectionType: z.string().min(1, 'inspectionType is required'),
  checks: z.array(checkSchema).min(1, 'At least one check is required'),
  organizationId: z.string().min(1, 'organizationId is required'),
  itemCategory: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createTemplateSchema.parse(body);

      // Unique constraint: [tenantId, organizationId, templateCode]
      const existing = await prisma.imdadInspectionTemplate.findFirst({
        where: {
          tenantId,
          organizationId: parsed.organizationId,
          templateCode: parsed.templateCode,
          isDeleted: false,
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Inspection template with this code already exists in this organization' },
          { status: 409 }
        );
      }

      const template = await prisma.imdadInspectionTemplate.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          templateCode: parsed.templateCode,
          templateName: parsed.templateName,
          inspectionType: parsed.inspectionType as any,
          checks: parsed.checks as any,
          itemCategory: parsed.itemCategory,
          isActive: parsed.isActive ?? true,
          metadata: parsed.metadata ?? undefined,
          createdBy: userId,
          updatedBy: userId,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'INSPECTION_TEMPLATE',
        resourceId: template.id,
        boundedContext: 'BC6_QUALITY',
        newData: template as any,
        request: req,
      });

      return NextResponse.json({ data: template }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.template.create' }
);
