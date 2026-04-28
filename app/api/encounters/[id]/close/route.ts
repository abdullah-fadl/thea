import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const encounterId = String((params as Record<string, string>)?.id || '').trim();
  if (!encounterId) {
    return NextResponse.json({ error: 'Encounter id is required' }, { status: 400 });
  }

  const encounter = await prisma.encounterCore.findFirst({ where: { tenantId, id: encounterId } });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  if (encounter.status === 'CLOSED') {
    return NextResponse.json({ success: true, encounter, noOp: true });
  }

  if (encounter.encounterType === 'OPD') {
    const opd = await prisma.opdEncounter.findFirst({
      where: { tenantId, encounterCoreId: encounterId },
    });
    const opdStatus = String(opd?.status || 'OPEN').toUpperCase();
    const arrivalState = String(opd?.arrivalState || 'NOT_ARRIVED').toUpperCase();
    if (opdStatus !== 'COMPLETED' && arrivalState !== 'LEFT') {
      return NextResponse.json(
        { error: 'OPD encounter cannot be closed before completion or exit' },
        { status: 409 }
      );
    }
  }

  const now = new Date();
  const patch: any = {
    status: 'CLOSED',
    closedAt: now,
    updatedAt: now,
    closedByUserId: userId,
  };

  await prisma.encounterCore.update({
    where: { id: encounterId },
    data: patch,
  });

  await createAuditLog(
    'encounter_core',
    encounterId,
    'CLOSE',
    userId || 'system',
    user?.email,
    { before: encounter, after: { ...encounter, ...patch } },
    tenantId
  );

  return NextResponse.json({ success: true, encounter: { ...encounter, ...patch } });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'encounters.core.close' }
);
