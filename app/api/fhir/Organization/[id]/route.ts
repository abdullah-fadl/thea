// Phase 8.1.3 — FHIR R4 Organization read endpoint (NPHIES supporting actor).
// GET /api/fhir/Organization/[id] → FhirOrganization (NPHIES profile) or
// OperationOutcome 404. Read-only.
//
// Two source models — Hospital (facility) and BillingPayer (insurance).
// We look up Hospital first, then BillingPayer; the serializer
// discriminates on input.kind. NPHIES treats both as `Organization` so a
// single endpoint suffices.
//
// Flag-gated by FF_FHIR_API_ENABLED (returns 404 OperationOutcome when OFF).
// Permission: fhir.patient.read (reused). Tenant-scoped via withAuthTenant.
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { isEnabled } from '@/lib/core/flags';
import { prisma } from '@/lib/db/prisma';
import { featureDisabledOutcome, notFoundOutcome, operationOutcomeError } from '@/lib/fhir/errors';
import { serializeOrganization } from '@/lib/fhir/serializers/organization';

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
        operationOutcomeError('error', 'invalid', 'Missing Organization id'),
        { status: 400, headers: FHIR_HEADERS },
      );
    }
    const hospital = await prisma.hospital.findFirst({
      where: { tenantId, id },
    });
    if (hospital) {
      const fhir = serializeOrganization({ kind: 'facility', row: hospital }, tenantId);
      return NextResponse.json(fhir, { status: 200, headers: FHIR_HEADERS });
    }
    const payer = await prisma.billingPayer.findFirst({
      where: { tenantId, id },
    });
    if (payer) {
      const fhir = serializeOrganization({ kind: 'payer', row: payer }, tenantId);
      return NextResponse.json(fhir, { status: 200, headers: FHIR_HEADERS });
    }
    return NextResponse.json(notFoundOutcome('Organization', id), { status: 404, headers: FHIR_HEADERS });
  }),
  { tenantScoped: true, permissionKey: 'fhir.patient.read' },
);
