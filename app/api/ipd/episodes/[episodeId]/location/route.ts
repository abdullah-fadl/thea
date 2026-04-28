import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { writeErAuditLog } from '@/lib/er/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  ward: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  room: z.string().optional().nullable(),
  bed: z.string().optional().nullable(),
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

  if (!canAccessChargeConsole({ email: user?.email, tenantId, role: String(user?.role || '') })) {
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

  const ward = clean(v.data.ward);
  const unit = clean(v.data.unit);
  const room = clean(v.data.room);
  const bed = clean(v.data.bed);

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }

  const encounterCoreId = String(episode.encounterId || '').trim();
  if (encounterCoreId) {
    const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
    if (deathGuard) return deathGuard;
  }

  const activeAdmission = await prisma.ipdAdmission.findFirst({
    where: { tenantId, episodeId, releasedAt: null, isActive: true },
  });
  if (!activeAdmission) {
    return NextResponse.json({ error: 'No active bed to transfer', code: 'NO_ACTIVE_BED' }, { status: 409 });
  }

  const handover = await prisma.clinicalHandover.findFirst({
    where: {
      tenantId,
      status: 'FINALIZED',
      OR: [{ episodeId }, { encounterCoreId }],
    },
  });
  if (!handover) {
    return NextResponse.json({ error: 'Handover required before transfer', code: 'HANDOVER_REQUIRED' }, { status: 409 });
  }

  const locationData = episode.location as Record<string, unknown> | null;
  const before = {
    ward: (locationData?.ward as string) ?? null,
    unit: (locationData?.unit as string) ?? null,
    room: (locationData?.room as string) ?? null,
    bed: (locationData?.bed as string) ?? null,
  };

  if (eq(before.ward, ward) && eq(before.unit, unit) && eq(before.room, room) && eq(before.bed, bed)) {
    return NextResponse.json({ success: true, noOp: true, location: before });
  }

  const now = new Date();
  const patch = {
    location: { ward, unit, room, bed },
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
    action: 'SET_LOCATION',
    before,
    after: patch.location,
    ip,
  });

  return NextResponse.json({ success: true, location: patch.location });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
