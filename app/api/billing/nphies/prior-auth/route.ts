import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody, safeParseBody } from '@/lib/validation/helpers';
import { requestPriorAuthorization, checkPriorAuthStatus } from '@/lib/integrations/nphies/priorAuth';
import { nphiesConfig } from '@/lib/integrations/nphies/config';
import { canAccessBilling } from '@/lib/billing/access';
import { logger } from '@/lib/monitoring/logger';
import { nanoid } from 'nanoid';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const priorAuthSchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  insuranceId: z.string().min(1, 'insuranceId is required'),
  encounterId: z.string().optional(),
  services: z.array(z.object({
    code: z.string().min(1),
    display: z.string().min(1),
    quantity: z.number().min(1),
    unitPrice: z.number().min(0),
  })).min(1),
  diagnosis: z.array(z.object({
    code: z.string().min(1),
    display: z.string().min(1),
  })).min(1),
  supportingInfo: z.array(z.object({
    category: z.string().min(1),
    code: z.string().min(1),
    value: z.string().min(1),
  })).optional(),
});

const statusSchema = z.object({
  authorizationNumber: z.string().min(1, 'authorizationNumber is required'),
  insurerId: z.string().min(1, 'insurerId is required'),
});

// ---------------------------------------------------------------------------
// Route Config
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// POST — Request Prior Authorization
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
    const v = validateBody(parsed.body, priorAuthSchema);
    if ('error' in v) return v.error;

    const { patientId, insuranceId, encounterId, services, diagnosis, supportingInfo } = v.data;

    // Fetch patient and insurance
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
      encounterId,
      diagnosis,
      services,
      supportingInfo,
    });

    // Store prior auth record
    const priorAuthId = `pa_${nanoid(12)}`;
    await prisma.nphiesPriorAuth.create({
      data: {
        id: priorAuthId,
        tenantId,
        patientId,
        insuranceId,
        encounterId: encounterId || null,
        status: result.status,
        approved: result.approved,
        authorizationNumber: result.authorizationNumber,
        expiryDate: result.expiryDate ? new Date(result.expiryDate) : null,
        approvedServices: result.approvedServices as any,
        denialReason: result.denialReason,
        denialReasonAr: result.denialReasonAr,
        response: result as any,
        createdBy: userId,
      },
    });

    return NextResponse.json({
      success: true,
      priorAuth: result,
      priorAuthId,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.priorauth.create' },
);

// ---------------------------------------------------------------------------
// GET — Check Prior Auth Status
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const priorAuthId = String(req.nextUrl.searchParams.get('priorAuthId') || '').trim();
    const authorizationNumber = String(req.nextUrl.searchParams.get('authorizationNumber') || '').trim();

    // If priorAuthId provided, look up from local DB
    if (priorAuthId) {
      const priorAuth = await prisma.nphiesPriorAuth.findFirst({
        where: { tenantId, id: priorAuthId },
      });
      if (!priorAuth) {
        return NextResponse.json({ error: 'Prior authorization not found' }, { status: 404 });
      }
      return NextResponse.json({ priorAuth });
    }

    // If authorizationNumber provided, check status from NPHIES
    if (authorizationNumber) {
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

      const result = await checkPriorAuthStatus({ authorizationNumber, insurerId });

      // Update local record if exists
      const existingRecord = await prisma.nphiesPriorAuth.findFirst({
        where: { tenantId, authorizationNumber },
      });
      if (existingRecord) {
        await prisma.nphiesPriorAuth.update({
          where: { id: existingRecord.id },
          data: {
            status: result.status,
            approved: result.approved,
            lastStatusCheck: new Date(),
            latestResponse: result as any,
          },
        });
      }

      return NextResponse.json({ priorAuth: result });
    }

    return NextResponse.json(
      { error: 'priorAuthId or authorizationNumber is required' },
      { status: 400 },
    );
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.priorauth.view' },
);
