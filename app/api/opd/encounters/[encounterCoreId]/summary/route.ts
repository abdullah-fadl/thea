import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getAge(dob?: string | Date | null) {
  if (!dob) return null;
  const date = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const ageDate = new Date(diffMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const encounterCoreId = String((params as Record<string, string>)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const encounterCore = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounterCore) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  const opd = await prisma.opdEncounter.findUnique({
    where: { encounterCoreId },
  });

  const patient = await prisma.patientMaster.findFirst({
    where: { tenantId, id: encounterCore.patientId },
    include: { identityLinks: true },
  });

  // Derive MRN from identity links
  const mrn = (() => {
    if (!patient?.identityLinks?.length) return '';
    const opdLink = patient.identityLinks.find((link) => link.system === 'OPD' && (link.mrn || link.tempMrn));
    const anyLink = patient.identityLinks.find((link) => link.mrn || link.tempMrn);
    return opdLink?.mrn || opdLink?.tempMrn || anyLink?.mrn || anyLink?.tempMrn || '';
  })();

  return NextResponse.json({
    patient: patient
      ? {
          id: patient.id,
          fullName: patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
          mrn,
          age: getAge(patient.dob),
          gender: patient.gender,
        }
      : null,
    visit: {
      id: encounterCoreId,
      status: opd?.status || encounterCore.status || 'OPEN',
    },
    opd: opd ? { opdFlowState: opd.opdFlowState, status: opd.status } : null,
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.view' }
);
