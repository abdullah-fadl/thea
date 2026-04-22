import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';
import { icuAdmitSchema } from '@/lib/validation/ipd.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isDoctorOrNurse(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r.includes('doctor') || r.includes('physician') || r.includes('nurse') || r.includes('nursing');
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {

  const role = String(user?.role || '');
  if (!isDoctorOrNurse(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const routeParams = params || {};
  const episodeId = String((routeParams as Record<string, unknown>).episodeId || '').trim();
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, icuAdmitSchema);
  if ('error' in v) return v.error;
  const source = String(v.data.source || '').trim().toUpperCase();
  const note = v.data.note ? String(v.data.note || '').trim() : null;

  const episode = await prisma.ipdEpisode.findFirst({
    where: { tenantId, id: episodeId },
  });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }
  const encounterCoreId = String(episode.encounterId || '').trim();
  if (!encounterCoreId) {
    const episodeStatus = String(episode.status || '').toUpperCase();
    if (['CLOSED', 'DISCHARGED', 'DECEASED'].includes(episodeStatus)) {
      return NextResponse.json({ error: 'Episode is closed' }, { status: 409 });
    }
  }
  if (encounterCoreId) {
    const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
    if (deathGuard) return deathGuard;
  }
  const discharge = await prisma.dischargeSummary.findFirst({
    where: { tenantId, encounterCoreId },
  });
  if (discharge) {
    return NextResponse.json({ error: 'Discharge finalized' }, { status: 409 });
  }
  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  if (String(encounter.status || '').toUpperCase() === 'CLOSED') {
    return NextResponse.json({ error: 'Encounter is closed' }, { status: 409 });
  }

  const latest = await prisma.ipdIcuEvent.findFirst({
    where: { tenantId, episodeId },
    orderBy: { createdAt: 'desc' },
  });
  const latestDestination = String(latest?.destination || '').toUpperCase();
  if (latest && (latest.type === 'ADMIT' || latest.type === 'TRANSFER') && latestDestination === 'ICU') {
    return NextResponse.json({ success: true, noOp: true, event: latest });
  }

  const now = new Date();
  const event = await prisma.ipdIcuEvent.create({
    data: {
      tenantId,
      episodeId,
      encounterCoreId,
      type: 'ADMIT',
      destination: 'ICU',
      source: source || null,
      note,
      createdAt: now,
      createdByUserId: userId || null,
    },
  });

  await createAuditLog(
    'icu_event',
    event.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: event },
    tenantId
  );

  return NextResponse.json({ success: true, event });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'icu.view' }
);
