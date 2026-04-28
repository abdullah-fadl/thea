import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/utils/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  stage: z.enum(['ADMISSION', 'DISCHARGE']),
  homeMeds: z.array(z.unknown()).optional(),
  decisions: z.array(z.unknown()).optional(),
}).passthrough();

function cleanStage(value: unknown): 'ADMISSION' | 'DISCHARGE' | null {
  const v = String(value || '').trim().toUpperCase();
  if (v === 'ADMISSION' || v === 'DISCHARGE') return v;
  return null;
}

function isDoctor(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r.includes('doctor') || r.includes('physician');
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user }, params) => {

  const role = String(user?.role || '');
  if (!isDoctor(role)) {
    return NextResponse.json({ error: 'Forbidden: doctors only' }, { status: 403 });
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

  const items = await prisma.clinicalNote.findMany({
    where: {
      tenantId,
      encounterCoreId,
      noteType: { in: ['MED_RECON_ADMISSION', 'MED_RECON_DISCHARGE'] },
      metadata: { path: ['episodeId'], equals: episodeId },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  const admission = items.find((n: any) => n.noteType === 'MED_RECON_ADMISSION') || null;
  const discharge = items.find((n: any) => n.noteType === 'MED_RECON_DISCHARGE') || null;

  return NextResponse.json({ admission, discharge });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {

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

  const stage = cleanStage(v.data.stage);
  const homeMeds = Array.isArray(v.data.homeMeds) ? v.data.homeMeds : [];
  const decisions = Array.isArray(v.data.decisions) ? v.data.decisions : [];
  if (!stage) {
    return NextResponse.json({ error: 'stage must be ADMISSION or DISCHARGE' }, { status: 400 });
  }

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }
  const encounterCoreId = String(episode?.encounterId || '').trim();
  if (encounterCoreId) {
    const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
    if (deathGuard) return deathGuard;
  }

  const discharge = await prisma.dischargeSummary.findFirst({ where: { tenantId, encounterCoreId } });
  if (stage === 'DISCHARGE' && discharge) {
    return NextResponse.json({ error: 'Discharge finalized', code: 'DISCHARGE_FINALIZED' }, { status: 409 });
  }

  const noteType = stage === 'ADMISSION' ? 'MED_RECON_ADMISSION' : 'MED_RECON_DISCHARGE';
  const existing = await prisma.clinicalNote.findFirst({
    where: {
      tenantId,
      encounterCoreId,
      noteType,
      metadata: { path: ['episodeId'], equals: episodeId },
    },
  });
  if (existing) {
    return NextResponse.json({ success: true, noOp: true, id: existing.id });
  }

  const now = new Date();
  const contentLines = [
    `Stage: ${stage}`,
    `Home meds:`,
    ...homeMeds.map((m: any) => `- ${String(m || '').trim()}`),
    `Decisions:`,
    ...decisions.map((d: any) => `- ${d.name || ''} | ${d.dose || ''} | ${d.frequency || ''} | ${d.decision || ''}`),
  ];
  const note = await prisma.clinicalNote.create({
    data: {
      tenantId,
      patientMasterId: String((episode?.patient as Record<string, unknown>)?.id || '').trim() || null,
      encounterCoreId,
      area: 'IPD',
      role: 'doctor',
      noteType,
      title: stage === 'ADMISSION' ? 'Medication Reconciliation (Admission)' : 'Medication Reconciliation (Discharge)',
      content: contentLines.join('\n'),
      metadata: {
        episodeId,
        stage,
        homeMeds: homeMeds as Prisma.InputJsonValue[],
        decisions: decisions as Prisma.InputJsonValue[],
      },
      author: {
        userId: userId || null,
        name: String(user?.displayName || user?.email || 'Unknown'),
        role: 'doctor',
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
