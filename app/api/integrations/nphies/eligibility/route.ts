import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { checkEligibility } from '@/lib/integrations/nphies/eligibility';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

const nphiesEligibilitySchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  insuranceId: z.string().min(1, 'insuranceId is required'),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
  const body = await req.json();
  const v = validateBody(body, nphiesEligibilitySchema);
  if ('error' in v) return v.error;
  const { patientId, insuranceId } = v.data;

  const patient = await prisma.patientMaster.findFirst({
    where: { id: patientId, tenantId },
  });
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  const insurance = await prisma.patientInsurance.findFirst({
    where: { id: insuranceId, patientId, tenantId },
  });
  if (!insurance) {
    return NextResponse.json({ error: 'Insurance not found' }, { status: 404 });
  }

  const result = await checkEligibility({
    patient: {
      nationalId: patient.nationalId || patient.iqama,
      fullName: patient.fullName,
      fullNameAr: patient.fullName,
      birthDate: patient.dob ? patient.dob.toISOString() : undefined,
      gender: (patient.gender?.toLowerCase() || 'male') as 'male' | 'female',
      phone: patient.mobile,
    },
    coverage: {
      insurerId: insurance.insurerId,
      insurerName: insurance.insurerName,
      memberId: insurance.memberId,
      policyNumber: insurance.policyNumber,
      relationToSubscriber: (insurance.relation || 'self') as 'self' | 'spouse' | 'child' | 'other',
      startDate: insurance.startDate ? insurance.startDate.toISOString() : undefined,
      endDate: insurance.endDate ? insurance.endDate.toISOString() : undefined,
    },
    serviceDate: new Date().toISOString().split('T')[0],
  });

  const logEntry = await prisma.nphiesEligibilityLog.create({
    data: {
      tenantId,
      patientId,
      insuranceId,
      status: result.eligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE',
      eligible: result.eligible,
      response: result as any,
      createdBy: userId || null,
    } as any,
  });

  await prisma.patientInsurance.update({
    where: { id: insuranceId },
    data: {
      lastEligibilityCheck: new Date(),
      eligible: result.eligible,
      coverageActive: result.coverageActive,
      remainingBenefit: result.remainingBenefit != null ? result.remainingBenefit : undefined,
    },
  });

  return NextResponse.json({
    success: true,
    eligibility: result,
    logId: logEntry.id,
  });
}),
  { tenantScoped: true, permissionKey: 'billing.insurance.verify' });
