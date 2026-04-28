// Phase 8.1.1 — FHIR R4 Coverage read endpoint (NPHIES financial, read-only).
// GET /api/fhir/Coverage/[id] → FhirCoverage (NPHIES profile) or OperationOutcome 404.
// Flag-gated by FF_FHIR_API_ENABLED (returns 404 OperationOutcome when OFF).
// Permission: fhir.patient.read (reused from Phase 5.4 — future phase may
// split into fhir.coverage.read). Tenant-scoped via withAuthTenant.
//
// Replaces the legacy GET+PUT pair that delegated to handleFhirRead/Update.
// Phase 8.1.1 establishes the read-only NPHIES discipline; mutate paths for
// Coverage are out of scope and will be handled (if at all) by the NPHIES
// adapter in 8.1.4.
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { isEnabled } from '@/lib/core/flags';
import { prisma } from '@/lib/db/prisma';
import { featureDisabledOutcome, notFoundOutcome, operationOutcomeError } from '@/lib/fhir/errors';
import { serializeCoverage } from '@/lib/fhir/serializers/coverage';

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
        operationOutcomeError('error', 'invalid', 'Missing Coverage id'),
        { status: 400, headers: FHIR_HEADERS },
      );
    }
    const ins = await prisma.patientInsurance.findFirst({
      where: { tenantId, id },
    });
    if (!ins) {
      return NextResponse.json(notFoundOutcome('Coverage', id), { status: 404, headers: FHIR_HEADERS });
    }
    const fhir = serializeCoverage(ins, tenantId);
    return NextResponse.json(fhir, { status: 200, headers: FHIR_HEADERS });
  }),
  { tenantScoped: true, permissionKey: 'fhir.patient.read' },
);
