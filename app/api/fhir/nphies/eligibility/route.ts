import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { checkEligibility } from '@/lib/fhir/nphies';

export const dynamic = 'force-dynamic';

/**
 * POST /api/fhir/nphies/eligibility
 *
 * Check patient insurance eligibility via NPHIES.
 * Body: { patientId, nationalId, insurerId, memberId, serviceCategory? }
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const body = await req.json().catch(() => ({}));

    if (!body.nationalId || !body.insurerId || !body.memberId) {
      return NextResponse.json(
        {
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            diagnostics: 'nationalId, insurerId, and memberId are required',
          }],
        },
        { status: 400, headers: { 'Content-Type': 'application/fhir+json' } },
      );
    }

    const result = await checkEligibility({
      tenantId,
      patientId: body.patientId || '',
      nationalId: body.nationalId,
      insurerId: body.insurerId,
      memberId: body.memberId,
      serviceCategory: body.serviceCategory,
    });

    return NextResponse.json(result, {
      headers: { 'Content-Type': 'application/fhir+json' },
    });
  }),
  { tenantScoped: true, permissionKey: 'billing.view' },
);
