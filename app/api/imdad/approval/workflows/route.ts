/**
 * SCM Approval — Workflow Templates
 *
 * GET  /api/imdad/approval/workflows — List workflow templates
 * POST /api/imdad/approval/workflows — Create workflow template
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List workflow templates
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  documentType: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  organizationId: z.string().uuid().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, documentType, isActive, organizationId } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (documentType) where.documentType = documentType;
      if (isActive !== undefined) where.isActive = isActive;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadApprovalWorkflowTemplate.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { rules: { where: { isDeleted: false } as any, orderBy: { ruleOrder: 'asc' } } } as any,
        }),
        prisma.imdadApprovalWorkflowTemplate.count({ where }),
      ]);

      return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.approval.workflows.list' }
);

// ---------------------------------------------------------------------------
// POST — Create workflow template
// ---------------------------------------------------------------------------

const createWorkflowSchema = z.object({
  organizationId: z.string().uuid(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  documentType: z.string().min(1),
  isActive: z.boolean().default(true),
  autoApproveBelow: z.number().min(0).optional(),
  currency: z.string().default('SAR'),
  notes: z.string().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createWorkflowSchema.parse(body);

      const workflow = await prisma.imdadApprovalWorkflowTemplate.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          name: parsed.name,
          nameAr: parsed.nameAr,
          description: parsed.description ?? parsed.notes,
          documentType: parsed.documentType as any,
          isActive: parsed.isActive,
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
        resourceType: 'approval_workflow',
        resourceId: workflow.id,
        boundedContext: 'BC8_APPROVAL',
        newData: workflow as any,
        request: req,
      });

      return NextResponse.json({ data: workflow }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.approval.workflows.create' }
);
