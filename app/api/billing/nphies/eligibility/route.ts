import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody, safeParseBody } from '@/lib/validation/helpers';
import { checkEligibility, checkBulkEligibility } from '@/lib/integrations/nphies/eligibility';
import { nphiesConfig } from '@/lib/integrations/nphies/config';
import { canAccessBilling } from '@/lib/billing/access';
import { logger } from '@/lib/monitoring/logger';
import { nanoid } from 'nanoid';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const eligibilitySchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  insuranceId: z.string().min(1, 'insuranceId is required'),
  serviceDate: z.string().optional(),
  serviceCategories: z.array(z.string()).optional(),
});

const bulkEligibilitySchema = z.object({
  patients: z.array(z.object({
    patientId: z.string().min(1),
    insuranceId: z.string().min(1),
  })).min(1).max(50),
  serviceDate: z.string().optional(),
  concurrency: z.number().min(1).max(10).optional(),
});

// ---------------------------------------------------------------------------
// Route Config
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// POST — Single Eligibility Check
// ---------------------------------------------------------------------------

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
    if (!canAccessBilling({ email: user?.email, tenantId, role })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check NPHIES is configured
    const ready = nphiesConfig.checkReady();
    if (!ready.ready) {
      return NextResponse.json(
        { error: 'NPHIES integration is not configured', details: ready.reason },
        { status: 503 },
      );
    }

    const parsed = await safeParseBody(req);
    if ('error' in parsed) return parsed.error;
    const v = validateBody(parsed.body, eligibilitySchema);
    if ('error' in v) return v.error;

    const { patientId, insuranceId, serviceDate, serviceCategories } = v.data;

    // Fetch patient and insurance
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
        fullNameAr: (patient as Record<string, unknown>).fullNameAr as string | undefined,
        birthDate: patient.dob ? patient.dob.toISOString().split('T')[0] : undefined,
        gender: (patient.gender?.toLowerCase() || 'male') as 'male' | 'female',
        phone: patient.mobile,
      },
      coverage: {
        insurerId: insurance.insurerId,
        insurerName: insurance.insurerName,
        memberId: insurance.memberId,
        policyNumber: insurance.policyNumber,
        relationToSubscriber: (insurance.relation || 'self') as any,
        startDate: insurance.startDate ? insurance.startDate.toISOString() : undefined,
        endDate: insurance.endDate ? insurance.endDate.toISOString() : undefined,
      },
      serviceDate: serviceDate || new Date().toISOString().split('T')[0],
      serviceCategories,
    });

    // Log the check
    const logId = `elig_${nanoid(12)}`;
    await prisma.nphiesEligibilityLog.create({
      data: {
        id: logId,
        tenantId,
        patientId,
        insuranceId,
        status: result.status,
        eligible: result.eligible,
        response: result as any,
        createdBy: userId,
      },
    });

    // Update insurance record
    await prisma.patientInsurance.update({
      where: { id: insuranceId },
      data: {
        lastEligibilityCheck: new Date(),
        eligible: result.eligible,
        coverageActive: result.coverageActive,
        remainingBenefit: result.remainingBenefit,
        eligibilityStatus: result.status,
      },
    });

    return NextResponse.json({
      success: true,
      eligibility: result,
      logId,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.insurance.verify' },
);
