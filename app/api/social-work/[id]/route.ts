import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String(resolvedParams?.id || '');

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const assessment = await prisma.socialWorkAssessment.findFirst({
      where: { id, tenantId },
    });

    if (!assessment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const notes = await prisma.socialWorkNote.findMany({
      where: { assessmentId: id, tenantId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ assessment, notes });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'social_work.view' }
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String(resolvedParams?.id || '');

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const existing = await prisma.socialWorkAssessment.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const updated = await prisma.socialWorkAssessment.update({
      where: { id },
      data: {
        ...(body.referralReason !== undefined && { referralReason: String(body.referralReason) }),
        ...(body.livingArrangement !== undefined && { livingArrangement: body.livingArrangement ? String(body.livingArrangement) : null }),
        ...(body.supportSystem !== undefined && { supportSystem: body.supportSystem ? String(body.supportSystem) : null }),
        ...(body.barriers !== undefined && { barriers: body.barriers ? String(body.barriers) : null }),
        ...(body.plan !== undefined && { plan: body.plan ? String(body.plan) : null }),
        ...(body.dischargeBarriers !== undefined && { dischargeBarriers: body.dischargeBarriers ? String(body.dischargeBarriers) : null }),
        ...(body.followUpPlan !== undefined && { followUpPlan: body.followUpPlan ? String(body.followUpPlan) : null }),
        ...(body.status !== undefined && { status: String(body.status) }),
      },
    });

    return NextResponse.json({ success: true, assessment: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'social_work.manage' }
);
