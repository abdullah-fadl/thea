import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { createAuditLog } from '@/lib/utils/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { validateBody } from '@/lib/validation/helpers';
import { ipdNursingNoteSchema } from '@/lib/validation/ipd.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isNurse(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r.includes('nurse') || r.includes('nursing');
}

const NOTE_TYPES = ['SHIFT_NOTE'] as const;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user }, params) => {

  const role = String(user?.role || '');
  const dev = false;
  if (!dev && !isNurse(role) && !canAccessChargeConsole({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
  const patientMasterId = String((episode?.patient as Record<string, unknown> | null)?.id || '').trim();

  const items = await prisma.clinicalNote.findMany({
    where: {
      tenantId,
      encounterCoreId,
      noteType: 'NURSING_SHIFT_NOTE',
      metadata: { path: ['episodeId'], equals: episodeId },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const mapped = items.map((note) => ({
    id: note.id,
    tenantId,
    episodeId,
    encounterCoreId,
    patientMasterId,
    type: 'SHIFT_NOTE',
    content: note.content,
    createdAt: note.createdAt,
    createdByUserId: note.createdByUserId,
  }));

  return NextResponse.json({ items: mapped });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }, params) => {

  const role = String(user?.role || '');
  const dev = false;

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

  const v = validateBody(body, ipdNursingNoteSchema);
  if ('error' in v) return v.error;
  const { type, content } = v.data;

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }
  const encounterCoreId = String(episode?.encounterId || '').trim();
  if (encounterCoreId) {
    const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
    if (deathGuard) return deathGuard;
  }
  const primaryNurseId = String((episode?.ownership as Record<string, unknown> | null)?.primaryInpatientNurseUserId || '').trim();
  const charge = canAccessChargeConsole({ email: user?.email, tenantId, role });
  if (!dev && !charge && primaryNurseId !== String(userId || '')) {
    return NextResponse.json(
      { error: 'Forbidden: only primary nurse or charge roles can add notes' },
      { status: 403 }
    );
  }

  const patientMasterId = String((episode?.patient as Record<string, unknown> | null)?.id || '').trim();
  if (!encounterCoreId || !patientMasterId) {
    return NextResponse.json({ error: 'Patient or encounter missing' }, { status: 409 });
  }

  const date = new Date().toISOString().slice(0, 10);
  const dedupeKey = `${tenantId}:${episodeId}:NURSING_SHIFT_NOTE:${date}`;
  const existing = await prisma.clinicalNote.findFirst({
    where: {
      tenantId,
      encounterCoreId,
      noteType: 'NURSING_SHIFT_NOTE',
      metadata: { path: ['episodeId'], equals: episodeId },
      AND: [{ metadata: { path: ['date'], equals: date } }],
    },
  });
  if (existing) {
    return NextResponse.json({ success: true, noOp: true, id: existing.id });
  }

  const now = new Date();
  const note = await prisma.clinicalNote.create({
    data: {
      tenantId,
      patientMasterId,
      encounterCoreId,
      area: 'IPD',
      role: 'nurse',
      noteType: 'NURSING_SHIFT_NOTE',
      title: 'Nursing Shift Note',
      content,
      metadata: { episodeId, date },
      author: {
        userId: userId || null,
        name: String(user?.displayName || user?.email || 'Unknown'),
        role: 'nurse',
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

  return NextResponse.json({ success: true, note });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
