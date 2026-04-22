import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { v4 as uuidv4 } from 'uuid';
import { ER_ARRIVAL_METHODS, ER_GENDERS, ER_PAYMENT_STATUSES } from '@/lib/er/constants';
import { writeErAuditLog } from '@/lib/er/audit';
import {
  allocateErVisitNumber,
  generateUnknownTempMrn,
  isPrismaDuplicateKeyError,
  retryOnDuplicateKey,
} from '@/lib/er/identifiers';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  fullName: z.string().optional(),
  gender: z.string().optional(),
  approxAge: z.number().optional().nullable(),
  arrivalMethod: z.string().optional(),
  paymentStatus: z.string().optional(),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId, userId }) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const gender = ER_GENDERS.includes(body.gender) ? body.gender : 'UNKNOWN';
  const arrivalMethod = ER_ARRIVAL_METHODS.includes(body.arrivalMethod) ? body.arrivalMethod : 'WALKIN';
  const paymentStatus = ER_PAYMENT_STATUSES.includes(body.paymentStatus) ? body.paymentStatus : 'PENDING';

  const now = new Date();
  const patientId = uuidv4();
  const encounterId = uuidv4();

  // Create unknown patient master record
  let patient: any | null = null;
  let tempMrn: string | null = null;
  const maxAttempts = 5;

  try {
    const { value } = await retryOnDuplicateKey({
      maxAttempts,
      generate: () => generateUnknownTempMrn(),
      run: async (value) => {
        tempMrn = value;
        const fullName = body.fullName?.trim() || `Unknown ${gender}`;
        const nameParts = fullName.split(/\s+/);
        patient = {
          id: patientId,
          tenantId,
          mrn: value,
          firstName: nameParts[0] || 'Unknown',
          lastName: nameParts.slice(1).join(' ') || gender,
          fullName,
          nameNormalized: fullName.toLowerCase(),
          gender,
          status: 'UNKNOWN',
          dob: null,
          createdAt: now,
          updatedAt: now,
        };
        await prisma.patientMaster.create({ data: patient as Parameters<typeof prisma.patientMaster.create>[0]['data'] });
        return true;
      },
    });
    tempMrn = value;
  } catch (err: unknown) {
    const message =
      isPrismaDuplicateKeyError(err)
        ? 'Temporary MRN already exists. Please retry.'
        : (err instanceof Error ? err.message : null) || 'Failed to register unknown patient';
    return NextResponse.json({ error: message }, { status: isPrismaDuplicateKeyError(err) ? 409 : 500 });
  }

  let encounter: any | null = null;
  const maxAttemptsForVisit = 3;
  for (let attempt = 1; attempt <= maxAttemptsForVisit; attempt++) {
    const visitNumber = await allocateErVisitNumber(null, tenantId);
    encounter = {
      id: encounterId,
      tenantId,
      patientId,
      status: 'REGISTERED' as const,
      arrivalMethod: arrivalMethod as string,
      paymentStatus: paymentStatus as string,
      triageLevel: null,
      chiefComplaint: null,
      startedAt: now,
      closedAt: null,
      createdByUserId: userId,
      updatedAt: now,
    };
    try {
      await prisma.erEncounter.create({ data: encounter as Parameters<typeof prisma.erEncounter.create>[0]['data'] });
      encounter.visitNumber = visitNumber;
      break;
    } catch (err: unknown) {
      if (isPrismaDuplicateKeyError(err) && attempt < maxAttemptsForVisit) {
        continue;
      }
      // best-effort cleanup to avoid orphan unknown patients
      try {
        await prisma.patientMaster.delete({ where: { id: patientId } });
      } catch {}
      return NextResponse.json(
        { error: (err instanceof Error ? err.message : null) || 'Failed to create encounter' },
        { status: 500 }
      );
    }
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'patient',
    entityId: patientId,
    action: 'CREATE',
    after: patient,
    ip,
  });
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'encounter',
    entityId: encounterId,
    action: 'CREATE',
    after: encounter,
    ip,
  });

  return NextResponse.json({ success: true, patient, encounter });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.register.create' }
);
