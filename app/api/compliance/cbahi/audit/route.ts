import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/compliance/cbahi/audit
 * List CBAHI assessments for this tenant
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const limit = Math.min(100, Number(url.searchParams.get('limit')) || 50);

    const where: Record<string, unknown> = { tenantId };
    if (status) {
      where.status = status;
    }

    const items = await prisma.cbahiAssessment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ items, count: items.length });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'compliance.cbahi.view' }
);

const createAssessmentSchema = z.object({
  assessorName: z.string().min(1).optional(),
  status: z.enum(['draft', 'in_progress', 'completed', 'submitted']).optional().default('draft'),
  nextReviewDate: z.string().datetime().optional(),
}).passthrough();

/**
 * POST /api/compliance/cbahi/audit
 * Create a new CBAHI assessment
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const v = validateBody(body, createAssessmentSchema);
    if ('error' in v) return v.error;

    const assessment = await prisma.cbahiAssessment.create({
      data: {
        tenantId,
        assessorId: userId || null,
        assessorName: v.data.assessorName || user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || null,
        status: v.data.status,
        nextReviewDate: v.data.nextReviewDate ? new Date(v.data.nextReviewDate) : null,
        overallScore: 0,
        domainScores: {},
        findings: [],
        actionPlan: [],
      },
    });

    await createAuditLog(
      'cbahi_assessment',
      assessment.id,
      'CREATE',
      userId || 'system',
      user?.email,
      { after: assessment },
      tenantId
    );

    return NextResponse.json({ success: true, id: assessment.id, assessment });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'compliance.cbahi.manage' }
);

const updateAssessmentSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['draft', 'in_progress', 'completed', 'submitted']).optional(),
  overallScore: z.number().min(0).max(100).optional(),
  domainScores: z.record(z.string(), z.number()).optional(),
  findings: z.array(z.any()).optional(),
  actionPlan: z.array(z.object({
    standardId: z.string(),
    gap: z.string(),
    action: z.string(),
    owner: z.string().optional(),
    dueDate: z.string().optional(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  })).optional(),
  nextReviewDate: z.string().datetime().optional(),
}).passthrough();

/**
 * PATCH /api/compliance/cbahi/audit
 * Update an existing assessment
 */
export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const v = validateBody(body, updateAssessmentSchema);
    if ('error' in v) return v.error;

    const { id, ...updateData } = v.data;

    // Verify assessment belongs to this tenant
    const existing = await prisma.cbahiAssessment.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (updateData.status !== undefined) data.status = updateData.status;
    if (updateData.overallScore !== undefined) data.overallScore = updateData.overallScore;
    if (updateData.domainScores !== undefined) data.domainScores = updateData.domainScores;
    if (updateData.findings !== undefined) data.findings = updateData.findings;
    if (updateData.actionPlan !== undefined) data.actionPlan = updateData.actionPlan;
    if (updateData.nextReviewDate !== undefined) data.nextReviewDate = new Date(updateData.nextReviewDate);

    const updated = await prisma.cbahiAssessment.update({
      where: { id },
      data,
    });

    await createAuditLog(
      'cbahi_assessment',
      id,
      'UPDATE',
      userId || 'system',
      user?.email,
      { before: existing, after: updated },
      tenantId
    );

    return NextResponse.json({ success: true, assessment: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'compliance.cbahi.manage' }
);
