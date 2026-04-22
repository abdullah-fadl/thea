import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { submitClaim, checkClaimStatus, resubmitClaim } from '@/lib/fhir/nphies';

export const dynamic = 'force-dynamic';

/**
 * POST /api/fhir/nphies/claim
 *
 * Submit, resubmit, or check status of a claim.
 * Body: { action: 'submit' | 'status' | 'resubmit', ...params }
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const body = await req.json().catch(() => ({}));

    // ── Check claim status ──
    if (body.action === 'status') {
      if (!body.claimId || !body.insurerId) {
        return NextResponse.json(
          {
            resourceType: 'OperationOutcome',
            issue: [{
              severity: 'error',
              code: 'required',
              diagnostics: 'claimId and insurerId are required for status check',
            }],
          },
          { status: 400, headers: { 'Content-Type': 'application/fhir+json' } },
        );
      }

      const result = await checkClaimStatus({
        tenantId,
        claimId: body.claimId,
        insurerId: body.insurerId,
      });

      return NextResponse.json(result, {
        headers: { 'Content-Type': 'application/fhir+json' },
      });
    }

    // ── Resubmit claim ──
    if (body.action === 'resubmit') {
      if (!body.originalClaimId || !body.insurerId) {
        return NextResponse.json(
          {
            resourceType: 'OperationOutcome',
            issue: [{
              severity: 'error',
              code: 'required',
              diagnostics: 'originalClaimId and insurerId are required for resubmission',
            }],
          },
          { status: 400, headers: { 'Content-Type': 'application/fhir+json' } },
        );
      }

      const result = await resubmitClaim({
        tenantId,
        originalClaimId: body.originalClaimId,
        insurerId: body.insurerId,
        corrections: body.corrections || {},
      });

      return NextResponse.json(result, {
        headers: { 'Content-Type': 'application/fhir+json' },
      });
    }

    // ── Submit new claim (default) ──
    if (!body.nationalId || !body.insurerId || !body.encounter || !body.services) {
      return NextResponse.json(
        {
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            diagnostics: 'nationalId, insurerId, encounter, and services[] are required',
          }],
        },
        { status: 400, headers: { 'Content-Type': 'application/fhir+json' } },
      );
    }

    const result = await submitClaim({
      tenantId,
      patientId: body.patientId || '',
      nationalId: body.nationalId,
      fullName: body.fullName || '',
      birthDate: body.birthDate || '',
      gender: body.gender || 'male',
      insurerId: body.insurerId,
      insurerName: body.insurerName || '',
      memberId: body.memberId || '',
      policyNumber: body.policyNumber || '',
      encounter: body.encounter,
      diagnosis: body.diagnosis || [],
      services: body.services,
      totalAmount: body.totalAmount || 0,
    });

    return NextResponse.json(result, {
      status: result.accepted ? 201 : 200,
      headers: { 'Content-Type': 'application/fhir+json' },
    });
  }),
  { tenantScoped: true, permissionKey: 'billing.create' },
);
