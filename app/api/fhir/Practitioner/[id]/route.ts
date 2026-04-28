// Phase 8.1.3 — FHIR R4 Practitioner read endpoint (NPHIES supporting actor).
// GET /api/fhir/Practitioner/[id] → FhirPractitioner (NPHIES profile) or
// OperationOutcome 404. Read-only; mutate paths are out of scope.
// Flag-gated by FF_FHIR_API_ENABLED (returns 404 OperationOutcome when OFF).
// Permission: fhir.patient.read (reused). Tenant-scoped via withAuthTenant.
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { isEnabled } from '@/lib/core/flags';
import { prisma } from '@/lib/db/prisma';
import { featureDisabledOutcome, notFoundOutcome, operationOutcomeError } from '@/lib/fhir/errors';
import { serializePractitioner } from '@/lib/fhir/serializers/practitioner';

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
        operationOutcomeError('error', 'invalid', 'Missing Practitioner id'),
        { status: 400, headers: FHIR_HEADERS },
      );
    }
    const provider = await prisma.clinicalInfraProvider.findFirst({
      where: { tenantId, id },
    });
    if (!provider) {
      return NextResponse.json(notFoundOutcome('Practitioner', id), { status: 404, headers: FHIR_HEADERS });
    }
    const profile = await prisma.clinicalInfraProviderProfile.findFirst({
      where: { tenantId, providerId: id },
    });
    const fhir = serializePractitioner(provider, profile, tenantId);
    return NextResponse.json(fhir, { status: 200, headers: FHIR_HEADERS });
  }),
  { tenantScoped: true, permissionKey: 'fhir.patient.read' },
);
