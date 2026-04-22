import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = new URL(req.url);
    const patientMasterId = searchParams.get('patientMasterId') || undefined;
    const status = searchParams.get('status') || undefined;

    const assessments = await prisma.socialWorkAssessment.findMany({
      where: {
        tenantId,
        ...(patientMasterId ? { patientMasterId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { assessmentDate: 'desc' },
      take: 200,
    });

    return NextResponse.json({ assessments });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'social_work.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      patientMasterId,
      episodeId,
      referralReason,
      livingArrangement,
      supportSystem,
      barriers,
      plan,
      dischargeBarriers,
      followUpPlan,
    } = body;

    if (!patientMasterId || !referralReason) {
      return NextResponse.json(
        { error: 'patientMasterId and referralReason are required' },
        { status: 400 }
      );
    }

    const assessment = await prisma.socialWorkAssessment.create({
      data: {
        tenantId,
        patientMasterId: String(patientMasterId),
        episodeId: episodeId ? String(episodeId) : null,
        assessedBy: userId,
        assessmentDate: new Date(),
        referralReason: String(referralReason),
        livingArrangement: livingArrangement ? String(livingArrangement) : null,
        supportSystem: supportSystem ? String(supportSystem) : null,
        barriers: barriers ? String(barriers) : null,
        plan: plan ? String(plan) : null,
        dischargeBarriers: dischargeBarriers ? String(dischargeBarriers) : null,
        followUpPlan: followUpPlan ? String(followUpPlan) : null,
      },
    });

    return NextResponse.json({ success: true, id: assessment.id, assessment });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'social_work.manage' }
);
