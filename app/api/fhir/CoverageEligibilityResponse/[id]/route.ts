// Phase 8.1.2 — FHIR R4 CoverageEligibilityResponse read endpoint (NPHIES eligibility, read-only).
// GET /api/fhir/CoverageEligibilityResponse/[id] → FhirCoverageEligibilityResponse
//   (NPHIES profile) or OperationOutcome 404.
// Flag-gated by FF_FHIR_API_ENABLED (returns 404 OperationOutcome when OFF).
// Permission: fhir.patient.read. Tenant-scoped via withAuthTenant.
//
// Source: NphiesEligibilityLog. Same row id is shared with the sibling
// CoverageEligibilityRequest route — the response Json on the row is
// projected into the FHIR response shape (insurance[].item[].benefit[],
// outcome, disposition, error[]).
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { isEnabled } from '@/lib/core/flags';
import { prisma } from '@/lib/db/prisma';
import { featureDisabledOutcome, notFoundOutcome, operationOutcomeError } from '@/lib/fhir/errors';
import { serializeCoverageEligibilityResponse } from '@/lib/fhir/serializers/coverageEligibilityResponse';

export const dynamic = 'force-dynamic';

const FHIR_HEADERS = { 'Content-Type': 'application/fhir+json' } as const;

export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }, params) => {
    if (!isEnabled('FF_FHIR_API_ENABLED')) {
      return NextResponse.json(featureDisabledOutcome(), { status: 404, headers: FHIR_HEADERS });
    }
    const { id } = params as { id: string };
    if (!id) {
      return NextResponse.json(
        operationOutcomeError('error', 'invalid', 'Missing CoverageEligibilityResponse id'),
        { status: 400, headers: FHIR_HEADERS },
      );
    }
    const log = await prisma.nphiesEligibilityLog.findFirst({
      where: { tenantId, id },
    });
    if (!log) {
      return NextResponse.json(
        notFoundOutcome('CoverageEligibilityResponse', id),
        { status: 404, headers: FHIR_HEADERS },
      );
    }
    const fhir = serializeCoverageEligibilityResponse(log, tenantId);
    return NextResponse.json(fhir, { status: 200, headers: FHIR_HEADERS });
  }),
  { tenantScoped: true, permissionKey: 'fhir.patient.read' },
);
