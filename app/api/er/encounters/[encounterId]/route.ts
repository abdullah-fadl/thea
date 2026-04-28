import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const routeParams = params || {};
  const encounterId = String((routeParams as Record<string, string>).encounterId || '');

  if (!encounterId) {
    return NextResponse.json({ error: 'Encounter ID is required' }, { status: 400 });
  }

  const encounter = await prisma.erEncounter.findFirst({
    where: { tenantId, id: encounterId },
    include: {
      patient: true,
      triage: true,
      bedAssignments: {
        where: { unassignedAt: null },
      },
      staffAssignments: {
        where: { unassignedAt: null },
      },
      notes: true,
      dispositions: true,
    },
  });

  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  // Flatten relations for backward compatibility
  const result: any = {
    ...encounter,
    patient: encounter.patient || null,
    triage: encounter.triage || null,
    bedAssignment: encounter.bedAssignments?.[0] || null,
    staffAssignments: encounter.staffAssignments || [],
    notes: encounter.notes?.[0] || null,
    disposition: encounter.dispositions?.[0] || null,
  };

  // Look up bed details if there's an active bed assignment
  if (result.bedAssignment?.bedId) {
    const bed = await prisma.erBed.findFirst({
      where: { id: result.bedAssignment.bedId },
    });
    result.bed = bed || null;
  }

  // Look up patient master if patientMasterId is available
  if ((encounter as Record<string, unknown>).patientMasterId) {
    const patientMaster = await prisma.patientMaster.findFirst({
      where: { id: (encounter as Record<string, unknown>).patientMasterId },
    });
    result.patientMaster = patientMaster || null;
  }

  return NextResponse.json({ encounter: result });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.encounter.view' }
);
