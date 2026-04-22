import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody, safeParseBody } from '@/lib/validation/helpers';
import { submitClaim, resubmitClaim, checkClaimStatus } from '@/lib/integrations/nphies/claims';
import { nphiesConfig } from '@/lib/integrations/nphies/config';
import { canAccessBilling } from '@/lib/billing/access';
import { logger } from '@/lib/monitoring/logger';
import { nanoid } from 'nanoid';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const serviceSchema = z.object({
  code: z.string().min(1),
  display: z.string().min(1),
  date: z.string().min(1),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
  totalPrice: z.number().min(0),
  priorAuthNumber: z.string().optional(),
});

const diagnosisSchema = z.object({
  code: z.string().min(1),
  display: z.string().min(1),
  type: z.enum(['principal', 'secondary']),
});

const submitClaimSchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  insuranceId: z.string().min(1, 'insuranceId is required'),
  encounterId: z.string().min(1, 'encounterId is required'),
  encounterType: z.enum(['outpatient', 'inpatient', 'emergency']),
  encounterStartDate: z.string().min(1),
  encounterEndDate: z.string().optional(),
  providerId: z.string().optional(),
  providerName: z.string().optional(),
  providerSpecialty: z.string().optional(),
  services: z.array(serviceSchema).min(1),
  diagnosis: z.array(diagnosisSchema).min(1),
});

const resubmitClaimSchema = submitClaimSchema.extend({
  originalClaimReference: z.string().min(1, 'originalClaimReference is required'),
  resubmissionReason: z.string().min(1, 'resubmissionReason is required'),
});

const statusSchema = z.object({
  claimReference: z.string().min(1),
  insurerId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Route Config
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// POST — Submit or Resubmit a Claim
// ---------------------------------------------------------------------------

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
    if (!canAccessBilling({ email: user?.email, tenantId, role })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const ready = nphiesConfig.checkReady();
    if (!ready.ready) {
      return NextResponse.json(
        { error: 'NPHIES integration is not configured', details: ready.reason },
        { status: 503 },
      );
    }

    const parsed = await safeParseBody(req);
    if ('error' in parsed) return parsed.error;
    const body = parsed.body as any;

    // Determine if this is a resubmission
    const isResubmit = !!body?.originalClaimReference;
    const schema = isResubmit ? resubmitClaimSchema : submitClaimSchema;
    const v = validateBody(body, schema);
    if ('error' in v) return v.error;

    const data = v.data;

    // Fetch patient and insurance
    const patient = await prisma.patientMaster.findFirst({
      where: { id: data.patientId, tenantId },
    });
    const insurance = await prisma.patientInsurance.findFirst({
      where: { id: data.insuranceId, tenantId },
    });

    if (!patient || !insurance) {
      return NextResponse.json({ error: 'Patient or insurance not found' }, { status: 404 });
    }

    const totalAmount = data.services.reduce(
      (sum: number, s: { totalPrice: number }) => sum + s.totalPrice,
      0,
    );

    const claimRequest = {
      patient: {
        nationalId: patient.nationalId || patient.iqama,
        fullName: patient.fullName,
        birthDate: patient.dob ? patient.dob.toISOString().split('T')[0] : undefined,
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
      encounter: {
        id: data.encounterId,
        type: data.encounterType,
        startDate: data.encounterStartDate,
        endDate: data.encounterEndDate,
        provider: {
          id: data.providerId || 'default',
          name: data.providerName || 'Provider',
          specialty: data.providerSpecialty || 'general',
        },
      },
      diagnosis: data.diagnosis,
      services: data.services,
      totalAmount,
    };

    const result = isResubmit
      ? await resubmitClaim({
          ...claimRequest,
          originalClaimReference: (data as any).originalClaimReference,
          resubmissionReason: (data as any).resubmissionReason,
        })
      : await submitClaim(claimRequest);

    // Store claim record
    const claimId = `clm_${nanoid(12)}`;
    await prisma.nphiesClaim.create({
      data: {
        id: claimId,
        tenantId,
        patientId: data.patientId,
        insuranceId: data.insuranceId,
        encounterId: data.encounterId,
        isResubmission: isResubmit,
        originalClaimReference: isResubmit ? (data as any).originalClaimReference : null,
        nphiesClaimId: result.claimId,
        nphiesClaimReference: result.claimReference,
        status: result.status,
        accepted: result.accepted,
        adjudicatedAmount: result.adjudicatedAmount,
        payerAmount: result.payerAmount,
        patientResponsibility: result.patientResponsibility,
        denialReason: result.denialReason,
        denialReasonAr: result.denialReasonAr,
        response: result as any,
        createdBy: userId,
      },
    });

    return NextResponse.json({
      success: true,
      claim: result,
      claimId,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.claims.create' },
);

// ---------------------------------------------------------------------------
// GET — Check Claim Status
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const claimId = String(req.nextUrl.searchParams.get('claimId') || '').trim();
    const claimReference = String(req.nextUrl.searchParams.get('claimReference') || '').trim();

    // If claimId provided, look up from local DB
    if (claimId) {
      const claim = await prisma.nphiesClaim.findFirst({
        where: { tenantId, id: claimId },
      });
      if (!claim) {
        return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
      }
      return NextResponse.json({ claim });
    }

    // If claimReference provided, check status from NPHIES
    if (claimReference) {
      const insurerId = String(req.nextUrl.searchParams.get('insurerId') || '').trim();
      if (!insurerId) {
        return NextResponse.json({ error: 'insurerId is required for status check' }, { status: 400 });
      }

      const ready = nphiesConfig.checkReady();
      if (!ready.ready) {
        return NextResponse.json(
          { error: 'NPHIES integration is not configured', details: ready.reason },
          { status: 503 },
        );
      }

      const result = await checkClaimStatus({ claimReference, insurerId });
      return NextResponse.json({ claim: result });
    }

    return NextResponse.json({ error: 'claimId or claimReference is required' }, { status: 400 });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.claims.view' },
);
