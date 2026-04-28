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
 * GET /api/compliance/cbahi/evidence
 * List evidence for an assessment or standard
 *
 * Query params:
 * - assessmentId: string (required)
 * - standardId: string (optional)
 * - status: 'pending' | 'accepted' | 'rejected' (optional)
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const assessmentId = url.searchParams.get('assessmentId');
    const standardId = url.searchParams.get('standardId');
    const status = url.searchParams.get('status');

    if (!assessmentId) {
      return NextResponse.json({ error: 'assessmentId is required' }, { status: 400 });
    }

    // Verify assessment belongs to this tenant
    const assessment = await prisma.cbahiAssessment.findFirst({
      where: { id: assessmentId, tenantId },
      select: { id: true },
    });
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const where: any = { tenantId, assessmentId };
    if (standardId) where.standardId = standardId;
    if (status) where.status = status;

    const items = await prisma.cbahiEvidence.findMany({
      where,
      orderBy: { uploadedAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ items, count: items.length });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'compliance.cbahi.view' }
);

const createEvidenceSchema = z.object({
  assessmentId: z.string().uuid(),
  standardId: z.string().min(1),
  elementId: z.string().optional(),
  evidenceType: z.enum(['document', 'screenshot', 'report', 'log', 'certificate']),
  title: z.string().min(1),
  description: z.string().optional(),
  fileUrl: z.string().optional(),
}).passthrough();

/**
 * POST /api/compliance/cbahi/evidence
 * Upload / create evidence for a standard
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const v = validateBody(body, createEvidenceSchema);
    if ('error' in v) return v.error;

    // Verify assessment belongs to this tenant
    const assessment = await prisma.cbahiAssessment.findFirst({
      where: { id: v.data.assessmentId, tenantId },
      select: { id: true },
    });
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const evidence = await prisma.cbahiEvidence.create({
      data: {
        tenantId,
        assessmentId: v.data.assessmentId,
        standardId: v.data.standardId,
        elementId: v.data.elementId || null,
        evidenceType: v.data.evidenceType,
        title: v.data.title,
        description: v.data.description || null,
        fileUrl: v.data.fileUrl || null,
        status: 'pending',
        uploadedBy: userId || user?.email || 'unknown',
      },
    });

    await createAuditLog(
      'cbahi_evidence',
      evidence.id,
      'CREATE',
      userId || 'system',
      user?.email,
      { after: evidence },
      tenantId
    );

    return NextResponse.json({ success: true, id: evidence.id, evidence });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'compliance.cbahi.manage' }
);

const updateEvidenceSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'accepted', 'rejected']).optional(),
  reviewerNotes: z.string().optional(),
}).passthrough();

/**
 * PATCH /api/compliance/cbahi/evidence
 * Update evidence status (review)
 */
export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const v = validateBody(body, updateEvidenceSchema);
    if ('error' in v) return v.error;

    const existing = await prisma.cbahiEvidence.findFirst({
      where: { id: v.data.id, tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Evidence not found' }, { status: 404 });
    }

    const data: any = {};
    if (v.data.status) {
      data.status = v.data.status;
      data.reviewedAt = new Date();
    }
    if (v.data.reviewerNotes !== undefined) {
      data.reviewerNotes = v.data.reviewerNotes;
    }

    const updated = await prisma.cbahiEvidence.update({
      where: { id: v.data.id },
      data,
    });

    await createAuditLog(
      'cbahi_evidence',
      v.data.id,
      'REVIEW',
      userId || 'system',
      user?.email,
      { before: existing, after: updated },
      tenantId
    );

    return NextResponse.json({ success: true, evidence: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'compliance.cbahi.manage' }
);
