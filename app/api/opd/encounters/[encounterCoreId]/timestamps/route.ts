import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

import { createAuditLog } from '@/lib/utils/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { validateBody } from '@/lib/validation/helpers';
import { opdTimestampsSchema } from '@/lib/validation/opd.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Valid OPD timestamp field names (flattened on the opd_encounters table)
const VALID_TIMESTAMP_FIELDS = new Set([
  'arrivedAt', 'nursingStartAt', 'nursingEndAt',
  'doctorStartAt', 'doctorEndAt',
  'procedureStartAt', 'procedureEndAt',
]);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {

  const encounterCoreId = String((params as Record<string, string>)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
  if (deathGuard) return deathGuard;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, opdTimestampsSchema);
  if ('error' in v) return v.error;
  const { opdTimestamps, timestamps: timestampsField } = v.data;

  const timestamps = opdTimestamps || timestampsField || {};

  const encounterCore = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounterCore) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  if (encounterCore.encounterType !== 'OPD') {
    return NextResponse.json({ error: 'Encounter is not OPD' }, { status: 409 });
  }
  if (encounterCore.status === 'CLOSED') {
    return NextResponse.json({ error: 'Encounter is closed' }, { status: 409 });
  }

  const opd = await prisma.opdEncounter.findUnique({
    where: { encounterCoreId },
  });
  if (!opd) {
    return NextResponse.json({ error: 'OPD encounter not found' }, { status: 404 });
  }

  // Build append-only timestamp patch (only set if not already set)
  const invalidFields: string[] = [];
  const conflicts: { field: string; existingValue: any }[] = [];
  const patch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(timestamps)) {
    if (!VALID_TIMESTAMP_FIELDS.has(key)) {
      invalidFields.push(key);
      continue;
    }
    if (value === null || value === undefined) continue;

    const parsedDate = new Date(value as string);
    if (Number.isNaN(parsedDate.getTime())) {
      invalidFields.push(key);
      continue;
    }

    // Append-only: don't overwrite existing values
    const existingValue = (opd as unknown as Record<string, unknown>)[key];
    if (existingValue) {
      conflicts.push({ field: key, existingValue });
      continue;
    }

    patch[key] = parsedDate;
  }

  if (invalidFields.length) {
    return NextResponse.json({ error: 'Invalid timestamp values', fields: invalidFields }, { status: 400 });
  }
  if (conflicts.length) {
    return NextResponse.json({
      error: 'Timestamp already set',
      field: conflicts[0].field,
      existingValue: conflicts[0].existingValue,
    }, { status: 409 });
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ success: true, opd, noOp: true, message: 'No timestamps to append' });
  }

  const updatedOpd = await prisma.opdEncounter.update({
    where: { encounterCoreId },
    data: patch,
  });

  await createAuditLog(
    'opd_encounter',
    String(opd.id || encounterCoreId),
    'OPD_TIMESTAMPS_APPEND',
    userId || 'system',
    user?.email,
    { before: opd, after: updatedOpd },
    tenantId
  );

  return NextResponse.json({ success: true, opd: updatedOpd });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKeys: ['opd.nursing.edit', 'opd.doctor.encounter.view'] }
);
