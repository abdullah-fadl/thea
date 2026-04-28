// Phase 8.1.2 — FHIR R4 CoverageEligibilityResponse serializer (NPHIES eligibility)
// Sync pure function: NphiesEligibilityLog (Prisma) → FhirCoverageEligibilityResponse
//
// Discovery: NphiesEligibilityLog is also the canonical
// CoverageEligibilityResponse source — the row carries the platform's
// final decision (`eligible` boolean + `status` string disposition) plus
// the structured response payload in `response: Json`. The shape of that
// Json mirrors `lib/integrations/nphies/eligibility.ts`'s
// `NphiesEligibilityResponse`: status, eligible, coverageActive,
// disposition, benefitPeriod, benefits[] (with serviceCategory + per-type
// allowed/used money), errors[].
//
// Same `log.id` is surfaced under both the request resource (sibling
// serializer) and this response resource — request and response are two
// projections of one log row. The `request` Reference therefore points
// back at `CoverageEligibilityRequest/${log.id}`.
//
// `insurer` follows the 8.1.1 placeholder convention (`Organization/${
// insuranceId}`) until 8.1.5 wires the validator-driven insurer lookup.
import type { NphiesEligibilityLog } from '@prisma/client';
import type {
  FhirCoverageEligibilityResponse,
  FhirCodeableConcept,
} from '../resources/types';
import { NPHIES_PROFILES } from '../nphies-profiles';

const SERVICE_CATEGORY_SYSTEM = 'http://terminology.hl7.org/CodeSystem/ex-benefitcategory';
const BENEFIT_TYPE_SYSTEM     = 'http://terminology.hl7.org/CodeSystem/benefit-type';
const ELIGIBILITY_ERROR_SYSTEM = 'http://nphies.sa/CodeSystem/eligibility-error';

interface PersistedBenefitDetail {
  serviceCategory?:        string;
  serviceCategoryDisplay?: string;
  covered?:                boolean;
  copay?:                  number;
  coinsurance?:            number;
  deductible?:             number;
  maxBenefit?:             number;
  usedBenefit?:            number;
  remainingBenefit?:       number;
  authorizationRequired?:  boolean;
  excluded?:               boolean;
  notes?:                  string;
}

interface PersistedEligibilityResponse {
  status?:         string;
  eligible?:       boolean;
  coverageActive?: boolean;
  disposition?:    string;
  serviceDate?:    string;
  benefitPeriod?:  { start?: string; end?: string };
  benefits?:       PersistedBenefitDetail[];
  errors?:         string[];
  errorsAr?:       string[];
}

function categoryConcept(code: string, display?: string): FhirCodeableConcept {
  return { coding: [{ system: SERVICE_CATEGORY_SYSTEM, code, display }] };
}

function benefitTypeConcept(code: string, display: string): FhirCodeableConcept {
  return { coding: [{ system: BENEFIT_TYPE_SYSTEM, code, display }] };
}

function moneyOrUndef(v: number | undefined): { value: number; currency: string } | undefined {
  return v !== undefined && v !== null && Number.isFinite(v)
    ? { value: v, currency: 'SAR' }
    : undefined;
}

export function serializeCoverageEligibilityResponse(
  log: NphiesEligibilityLog,
  _tenantId: string,
): FhirCoverageEligibilityResponse {
  const persisted = (log.response ?? null) as PersistedEligibilityResponse | null;

  // FHIR outcome from log.eligible + log.status. NPHIES status values are
  // 'eligible' | 'ineligible' | 'pending' | 'error' (EligibilityStatus).
  const statusStr = String(log.status ?? '').toLowerCase();
  const outcome: FhirCoverageEligibilityResponse['outcome'] =
    statusStr === 'error'   ? 'error'
    : statusStr === 'pending' ? 'queued'
    : 'complete';   // eligible | ineligible both yield a complete decision

  const disposition =
    persisted?.disposition
    ?? (log.eligible ? 'Eligible' : statusStr ? statusStr.charAt(0).toUpperCase() + statusStr.slice(1) : undefined);

  // ── insurance[].item[] from the persisted benefits array ────────────────────
  const benefits = Array.isArray(persisted?.benefits) ? persisted!.benefits : [];

  const items: NonNullable<NonNullable<FhirCoverageEligibilityResponse['insurance']>[number]['item']> =
    benefits.map((b) => {
      const benefitArr: NonNullable<NonNullable<NonNullable<FhirCoverageEligibilityResponse['insurance']>[number]['item']>[number]['benefit']> = [];
      const copayMoney      = moneyOrUndef(b.copay);
      const deductibleMoney = moneyOrUndef(b.deductible);
      const maxMoney        = moneyOrUndef(b.maxBenefit);
      const usedMoney       = moneyOrUndef(b.usedBenefit);
      if (copayMoney) {
        benefitArr.push({ type: benefitTypeConcept('copay', 'Copay'), allowedMoney: copayMoney });
      }
      if (b.coinsurance !== undefined && b.coinsurance !== null && Number.isFinite(b.coinsurance)) {
        benefitArr.push({
          type: benefitTypeConcept('coinsurance', 'Coinsurance'),
          allowedUnsignedInt: b.coinsurance,
        });
      }
      if (deductibleMoney) {
        benefitArr.push({ type: benefitTypeConcept('deductible', 'Deductible'), allowedMoney: deductibleMoney });
      }
      if (maxMoney || usedMoney) {
        benefitArr.push({
          type:         benefitTypeConcept('benefit', 'Benefit'),
          allowedMoney: maxMoney,
          usedMoney,
        });
      }

      return {
        category: b.serviceCategory
          ? categoryConcept(b.serviceCategory, b.serviceCategoryDisplay)
          : undefined,
        name:                  b.serviceCategoryDisplay,
        description:           b.notes,
        benefit:               benefitArr.length > 0 ? benefitArr : undefined,
        authorizationRequired: b.authorizationRequired ?? false,
      };
    });

  const benefitPeriod = persisted?.benefitPeriod
    ? { start: persisted.benefitPeriod.start, end: persisted.benefitPeriod.end }
    : undefined;

  const insurance: FhirCoverageEligibilityResponse['insurance'] =
    outcome === 'complete' || items.length > 0
      ? [{
          coverage:      { reference: `Coverage/${log.insuranceId}`, type: 'Coverage' },
          inforce:       persisted?.coverageActive ?? log.eligible,
          benefitPeriod,
          item:          items.length > 0 ? items : undefined,
        }]
      : undefined;

  // ── error[] from the persisted errors array ────────────────────────────────
  const errors = Array.isArray(persisted?.errors) ? persisted!.errors : [];
  const errorsAr = Array.isArray(persisted?.errorsAr) ? persisted!.errorsAr : [];
  const errorBlock: FhirCoverageEligibilityResponse['error'] =
    errors.length > 0
      ? errors.map((msg, idx) => ({
          code: {
            coding: [{ system: ELIGIBILITY_ERROR_SYSTEM, code: 'eligibility-error', display: msg }],
            text:   errorsAr[idx] ?? msg,
          },
        }))
      : undefined;

  const servicedDate = persisted?.serviceDate
    ?? log.createdAt.toISOString().slice(0, 10);

  return {
    resourceType: 'CoverageEligibilityResponse',
    id: log.id,
    meta: {
      lastUpdated: log.createdAt.toISOString(),
      profile:     [NPHIES_PROFILES.COVERAGE_ELIGIBILITY_RESPONSE],
    },
    status:  'active',
    purpose: ['benefits', 'validation'],
    patient: { reference: `Patient/${log.patientId}`, type: 'Patient' },
    servicedDate,
    created: log.createdAt.toISOString(),
    requestor: log.createdBy
      ? { reference: `Practitioner/${log.createdBy}`, type: 'Practitioner' }
      : undefined,
    request: {
      reference: `CoverageEligibilityRequest/${log.id}`,
      type:      'CoverageEligibilityRequest',
    },
    outcome,
    disposition,
    insurer: { reference: `Organization/${log.insuranceId}`, type: 'Organization' },
    insurance,
    error:   errorBlock,
  };
}
