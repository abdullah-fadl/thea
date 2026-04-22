import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { createAuditLog } from '@/lib/utils/audit';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  shift: z.enum(['START', 'END']),
  count: z.number().int().min(0),
}).passthrough();

function isNurse(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r.includes('nurse') || r.includes('nursing');
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
  const encounterCoreId = String(episode.encounterId || '').trim();

  const items = await prisma.clinicalNote.findMany({
    where: {
      tenantId,
      encounterCoreId,
      noteType: 'NARCOTIC_COUNT',
      metadata: { path: ['episodeId'], equals: episodeId },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return NextResponse.json({ items });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {

  const role = String(user?.role || '');
  if (!isNurse(role)) {
    return NextResponse.json({ error: 'Forbidden: nurses only' }, { status: 403 });
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

  const shift = v.data.shift;
  const count = v.data.count;

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }
  const encounterCoreId = String(episode.encounterId || '').trim();
  if (encounterCoreId) {
    const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
    if (deathGuard) return deathGuard;
  }
  const discharge = await prisma.dischargeSummary.findFirst({ where: { tenantId, encounterCoreId } });
  if (discharge) {
    return NextResponse.json({ error: 'Discharge finalized' }, { status: 409 });
  }

  const now = new Date();
  const note = await prisma.clinicalNote.create({
    data: {
      tenantId,
      patientMasterId: String((episode.patient as Record<string, unknown> | null)?.id || '').trim() || null,
      encounterCoreId,
      area: 'IPD',
      role: 'nurse',
      noteType: 'NARCOTIC_COUNT',
      title: `Narcotic Count (${shift})`,
      content: `Shift ${shift}: ${count}`,
      metadata: { episodeId, shift, count },
      author: {
        userId: userId || null,
        name: String(user?.displayName || user?.email || 'Unknown'),
        role: 'nurse',
      },
      createdByUserId: userId || null,
      createdAt: now,
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
