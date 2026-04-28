import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ENCOUNTER_TYPES = ['ER', 'OPD', 'IPD', 'PROCEDURE'] as const;
const ENCOUNTER_STATUSES = ['CREATED', 'ACTIVE', 'CLOSED'] as const;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    patientId: z.string().min(1),
    encounterType: z.string().min(1),
    status: z.string().optional(),
    department: z.string().optional(),
    encounterId: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const patientId = String(body.patientId || '').trim();
  const encounterType = String(body.encounterType || '').trim().toUpperCase();
  const status = String(body.status || 'CREATED').trim().toUpperCase();
  const department = (String(body.department || '').trim() || 'REGISTRATION').toUpperCase();
  const encounterId = body.encounterId ? String(body.encounterId || '').trim() : uuidv4();

  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
  }
  if (!ENCOUNTER_TYPES.includes(encounterType as typeof ENCOUNTER_TYPES[number])) {
    return NextResponse.json({ error: 'Invalid encounterType' }, { status: 400 });
  }
  if (!ENCOUNTER_STATUSES.includes(status as typeof ENCOUNTER_STATUSES[number])) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  if (status === 'CLOSED') {
    return NextResponse.json({ error: 'Cannot create a CLOSED encounter' }, { status: 400 });
  }

  const patient = await prisma.patientMaster.findFirst({ where: { tenantId, id: patientId } });
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }
  if (String(patient.status || '') === 'MERGED') {
    return NextResponse.json({ error: 'Cannot open encounter for merged patient' }, { status: 409 });
  }

  const existingActive = await prisma.encounterCore.findFirst({
    where: { tenantId, patientId, status: 'ACTIVE' },
  });
  if (existingActive) {
    return NextResponse.json({ success: true, encounter: existingActive, noOp: true });
  }

  const existing = await prisma.encounterCore.findFirst({ where: { tenantId, id: encounterId } });
  if (existing) {
    if (
      existing.patientId === patientId &&
      existing.encounterType === encounterType &&
      existing.department === department
    ) {
      return NextResponse.json({ success: true, encounter: existing, noOp: true });
    }
    return NextResponse.json({ error: 'Encounter ID already exists' }, { status: 409 });
  }

  const now = new Date();
  const encounter = await prisma.encounterCore.create({
    data: {
      id: encounterId,
      tenantId,
      patientId,
      encounterType: encounterType as typeof ENCOUNTER_TYPES[number],
      status: status as typeof ENCOUNTER_STATUSES[number],
      department,
      openedAt: status === 'ACTIVE' ? now : null,
      closedAt: null,
      createdAt: now,
      updatedAt: now,
      createdByUserId: userId,
      sourceSystem: 'REGISTRATION' as const,
      sourceId: null,
    },
  });

  await createAuditLog(
    'encounter_core',
    encounterId,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: encounter },
    tenantId
  );

  return NextResponse.json({ success: true, encounter });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'encounters.core.create' }
);
