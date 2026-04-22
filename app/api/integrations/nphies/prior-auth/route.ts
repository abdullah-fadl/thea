import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { requestPriorAuthorization } from '@/lib/integrations/nphies/priorAuth';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

const nphiesPriorAuthSchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  insuranceId: z.string().min(1, 'insuranceId is required'),
  encounterId: z.string().optional(),
  services: z.array(z.record(z.string(), z.unknown())),
  diagnosis: z.array(z.record(z.string(), z.unknown())).optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
  const body = await req.json();
  const v = validateBody(body, nphiesPriorAuthSchema);
  if ('error' in v) return v.error;
  const { patientId, insuranceId, encounterId, services, diagnosis } = v.data;

  const patient = await prisma.patientMaster.findFirst({
    where: { id: patientId, tenantId },
  });
  const insurance = await prisma.patientInsurance.findFirst({
    where: { id: insuranceId, tenantId },
  });

  if (!patient || !insurance) {
    return NextResponse.json({ error: 'Patient or insurance not found' }, { status: 404 });
  }

  const result = await requestPriorAuthorization({
    patient: {
      nationalId: patient.nationalId || patient.iqama,
      fullName: patient.fullName,
      birthDate: patient.dob ? patient.dob.toISOString() : undefined,
      gender: (patient.gender?.toLowerCase() || 'male') as 'male' | 'female',
    },
    coverage: {
      insurerId: insurance.insurerId,
      insurerName: insurance.insurerName,
      memberId: insurance.memberId,
      policyNumber: insurance.policyNumber,
      relationToSubscriber: (insurance.relation || 'self') as 'self' | 'spouse' | 'child' | 'other',
      startDate: insurance.startDate ? insurance.startDate.toISOString() : undefined,
    },
    diagnosis: diagnosis as any,
    services: services as any,
  });

  const priorAuthEntry = await prisma.nphiesPriorAuth.create({
    data: {
      tenantId,
      patientId,
      insuranceId,
      encounterId: encounterId || null,
      approved: result.approved,
      authorizationNumber: result.authorizationNumber || null,
      expiryDate: result.expiryDate ? new Date(result.expiryDate) : null,
      status: result.approved ? 'APPROVED' : 'DENIED',
      response: result as any,
      createdBy: userId || null,
    } as any,
  });

  return NextResponse.json({
    success: true,
    priorAuth: result,
    priorAuthId: priorAuthEntry.id,
  });
}),
  { tenantScoped: true, permissionKey: 'billing.priorauth.create' });
