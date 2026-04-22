import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { writeErAuditLog } from '@/lib/er/audit';
import { validateBody } from '@/lib/validation/helpers';
import { nursingProgressSchema } from '@/lib/validation/ipd.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {

  const routeParams = params || {};
  const episodeId = String((routeParams as Record<string, string>).episodeId || '').trim();
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
  }

  const items = await prisma.ipdNursingDailyProgress.findMany({
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

  const v = validateBody(body, nursingProgressSchema);
  if ('error' in v) return v.error;
  const { responseToCarePlan, vitalsSummary, issues, escalations } = v.data;

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }
  const primaryNurseId = String((episode as any)?.ownership?.primaryInpatientNurseUserId || '').trim();
  const roleLower = String(role || '').toLowerCase();
  const isNurse = roleLower.includes('nurse') || roleLower.includes('nursing');
  // Allow: dev superadmin, charge console, primary nurse match,
  // or any nurse role when no primary nurse has been assigned yet
  if (!dev && !charge && primaryNurseId !== String(userId || '') && !(isNurse && !primaryNurseId)) {
    return NextResponse.json(
      { error: 'Forbidden: only primary nurse or charge roles can add progress' },
      { status: 403 }
    );
  }

  const date = todayString();
  const existing = await prisma.ipdNursingDailyProgress.findFirst({
    where: {
      tenantId,
      episodeId,
      date,
      createdByUserId: userId,
    },
  });
  if (existing) {
    return NextResponse.json({ success: true, noOp: true, id: existing.id });
  }

  const now = new Date();
  const doc = await prisma.ipdNursingDailyProgress.create({
    data: {
      tenantId,
      episodeId,
      date,
      responseToCarePlan,
      vitalsSummary,
      issues,
      escalations,
      createdByUserId: userId,
      createdAt: now,
    },
  });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'ipd_nursing_progress',
    entityId: doc.id,
    action: 'CREATE',
    after: doc,
    ip,
  });

  return NextResponse.json({ success: true, progress: doc });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
