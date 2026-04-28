import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const params = req.nextUrl.searchParams;
  const status = params.get('status');
  const encounterType = params.get('encounterType');
  const department = params.get('department');
  const patientId = params.get('patientId');
  const limit = Math.min(Number(params.get('limit') || '25'), 100);

  const where: any = { tenantId };
  if (status) {
    where.status = status.toUpperCase();
  } else {
    where.status = 'ACTIVE';
  }
  if (encounterType) where.encounterType = encounterType.toUpperCase();
  if (department) where.department = department.toUpperCase();
  if (patientId) where.patientId = patientId;

  const encounters = await prisma.encounterCore.findMany({
    where,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit,
  });

  const patientIds = Array.from(new Set(encounters.map((item: any) => String(item.patientId || '')))).filter(Boolean);
  const patients = patientIds.length
    ? await prisma.patientMaster.findMany({
        where: { tenantId, id: { in: patientIds } },
      })
    : [];

  const patientsById = patients.reduce<Record<string, any>>((acc, patient) => {
    acc[String(patient.id || '')] = patient;
    return acc;
  }, {});

  const items = encounters.map((encounter: any) => ({
    encounter,
    patient: patientsById[String(encounter.patientId || '')] || null,
  }));

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'encounters.core.view' }
);
