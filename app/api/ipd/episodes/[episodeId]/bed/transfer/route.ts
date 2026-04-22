import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { validateBody } from '@/lib/validation/helpers';
import { ipdBedAssignSchema } from '@/lib/validation/ipd.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function ensureHandoverFinalized(tenantId: string, episodeId: string, encounterCoreId: string | null) {
  const filter: any = { tenantId, status: 'FINALIZED' };
  if (episodeId) filter.episodeId = episodeId;
  if (encounterCoreId) filter.encounterCoreId = encounterCoreId;
  const handover = await prisma.clinicalHandover.findFirst({ where: filter });
  return Boolean(handover);
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {

  const routeParams = params || {};
  const episodeId = String((routeParams as Record<string, string>).episodeId || '').trim();
  if (!episodeId) return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, ipdBedAssignSchema);
  if ('error' in v) return v.error;
  const { bedId } = v.data;

  const episode = await prisma.ipdEpisode.findFirst({
    where: { tenantId, id: episodeId },
  });
  if (!episode) return NextResponse.json({ error: 'Episode not found' }, { status: 404 });

  const encounterCoreId = String(episode.encounterId || '').trim() || null;
  if (encounterCoreId) {
    const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
    if (deathGuard) return deathGuard;
  }

  const handoverOk = await ensureHandoverFinalized(tenantId, episodeId, encounterCoreId);
  if (!handoverOk) {
    return NextResponse.json({ error: 'Handover required before transfer', code: 'HANDOVER_REQUIRED' }, { status: 409 });
  }

  const bed = await prisma.ipdBed.findFirst({ where: { tenantId, id: bedId } });
  if (!bed) {
    return NextResponse.json({ error: 'Bed not found' }, { status: 404 });
  }

  // XFER-01 fix: Wrap old bed release + new bed assignment + episode update in a
  // serializable transaction to prevent partial state on failure or concurrent transfers.
  let txResult: { newAdmission: any; location: any; activeAdmission: any };
  try {
    txResult = await prisma.$transaction(async (tx) => {
      const activeAdmission = await tx.ipdAdmission.findFirst({
        where: { tenantId, episodeId, releasedAt: null, isActive: true },
      });
      if (!activeAdmission) {
        throw new Error('NO_ACTIVE_BED');
      }

      const occupied = await tx.ipdAdmission.findFirst({
        where: { tenantId, bedId, releasedAt: null, isActive: true },
      });
      if (occupied) {
        throw new Error('BED_OCCUPIED');
      }

      const now = new Date();
      await tx.ipdAdmission.update({
        where: { id: activeAdmission.id },
        data: { releasedAt: now, releasedByUserId: userId || null, isActive: false },
      });

      // XFER-03 fix: use episode.patient?.id (now available via include) or episode.patientMasterId
      const patientData = episode.patient as Record<string, unknown> | null;
      const episodeRecord = episode as Record<string, unknown>;
      const patientMasterId = (patientData?.id as string) || (episodeRecord.patientMasterId as string) || null;

      const newAdm = await tx.ipdAdmission.create({
        data: {
          tenantId,
          episodeId,
          encounterId: encounterCoreId,
          patientMasterId,
          bedId,
          assignedAt: now,
          assignedByUserId: userId || null,
          releasedAt: null,
          isActive: true,
        },
      });

      const loc = {
        ward: bed.ward || bed.departmentName || bed.departmentId || null,
        room: bed.room || bed.roomLabel || bed.roomId || null,
        bed: bed.bedLabel || bed.label || bed.id,
        unit: bed.unit || bed.unitLabel || bed.unitId || null,
      };
      await tx.ipdEpisode.update({
        where: { id: episodeId },
        data: { location: loc, updatedAt: now, updatedByUserId: userId || null },
      });

      return { newAdmission: newAdm, location: loc, activeAdmission };
    }, { isolationLevel: 'Serializable' });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NO_ACTIVE_BED') {
      return NextResponse.json({ error: 'No active bed to transfer', code: 'NO_ACTIVE_BED' }, { status: 409 });
    }
    if (err instanceof Error && err.message === 'BED_OCCUPIED') {
      return NextResponse.json({ error: 'Bed is occupied', code: 'BED_OCCUPIED' }, { status: 409 });
    }
    throw err;
  }

  const { newAdmission, location, activeAdmission } = txResult;

  await createAuditLog(
    'ipd_bed_transfer',
    newAdmission.id,
    'TRANSFER',
    userId || 'system',
    user?.email,
    { before: activeAdmission, after: { bedId, location } },
    tenantId
  );

  return NextResponse.json({ success: true, admission: newAdmission, location });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
