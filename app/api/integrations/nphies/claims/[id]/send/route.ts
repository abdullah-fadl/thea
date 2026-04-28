// Phase 8.1.4 — Trigger sendClaim for an existing BillingClaim.
// POST /api/integrations/nphies/claims/[id]/send
// Flag-gated by BOTH FF_FHIR_API_ENABLED and FF_NPHIES_HTTP_ENABLED.
// Tenant-scoped via withAuthTenant. Permission: nphies.send.
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { isEnabled } from '@/lib/core/flags';
import { featureDisabledOutcome, notFoundOutcome, operationOutcomeError } from '@/lib/fhir/errors';
import { sendClaim } from '@/lib/integrations/nphies/operations';
import { NphiesTransportError } from '@/lib/integrations/nphies/adapter';

export const dynamic = 'force-dynamic';

const FHIR_HEADERS = { 'Content-Type': 'application/fhir+json' } as const;

export const POST = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }, params) => {
    if (!isEnabled('FF_FHIR_API_ENABLED') || !isEnabled('FF_NPHIES_HTTP_ENABLED')) {
      return NextResponse.json(featureDisabledOutcome(), { status: 404, headers: FHIR_HEADERS });
    }
    const { id } = params as { id: string };
    if (!id) {
      return NextResponse.json(
        operationOutcomeError('error', 'invalid', 'Missing claim id'),
        { status: 400, headers: FHIR_HEADERS },
      );
    }
    try {
      const result = await sendClaim({ claimId: id, tenantId });
      return NextResponse.json(result.bundle, {
        status: result.httpStatus,
        headers: { ...FHIR_HEADERS, 'X-Correlation-Id': result.correlationId },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'NPHIES claim send failed';
      if (/not found/i.test(message)) {
        return NextResponse.json(
          notFoundOutcome('Claim', id),
          { status: 404, headers: FHIR_HEADERS },
        );
      }
      const status = err instanceof NphiesTransportError && err.httpStatus ? err.httpStatus : 502;
      return NextResponse.json(
        operationOutcomeError('error', 'exception', message),
        { status, headers: FHIR_HEADERS },
      );
    }
  }),
  { tenantScoped: true, permissionKey: 'nphies.send' },
);
