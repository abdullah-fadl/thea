import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

// GET /api/physiotherapy/referrals/[id]/sessions
// Returns all sessions for the given referral
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const referralId = String((params as Record<string, string>)?.id || '').trim();
    if (!referralId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const referral = await prisma.ptReferral.findFirst({
      where: { id: referralId, tenantId },
    });
    if (!referral) {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
    }

    const sessions = await prisma.ptSession.findMany({
      where: { referralId, tenantId },
      orderBy: { sessionDate: 'desc' },
    });

    return NextResponse.json({ sessions });
  }),
  { permissionKey: 'physiotherapy.view' },
);

// POST /api/physiotherapy/referrals/[id]/sessions
// Body: { therapistId, sessionDate, duration, interventions, progressNote, painBefore, painAfter }
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const referralId = String((params as Record<string, string>)?.id || '').trim();
    if (!referralId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json();
    const {
      therapistId,
      sessionDate,
      duration,
      interventions,
      progressNote,
      painBefore,
      painAfter,
    } = body;

    if (!sessionDate || !interventions || !progressNote) {
      return NextResponse.json(
        { error: 'sessionDate, interventions, and progressNote are required' },
        { status: 400 },
      );
    }

    const referral = await prisma.ptReferral.findFirst({
      where: { id: referralId, tenantId },
    });
    if (!referral) {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
    }

    const session = await prisma.ptSession.create({
      data: {
        tenantId,
        referralId,
        therapistId: therapistId ?? userId,
        sessionDate: new Date(sessionDate),
        duration: duration ?? null,
        interventions,
        progressNote,
        painBefore: painBefore ?? null,
        painAfter: painAfter ?? null,
      },
    });

    // Auto-advance referral to IN_PROGRESS if still ACCEPTED/PENDING
    if (referral.status === 'PENDING' || referral.status === 'ACCEPTED') {
      await prisma.ptReferral.update({
        where: { id: referralId },
        data: { status: 'IN_PROGRESS', updatedAt: new Date() },
      });
    }

    return NextResponse.json({ session }, { status: 201 });
  }),
  { permissionKey: 'physiotherapy.edit' },
);
