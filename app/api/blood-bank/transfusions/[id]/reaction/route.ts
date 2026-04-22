import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/blood-bank/transfusions/[id]/reaction
 * Report a transfusion reaction.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const id = String((params as Record<string, string> | undefined)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json();
    const { reactionType, onset, symptoms, severity, actionTaken, outcome } = body;

    if (!reactionType || !onset || !severity) {
      return NextResponse.json(
        { error: 'reactionType, onset, and severity are required' },
        { status: 400 }
      );
    }

    const transfusion = await prisma.transfusion.findFirst({
      where: { id, tenantId },
    });

    if (!transfusion) {
      return NextResponse.json({ error: 'Transfusion not found' }, { status: 404 });
    }

    const existingReaction = await prisma.transfusionReaction.findFirst({
      where: { transfusionId: id, tenantId },
    });
    if (existingReaction) {
      return NextResponse.json(
        { error: 'A reaction has already been reported for this transfusion' },
        { status: 409 }
      );
    }

    const reaction = await prisma.transfusionReaction.create({
      data: {
        tenantId,
        transfusionId: id,
        reactionType,
        onset: new Date(onset),
        symptoms: symptoms || [],
        severity,
        actionTaken: actionTaken || null,
        outcome: outcome || null,
        reportedToBank: false,
      },
    });

    if (transfusion.status === 'IN_PROGRESS') {
      await prisma.transfusion.update({
        where: { id },
        data: {
          status: 'STOPPED',
          stoppedReason: 'Reaction: ' + reactionType,
          endTime: new Date(),
        },
      });

      await prisma.bloodUnit.updateMany({
        where: { unitNumber: transfusion.unitNumber, tenantId },
        data: { status: 'QUARANTINE' },
      });
    }

    return NextResponse.json({ reaction }, { status: 201 });
  }),
  { permissionKey: 'blood_bank.transfuse' }
);
