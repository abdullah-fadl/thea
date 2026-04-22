import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { submitClaim } from '@/lib/integrations/nphies/claims';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

const nphiesClaimSchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  insuranceId: z.string().min(1, 'insuranceId is required'),
  encounter: z.record(z.string(), z.unknown()),
  services: z.array(z.record(z.string(), z.unknown())),
  diagnosis: z.array(z.record(z.string(), z.unknown())).optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
  const body = await req.json();
  const v = validateBody(body, nphiesClaimSchema);
  if ('error' in v) return v.error;
  const { patientId, insuranceId, encounter, services, diagnosis } = v.data;

  const patient = await prisma.patientMaster.findFirst({
    where: { id: patientId, tenantId },
  });
  const insurance = await prisma.patientInsurance.findFirst({
    where: { id: insuranceId, tenantId },
  });

  if (!patient || !insurance) {
    return NextResponse.json({ error: 'Patient or insurance not found' }, { status: 404 });
  }

  const totalAmount = services.reduce((sum: number, s: Record<string, unknown>) => sum + Number(s.totalPrice || 0), 0);

  const result = await submitClaim({
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
    encounter: encounter as any,
    diagnosis: diagnosis as any,
    services: services as any,
    totalAmount,
  });

  const encounterId = String(encounter?.id || encounter?.encounterId || '');

  const claimEntry = await prisma.nphiesClaim.create({
    data: {
      tenantId,
      patientId,
      insuranceId,
      encounterId,
      accepted: result.accepted,
      status: result.accepted ? 'SUBMITTED' : 'REJECTED',
      response: result as any,
      createdBy: userId || null,
    } as any,
  });

  return NextResponse.json({
    success: true,
    claim: result,
    claimId: claimEntry.id,
  });
}),
  { tenantScoped: true, permissionKey: 'billing.claims.create' });
