import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { requestPriorAuth, checkPreauthStatus } from '@/lib/fhir/nphies';

export const dynamic = 'force-dynamic';

/**
 * POST /api/fhir/nphies/preauth
 *
 * Request prior authorization or check status.
 * Body: { action: 'request' | 'status', ...params }
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const body = await req.json().catch(() => ({}));

    if (body.action === 'status') {
      if (!body.authorizationNumber || !body.insurerId) {
        return NextResponse.json(
          {
            resourceType: 'OperationOutcome',
            issue: [{
              severity: 'error',
              code: 'required',
              diagnostics: 'authorizationNumber and insurerId are required for status check',
            }],
          },
          { status: 400, headers: { 'Content-Type': 'application/fhir+json' } },
        );
      }

      const result = await checkPreauthStatus({
        tenantId,
        authorizationNumber: body.authorizationNumber,
        insurerId: body.insurerId,
      });

      return NextResponse.json(result, {
        headers: { 'Content-Type': 'application/fhir+json' },
      });
    }

    // Default: request prior auth
    if (!body.nationalId || !body.insurerId || !body.diagnosis || !body.services) {
      return NextResponse.json(
        {
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            diagnostics: 'nationalId, insurerId, diagnosis[], and services[] are required',
          }],
        },
        { status: 400, headers: { 'Content-Type': 'application/fhir+json' } },
      );
    }

    const result = await requestPriorAuth({
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
      encounterId: body.encounterId,
      diagnosis: body.diagnosis,
      services: body.services,
      supportingInfo: body.supportingInfo,
    });

    return NextResponse.json(result, {
      headers: { 'Content-Type': 'application/fhir+json' },
    });
  }),
  { tenantScoped: true, permissionKey: 'billing.create' },
);
