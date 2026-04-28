import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/utils/audit';
import { OPD_VISIT_TYPES } from '@/lib/models/OPDEncounter';
import { validateBody } from '@/lib/validation/helpers';
import { openEncounterSchema } from '@/lib/validation/opd.schema';
import { emit } from '@/lib/events';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const OPD_VISIT_TYPE_SET = new Set<string>(OPD_VISIT_TYPES);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, openEncounterSchema);
  if ('error' in v) return v.error;
  const { patientMasterId, reason, visitType: visitTypeManual, billingMeta: rawBillingMeta } = v.data;
  const billingMeta = rawBillingMeta as Prisma.InputJsonValue;
  const canOverrideVisitType =
    user?.role === 'admin' ||
    user?.role === 'supervisor' ||
    (Array.isArray(user?.permissions) && user.permissions.includes('opd.visit.create'));

  // For now use manual or default — detectVisitType will be migrated later
  const visitType =
    visitTypeManual && OPD_VISIT_TYPE_SET.has(visitTypeManual) && canOverrideVisitType
      ? visitTypeManual
      : (visitTypeManual || null);

  // Validate patient
  const patient = await prisma.patientMaster.findFirst({
    where: { tenantId, id: patientMasterId },
  });
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }
  if (patient.status === 'MERGED') {
    return NextResponse.json({ error: 'Patient is merged' }, { status: 409 });
  }

  // Check for existing active encounter
  const existingActive = await prisma.encounterCore.findFirst({
    where: { tenantId, patientId: patientMasterId, encounterType: 'OPD', status: 'ACTIVE' },
  });

  if (existingActive) {
    // Ensure OPD encounter exists for this core encounter
    const existingOpd = await prisma.opdEncounter.findUnique({
      where: { encounterCoreId: existingActive.id },
    });
    if (!existingOpd) {
      await prisma.opdEncounter.create({
        data: {
          tenantId,
          encounterCoreId: existingActive.id,
          patientId: patientMasterId,
          status: 'OPEN',
          arrivalState: 'NOT_ARRIVED',
          visitType: (visitType as any) ?? undefined,
          billingMeta: billingMeta ?? undefined,
          createdByUserId: userId,
        },
      });
    } else if (billingMeta && !existingOpd.billingMeta) {
      await prisma.opdEncounter.update({
        where: { id: existingOpd.id },
        data: { billingMeta },
      });
    }
    return NextResponse.json({ success: true, encounter: existingActive, noOp: true });
  }

  // Create new encounter core + OPD encounter
  const now = new Date();
  const encounter = await prisma.encounterCore.create({
    data: {
      tenantId,
      patientId: patientMasterId,
      encounterType: 'OPD',
      status: 'ACTIVE',
      department: 'OPD',
      openedAt: now,
      createdByUserId: userId,
    },
  });

  await createAuditLog(
    'encounter_core',
    encounter.id,
    'CREATE_OPD',
    userId || 'system',
    user?.email,
    { after: encounter, reason: reason || null },
    tenantId
  );

  await prisma.opdEncounter.create({
    data: {
      tenantId,
      encounterCoreId: encounter.id,
      patientId: patientMasterId,
      status: 'OPEN',
      arrivalState: 'NOT_ARRIVED',
      visitType: (visitType as any) ?? undefined,
      billingMeta: billingMeta ?? undefined,
      createdByUserId: userId,
    },
  });

  // Emit encounter.opened@v1 — best-effort, never breaks the response.
  try {
    await emit({
      eventName: 'encounter.opened',
      version: 1,
      tenantId,
      aggregate: 'encounter',
      aggregateId: encounter.id,
      payload: {
        encounterId: encounter.id,
        patientId: patientMasterId,
        tenantId,
        encounterType: 'OPD',
        openedAt: now.toISOString(),
      },
    });
  } catch (e) {
    logger.error('events.emit_failed', { category: 'opd', eventName: 'encounter.opened', error: e });
  }

  return NextResponse.json({ success: true, encounter });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.view' }
);
