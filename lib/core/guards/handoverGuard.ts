import { NextResponse } from 'next/server';
import { prisma, prismaModel } from '@/lib/db/prisma';

export async function ensureHandoverWriteAllowed(args: {
  db?: any; // ignored — kept for backward compat
  tenantId: string;
  encounterCoreId: string;
}) {
  const { tenantId, encounterCoreId } = args;
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  if (String(encounter.status || '').toUpperCase() === 'CLOSED') {
    return NextResponse.json({ error: 'Encounter is closed', code: 'ENCOUNTER_CLOSED' }, { status: 409 });
  }

  let discharge: any = null;
  try {
    discharge = await prismaModel('dischargeSummary').findFirst({
      where: { tenantId, encounterCoreId },
    });
  } catch (error) {
    // Log but allow handover to proceed if discharge check fails
    const { logger } = await import('@/lib/monitoring/logger');
    logger.error('Failed to check DischargeSummary', { category: 'clinical', encounterCoreId, error });
  }
  if (discharge) {
    return NextResponse.json(
      { error: 'Discharge already finalized', code: 'DISCHARGE_FINALIZED' },
      { status: 409 }
    );
  }

  const death = await prisma.deathDeclaration.findFirst({
    where: {
      tenantId,
      encounterCoreId,
      finalisedAt: { not: null },
    },
  });
  if (death) {
    return NextResponse.json({ error: 'Death finalized', code: 'DEATH_FINALIZED' }, { status: 409 });
  }

  return null;
}
