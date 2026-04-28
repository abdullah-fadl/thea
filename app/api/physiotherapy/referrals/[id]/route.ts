import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

// GET /api/physiotherapy/referrals/[id]
// Returns referral with its assessments and sessions
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const referral = await prisma.ptReferral.findFirst({
      where: { id, tenantId },
    });

    if (!referral) {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
    }

    const [assessments, sessions] = await Promise.all([
      prisma.ptAssessment.findMany({
        where: { referralId: id, tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ptSession.findMany({
        where: { referralId: id, tenantId },
        orderBy: { sessionDate: 'desc' },
      }),
    ]);

    return NextResponse.json({ referral, assessments, sessions });
  }),
  { permissionKey: 'physiotherapy.view' },
);

// PUT /api/physiotherapy/referrals/[id]
// Body: { status } - updates referral status
export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json();
    const { status, notes } = body;

    const validStatuses = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const existing = await prisma.ptReferral.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
    }

    const updated = await prisma.ptReferral.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ referral: updated });
  }),
  { permissionKey: 'physiotherapy.edit' },
);
