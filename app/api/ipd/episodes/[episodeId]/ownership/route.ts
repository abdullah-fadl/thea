import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { writeErAuditLog } from '@/lib/er/audit';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  attendingPhysicianUserId: z.string().optional().nullable(),
  primaryInpatientNurseUserId: z.string().optional().nullable(),
}).passthrough();

function clean(v: any): string | null {
  const s = String(v ?? '').trim();
  return s ? s : null;
}

function eq(a: any, b: any): boolean {
  return String(a ?? '').trim() === String(b ?? '').trim();
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }, params) => {

  if (!canAccessChargeConsole({ email: user?.email, tenantId, role: (user as unknown as Record<string, unknown>)?.role as string })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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

  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const attendingPhysicianUserId = clean(v.data.attendingPhysicianUserId);
  const primaryInpatientNurseUserId = clean(v.data.primaryInpatientNurseUserId);

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }

  const before = {
    attendingPhysicianUserId: ((episode as Record<string, unknown>)?.ownership as any)?.attendingPhysicianUserId ?? null,
    primaryInpatientNurseUserId: ((episode as Record<string, unknown>)?.ownership as any)?.primaryInpatientNurseUserId ?? null,
  };

  if (
    eq(before.attendingPhysicianUserId, attendingPhysicianUserId) &&
    eq(before.primaryInpatientNurseUserId, primaryInpatientNurseUserId)
  ) {
    return NextResponse.json({ success: true, noOp: true, ownership: before });
  }

  const now = new Date();
  const patch = {
    ownership: { attendingPhysicianUserId, primaryInpatientNurseUserId },
    updatedAt: now,
    updatedByUserId: userId,
  };
  await prisma.ipdEpisode.update({
    where: { id: episodeId },
    data: patch,
  });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'ipd_episode',
    entityId: episodeId,
    action: 'SET_OWNERSHIP',
    before,
    after: patch.ownership,
    ip,
  });

  return NextResponse.json({ success: true, ownership: patch.ownership });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
