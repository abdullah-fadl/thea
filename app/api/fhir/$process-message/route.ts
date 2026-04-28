// Phase 8.1.4 — FHIR R4 $process-message round-trip endpoint.
// POST /api/fhir/$process-message accepts an inbound message-mode Bundle
// and returns the response Bundle that NPHIES (or its mock) hands back.
// Mostly intended for sandbox testing — production traffic goes through
// the typed sendEligibilityCheck/sendClaim operations.
//
// Flag-gated by BOTH FF_FHIR_API_ENABLED and FF_NPHIES_HTTP_ENABLED.
// When either flag is OFF the endpoint returns a 404 OperationOutcome.
// Tenant-scoped via withAuthTenant. Permission: nphies.send.
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { isEnabled } from '@/lib/core/flags';
import { featureDisabledOutcome, operationOutcomeError } from '@/lib/fhir/errors';
import type { FhirBundle } from '@/lib/fhir/types';
import { sendNphiesMessage, NphiesTransportError } from '@/lib/integrations/nphies/adapter';

export const dynamic = 'force-dynamic';

const FHIR_HEADERS = { 'Content-Type': 'application/fhir+json' } as const;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    if (!isEnabled('FF_FHIR_API_ENABLED') || !isEnabled('FF_NPHIES_HTTP_ENABLED')) {
      return NextResponse.json(featureDisabledOutcome(), { status: 404, headers: FHIR_HEADERS });
    }

    let bundle: FhirBundle;
    try {
      bundle = (await req.json()) as FhirBundle;
    } catch {
      return NextResponse.json(
        operationOutcomeError('error', 'invalid', 'Request body must be valid FHIR JSON'),
        { status: 400, headers: FHIR_HEADERS },
      );
    }

    if (bundle?.resourceType !== 'Bundle' || bundle.type !== 'message') {
      return NextResponse.json(
        operationOutcomeError('error', 'invalid', 'Body must be a Bundle of type "message"'),
        { status: 400, headers: FHIR_HEADERS },
      );
    }

    try {
      const result = await sendNphiesMessage({ bundle, tenantId });
      return NextResponse.json(result.bundle, {
        status: result.httpStatus,
        headers: { ...FHIR_HEADERS, 'X-Correlation-Id': result.correlationId },
      });
    } catch (err) {
      const status = err instanceof NphiesTransportError && err.httpStatus ? err.httpStatus : 502;
      const message = err instanceof Error ? err.message : 'NPHIES transport failure';
      return NextResponse.json(
        operationOutcomeError('error', 'exception', message),
        { status, headers: FHIR_HEADERS },
      );
    }
  }),
  { tenantScoped: true, permissionKey: 'nphies.send' },
);
