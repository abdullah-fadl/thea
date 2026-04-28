import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { writeErAuditLog } from '@/lib/er/audit';
import { validateBody } from '@/lib/validation/helpers';
import { createCarePlanSchema } from '@/lib/validation/ipd.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {

  const routeParams = params || {};
  const episodeId = String((routeParams as Record<string, string>).episodeId || '').trim();
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
  }

  const items = await prisma.ipdCarePlan.findMany({
    where: { tenantId, episodeId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({ items });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }, params) => {

  const role = String((user as any)?.role || '');
  const dev = false;
  const charge = canAccessChargeConsole({ email: user?.email, tenantId, role });

  const routeParams = params || {};
  const episodeId = String((routeParams as Record<string, string>).episodeId || '').trim();
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, createCarePlanSchema);
  if ('error' in v) return v.error;
  const { problem, goals, interventions, status } = v.data;

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }
  const attendingId = String((episode as any)?.ownership?.attendingPhysicianUserId || '').trim();
  if (!dev && !charge && attendingId !== String(userId || '')) {
    return NextResponse.json(
      { error: 'Forbidden: only attending physician or charge roles can create care plans' },
      { status: 403 }
    );
  }

  const now = new Date();
  const doc = await prisma.ipdCarePlan.create({
    data: {
      tenantId,
      episodeId,
      problem,
      goals,
      interventions,
      status: status || 'ACTIVE',
      createdByUserId: userId,
      createdAt: now,
    },
  });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'ipd_care_plan',
    entityId: doc.id,
    action: 'CREATE',
    after: doc,
    ip,
  });

  return NextResponse.json({ success: true, carePlan: doc });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
