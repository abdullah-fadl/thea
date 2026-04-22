import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { createAuditLog } from '@/lib/utils/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  assessment: z.string().min(1, 'assessment is required'),
  planNext24h: z.string().min(1, 'planNext24h is required'),
  progressSummary: z.string().optional(),
  changesToday: z.string().optional(),
  dispositionPlan: z.string().optional(),
}).passthrough();

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

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }

  const encounterCoreId = String(episode?.encounterId || '').trim();
  const patientMasterId = String((episode?.patient as Record<string, unknown>)?.id || '').trim();

  const items = await prisma.clinicalNote.findMany({
    where: {
      tenantId,
      encounterCoreId,
      noteType: 'DAILY_PROGRESS',
      metadata: { path: ['episodeId'], equals: episodeId },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const mapped = items.map((note: any) => ({
    id: note.id,
    tenantId,
    episodeId,
    encounterCoreId,
    patientMasterId,
    date: note?.metadata?.date || null,
    assessment: note.content,
    progressSummary: note?.metadata?.progressSummary || null,
    changesToday: note?.metadata?.changesToday || null,
    planNext24h: note?.metadata?.planNext24h || null,
    dispositionPlan: note?.metadata?.dispositionPlan || null,
    createdByUserId: note.createdByUserId,
    createdAt: note.createdAt,
  }));

  return NextResponse.json({ items: mapped });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }, params) => {

  const role = String(user?.role || '');
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

  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const assessment = String(v.data.assessment).trim();
  const progressSummary = String(v.data.progressSummary || '').trim();
  const changesToday = String(v.data.changesToday || '').trim();
  const planNext24h = String(v.data.planNext24h).trim();
  const dispositionPlan = String(v.data.dispositionPlan || '').trim();

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }
  const encounterCoreId = String(episode?.encounterId || '').trim();
  if (encounterCoreId) {
    const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
    if (deathGuard) return deathGuard;
  }
  const attendingId = String((episode?.ownership as Record<string, unknown>)?.attendingPhysicianUserId || '').trim();
  if (!dev && !charge && attendingId !== String(userId || '')) {
    return NextResponse.json(
      { error: 'Forbidden: only attending physician or charge roles can add progress' },
      { status: 403 }
    );
  }

  const date = todayString();
  const patientMasterId = String((episode?.patient as Record<string, unknown>)?.id || '').trim();
  if (!encounterCoreId || !patientMasterId) {
    return NextResponse.json({ error: 'Patient or encounter missing' }, { status: 409 });
  }
  const existing = await prisma.clinicalNote.findFirst({
    where: {
      tenantId,
      encounterCoreId,
      noteType: 'DAILY_PROGRESS',
      metadata: { path: ['episodeId'], equals: episodeId },
      AND: [{ metadata: { path: ['date'], equals: date } }],
    },
  });
  if (existing) {
    return NextResponse.json({ success: true, noOp: true, id: existing.id });
  }

  const now = new Date();
  const dedupeKey = `${tenantId}:${episodeId}:DAILY_PROGRESS:${date}`;
  const note = await prisma.clinicalNote.create({
    data: {
      tenantId,
      patientMasterId,
      encounterCoreId,
      area: 'IPD',
      role: 'doctor',
      noteType: 'DAILY_PROGRESS',
      title: 'Daily Progress',
      content: assessment,
      metadata: {
        episodeId,
        date,
        progressSummary: progressSummary || null,
        changesToday: changesToday || null,
        planNext24h,
        dispositionPlan: dispositionPlan || null,
      },
      author: {
        userId: userId || null,
        name: String(user?.displayName || user?.email || 'Unknown'),
        role: 'doctor',
      },
      createdByUserId: userId || null,
      createdAt: now,
      idempotencyKey: dedupeKey,
    },
  });
  await createAuditLog(
    'clinical_note',
    note.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: note },
    tenantId
  );

  return NextResponse.json({ success: true, progress: note });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
