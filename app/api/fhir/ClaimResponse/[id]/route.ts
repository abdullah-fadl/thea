// Phase 8.1.1 — FHIR R4 ClaimResponse read endpoint (NPHIES financial, read-only).
// GET /api/fhir/ClaimResponse/[id] → FhirClaimResponse (NPHIES profile) or OperationOutcome 404.
// Flag-gated by FF_FHIR_API_ENABLED (returns 404 OperationOutcome when OFF).
// Permission: fhir.patient.read. Tenant-scoped via withAuthTenant.
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { isEnabled } from '@/lib/core/flags';
import { prisma } from '@/lib/db/prisma';
import { featureDisabledOutcome, notFoundOutcome, operationOutcomeError } from '@/lib/fhir/errors';
import { serializeClaimResponse } from '@/lib/fhir/serializers/claimResponse';

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
        operationOutcomeError('error', 'invalid', 'Missing ClaimResponse id'),
        { status: 400, headers: FHIR_HEADERS },
      );
    }
    const cr = await prisma.nphiesClaim.findFirst({
      where: { tenantId, id },
    });
    if (!cr) {
      return NextResponse.json(notFoundOutcome('ClaimResponse', id), { status: 404, headers: FHIR_HEADERS });
    }
    const fhir = serializeClaimResponse(cr, tenantId);
    return NextResponse.json(fhir, { status: 200, headers: FHIR_HEADERS });
  }),
  { tenantScoped: true, permissionKey: 'fhir.patient.read' },
);
