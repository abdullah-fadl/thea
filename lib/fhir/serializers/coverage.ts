// Phase 8.1.1 — FHIR R4 Coverage serializer (NPHIES financial foundation)
// Sync pure function: PatientInsurance (Prisma) → FhirCoverage
//
// Discovery: PatientInsurance is the canonical FHIR Coverage source — it
// already carries every field NPHIES expects in `Coverage`: payerName/payerId
// (→ payor), policyNumber/memberId/groupNumber/planType (→ class), relation
// (→ relationship), status, effective/expiry dates (→ period), beneficiary
// patientId (→ beneficiary). NphiesEligibilityLog is an *event* log, not the
// coverage itself.
//
// Stamps `meta.profile = [NPHIES_PROFILES.COVERAGE]` so future profile
// validators can shape-check; no payor enrichment, no DB writes.
import type { PatientInsurance } from '@prisma/client';
import type { FhirCoverage, FhirCodeableConcept } from '../resources/types';
import { NPHIES_PROFILES } from '../nphies-profiles';

const COVERAGE_CLASS_SYSTEM       = 'http://terminology.hl7.org/CodeSystem/coverage-class';
const SUBSCRIBER_RELATION_SYSTEM  = 'http://terminology.hl7.org/CodeSystem/subscriber-relationship';

const STATUS_MAP: Record<string, FhirCoverage['status']> = {
  active:    'active',
  expired:   'cancelled',
  cancelled: 'cancelled',
  draft:     'draft',
};

function classConcept(code: string, display: string): FhirCodeableConcept {
  return { coding: [{ system: COVERAGE_CLASS_SYSTEM, code, display }] };
}

export function serializeCoverage(
  ins: PatientInsurance,
  _tenantId: string,
): FhirCoverage {
  const cls: NonNullable<FhirCoverage['class']> = [];
  if (ins.groupNumber)  cls.push({ type: classConcept('group',      'Group'),      value: ins.groupNumber });
  if (ins.planType)     cls.push({ type: classConcept('plan',       'Plan'),       value: ins.planType });
  if (ins.policyNumber) cls.push({ type: classConcept('subgroup',   'Sub-Group'),  value: ins.policyNumber });

  const payor: FhirCoverage['payor'] = [
    {
      display:   ins.payerName,
      reference: ins.insurerId
        ? `Organization/${ins.insurerId}`
        : ins.payerId
          ? `Organization/${ins.payerId}`
          : undefined,
      type:      'Organization',
    },
  ];

  return {
    resourceType: 'Coverage',
    id: ins.id,
    meta: {
      lastUpdated: ins.updatedAt.toISOString(),
      profile:     [NPHIES_PROFILES.COVERAGE],
    },
    identifier: ins.memberId
      ? [{ system: 'https://thea.com.sa/fhir/coverage-member-id', value: ins.memberId }]
      : undefined,
    status: STATUS_MAP[ins.status] ?? 'active',
    subscriberId: ins.memberId ?? undefined,
    beneficiary: { reference: `Patient/${ins.patientId}`, type: 'Patient' },
    relationship: ins.relation
      ? {
          coding: [{
            system:  SUBSCRIBER_RELATION_SYSTEM,
            code:    ins.relation,
            display: ins.relation,
          }],
        }
      : undefined,
    period:
      ins.effectiveDate || ins.expiryDate
        ? {
            start: ins.effectiveDate?.toISOString(),
            end:   ins.expiryDate?.toISOString(),
          }
        : undefined,
    payor,
    class: cls.length > 0 ? cls : undefined,
  };
}
