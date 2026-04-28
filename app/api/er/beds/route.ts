import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { ErBedState } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function syncClinicalInfraBeds(tenantId: string) {
  const infraBeds = await prisma.clinicalInfraBed.findMany({
    where: { tenantId, bedType: 'ER', status: { not: 'inactive' } },
    select: { id: true, label: true, shortCode: true, roomId: true },
    take: 500,
  });

  if (!infraBeds.length) return;

  const roomIds = Array.from(new Set(infraBeds.map((b: any) => String(b.roomId || '')).filter(Boolean)));
  const rooms = roomIds.length
    ? await prisma.clinicalInfraRoom.findMany({
        where: { tenantId, id: { in: roomIds } },
        select: { id: true, name: true, shortCode: true },
      })
    : [];
  const roomById = new Map(rooms.map((r) => [String(r.id), r]));

  for (const bed of infraBeds) {
    const bedId = String(bed.id || '').trim();
    if (!bedId) continue;
    const existingById = await prisma.erBed.findFirst({ where: { tenantId, id: bedId } });
    if (existingById) continue;

    const room = roomById.get(String(bed.roomId || '')) as Record<string, unknown>;
    const zone = String(room?.name || room?.shortCode || room?.id || 'ER').trim() || 'ER';
    const bedLabel = String(bed.label || bed.shortCode || bed.id || '').trim();
    if (!bedLabel) continue;

    const existingByLabel = await prisma.erBed.findFirst({ where: { tenantId, zone, bedLabel } });
    if (existingByLabel) continue;

    try {
      await prisma.erBed.create({
        data: {
          id: bedId,
          tenantId,
          zone,
          bedLabel,
          state: ErBedState.VACANT,
        },
      });
    } catch {
      // Ignore duplicate key errors from concurrent syncs
    }
  }
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {

  await syncClinicalInfraBeds(tenantId);

  // Fetch beds with active assignments, encounters, patients, and rooms
  const beds = await prisma.erBed.findMany({
    where: { tenantId },
    include: {
      assignments: {
        where: { unassignedAt: null },
        take: 1,
        include: {
          encounter: {
            include: {
              patient: {
                select: { id: true, fullName: true, mrn: true, gender: true },
              },
            },
          },
        },
      },
    },
    orderBy: [{ zone: 'asc' }, { bedLabel: 'asc' }],
    take: 500,
  });

  // Fetch room info for beds that have roomId in metadata
  // Since ErBed doesn't have a roomId relation, we handle this at the app level
  const bedsData = beds.map((bed: any) => {
    const assignment = bed.assignments?.[0];
    const encounter = assignment?.encounter;
    const patient = encounter?.patient;
    const hasAssignment = Boolean(assignment && assignment.encounterId);
    const normalizedState = String(bed.state || '').trim().toUpperCase() || bed.state;

    return {
      id: bed.id,
      zone: bed.zone,
      bedLabel: bed.bedLabel,
      state: hasAssignment ? normalizedState : 'VACANT',
      encounterId: encounter?.id || null,
      visitNumber: (encounter as Record<string, unknown>)?.visitNumber || null,
      patientName: patient?.fullName || null,
      mrn: patient?.mrn || null,
      tempMrn: null,
      patientGender: patient?.gender || null,
      triageLevel: encounter?.triageLevel ?? null,
      roomName: null,
      roomCode: null,
      updatedAt: bed.updatedAt,
    };
  });

  return NextResponse.json({ beds: bedsData });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.beds.view' }
);
