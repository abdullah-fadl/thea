import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/**
 * Ensure the encounter is not associated with a finalized death declaration.
 * Returns a 409 NextResponse if it is, or null if OK.
 */
export async function ensureNotDeceasedFinalized(args: {
  db?: any; // Kept for backward compat — ignored
  tenantId: string;
  encounterCoreId: string;
}) {
  const { tenantId, encounterCoreId } = args;
  const record = await prisma.deathDeclaration.findFirst({
    where: {
      tenantId,
      encounterCoreId,
      finalisedAt: { not: null },
    },
  });
  if (record) {
    return NextResponse.json(
      {
        error: 'Encounter is deceased (finalized)',
        code: 'ENCOUNTER_DECEASED_FINALIZED',
      },
      { status: 409 }
    );
  }
  return null;
}

/**
 * Patient-level death guard: blocks actions if the patient has ANY finalized
 * death declaration across all encounters. Use this for order creation,
 * booking, and other patient-scoped operations.
 */
export async function ensurePatientNotDeceased(args: {
  tenantId: string;
  patientId: string;
}) {
  const { tenantId, patientId } = args;

  // Check if any encounter for this patient has a finalized death declaration
  const encounters = await prisma.encounterCore.findMany({
    where: { tenantId, patientId },
    select: { id: true },
  });

  if (encounters.length === 0) return null;

  const encounterIds = encounters.map(e => e.id);
  const deathRecord = await prisma.deathDeclaration.findFirst({
    where: {
      tenantId,
      encounterCoreId: { in: encounterIds },
      finalisedAt: { not: null },
    },
  });

  if (deathRecord) {
    return NextResponse.json(
      {
        error: 'Patient is deceased (death declaration finalized)',
        code: 'PATIENT_DECEASED',
      },
      { status: 409 }
    );
  }
  return null;
}
