// Phase 7.7 — FHIR R4 AllergyIntolerance read endpoint (read-only).
// GET /api/fhir/AllergyIntolerance/[id] → FhirAllergyIntolerance or OperationOutcome 404.
// Flag-gated by FF_FHIR_API_ENABLED (returns 404 OperationOutcome when OFF).
// Permission: fhir.patient.read. Tenant-scoped via withAuthTenant.
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { isEnabled } from '@/lib/core/flags';
import { prisma } from '@/lib/db/prisma';
import { featureDisabledOutcome, notFoundOutcome, operationOutcomeError } from '@/lib/fhir/errors';
import { serializeAllergyIntolerance } from '@/lib/fhir/serializers/allergyIntolerance';

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
        operationOutcomeError('error', 'invalid', 'Missing AllergyIntolerance id'),
        { status: 400, headers: FHIR_HEADERS },
      );
    }
    const allergy = await prisma.patientAllergy.findFirst({
      where: { tenantId, id },
    });
    if (!allergy) {
      return NextResponse.json(notFoundOutcome('AllergyIntolerance', id), { status: 404, headers: FHIR_HEADERS });
    }
    const fhir = serializeAllergyIntolerance(allergy);
    return NextResponse.json(fhir, { status: 200, headers: FHIR_HEADERS });
  }),
  { tenantScoped: true, permissionKey: 'fhir.patient.read' },
);
