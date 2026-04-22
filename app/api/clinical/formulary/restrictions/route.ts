import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET — List restriction requests
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || '';

    const where: any = { tenantId };
    if (status) where.status = status;

    const items = await prisma.formularyRestrictionRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ items, total: items.length });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'formulary.view' }
);

// POST — Create a restriction request
const createRequestSchema = z.object({
  drugId: z.string().min(1),
  drugName: z.string().optional(),
  patientId: z.string().optional(),
  encounterId: z.string().optional(),
  reason: z.string().min(1),
  clinicalJustification: z.string().optional(),
});

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    let body: any;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const v = validateBody(body, createRequestSchema);
    if ('error' in v) return v.error;

    const request = await prisma.formularyRestrictionRequest.create({
      data: {
        tenantId,
        drugId: v.data.drugId,
        drugName: v.data.drugName || null,
        patientId: v.data.patientId || null,
        encounterId: v.data.encounterId || null,
        requestedBy: userId,
        requestedByName: user?.displayName || user?.email || null,
        reason: v.data.reason,
        clinicalJustification: v.data.clinicalJustification || null,
        status: 'pending',
      },
    });

    return NextResponse.json({ success: true, id: request.id });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'formulary.view' }
);

// PATCH — Approve or reject a restriction request
const reviewSchema = z.object({
  requestId: z.string().min(1),
  action: z.enum(['approved', 'rejected']),
  reviewNotes: z.string().optional(),
});

export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    let body: any;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const v = validateBody(body, reviewSchema);
    if ('error' in v) return v.error;

    const existing = await prisma.formularyRestrictionRequest.findFirst({
      where: { id: v.data.requestId, tenantId },
    });

    if (!existing) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: 'Request already reviewed' }, { status: 400 });
    }

    const updated = await prisma.formularyRestrictionRequest.update({
      where: { id: v.data.requestId },
      data: {
        status: v.data.action,
        reviewedBy: userId,
        reviewedByName: user?.displayName || user?.email || null,
        reviewedAt: new Date(),
        reviewNotes: v.data.reviewNotes || null,
      },
    });

    return NextResponse.json({ success: true, request: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'formulary.approve' }
);
