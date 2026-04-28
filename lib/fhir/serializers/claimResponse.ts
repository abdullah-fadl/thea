// Phase 8.1.1 — FHIR R4 ClaimResponse serializer (NPHIES financial foundation)
// Sync pure function: NphiesClaim (Prisma) → FhirClaimResponse
//
// Discovery: NphiesClaim is the canonical FHIR ClaimResponse source. Every
// adjudication field FHIR ClaimResponse needs is already on the row:
//   status, accepted (→ outcome), adjudicatedAmount/payerAmount/
//   patientResponsibility (→ total[] + item.adjudication[]),
//   denialReason/denialReasonAr (→ disposition + error[]),
//   nphiesClaimReference (→ identifier),
//   originalClaimReference (→ request).
//
// Sync: no ontology enrichment is needed — the response speaks money, not
// codes — so no DB calls beyond the route's tenant-scoped read.
import type { NphiesClaim } from '@prisma/client';
import type {
  FhirClaimResponse,
  FhirCodeableConcept,
} from '../resources/types';
import { NPHIES_PROFILES } from '../nphies-profiles';

const NPHIES_SYSTEM           = 'http://nphies.sa/fhir';
const CLAIM_TYPE_SYSTEM       = 'http://terminology.hl7.org/CodeSystem/claim-type';
const ADJUDICATION_SYSTEM     = 'http://terminology.hl7.org/CodeSystem/adjudication';
const PAYMENT_TYPE_SYSTEM     = 'http://terminology.hl7.org/CodeSystem/ex-paymenttype';
const ADJUDICATION_REASON_SYS = 'http://terminology.hl7.org/CodeSystem/adjudication-reason';

const STATUS_MAP: Record<string, FhirClaimResponse['status']> = {
  draft:     'draft',
  active:    'active',
  cancelled: 'cancelled',
  error:     'entered-in-error',
};

function adjConcept(code: string, display: string): FhirCodeableConcept {
  return { coding: [{ system: ADJUDICATION_SYSTEM, code, display }] };
}

export function serializeClaimResponse(
  cr: NphiesClaim,
  _tenantId: string,
): FhirClaimResponse {
  // Outcome is derived from the accepted flag + denialReason. NPHIES uses
  // accepted=true|false; FHIR uses queued|complete|error|partial.
  const outcome: FhirClaimResponse['outcome'] = cr.denialReason
    ? 'error'
    : cr.accepted
      ? 'complete'
      : 'queued';

  const adjudicatedAmount     = cr.adjudicatedAmount     ? Number(cr.adjudicatedAmount)     : undefined;
  const payerAmount           = cr.payerAmount           ? Number(cr.payerAmount)           : undefined;
  const patientResponsibility = cr.patientResponsibility ? Number(cr.patientResponsibility) : undefined;

  const total: NonNullable<FhirClaimResponse['total']> = [];
  if (adjudicatedAmount !== undefined) {
    total.push({
      category: adjConcept('submitted', 'Submitted Amount'),
      amount:   { value: adjudicatedAmount, currency: 'SAR' },
    });
  }
  if (payerAmount !== undefined) {
    total.push({
      category: adjConcept('benefit', 'Benefit Amount'),
      amount:   { value: payerAmount, currency: 'SAR' },
    });
  }
  if (patientResponsibility !== undefined) {
    total.push({
      category: adjConcept('copay', 'CoPay'),
      amount:   { value: patientResponsibility, currency: 'SAR' },
    });
  }

  // Single aggregated item.adjudication block — NphiesClaim doesn't store
  // per-line breakdown, so we expose totals at the resource and an aggregated
  // adjudication entry referencing item sequence 1.
  const item: NonNullable<FhirClaimResponse['item']> =
    total.length > 0
      ? [{
          itemSequence: 1,
          adjudication: total.map((t) => ({
            category: t.category,
            amount:   t.amount,
            value:    t.amount.value,
          })),
        }]
      : [];

  return {
    resourceType: 'ClaimResponse',
    id: cr.id,
    meta: {
      lastUpdated: cr.createdAt.toISOString(),
      profile:     [NPHIES_PROFILES.CLAIM_RESPONSE],
    },
    identifier: cr.nphiesClaimReference
      ? [{ system: `${NPHIES_SYSTEM}/claim-reference`, value: cr.nphiesClaimReference }]
      : undefined,
    status:  STATUS_MAP[cr.status] ?? 'active',
    type:    { coding: [{ system: CLAIM_TYPE_SYSTEM, code: 'professional', display: 'Professional' }] },
    use:     'claim',
    patient: { reference: `Patient/${cr.patientId}`, type: 'Patient' },
    created: cr.createdAt.toISOString(),
    insurer: { reference: `Organization/${cr.insuranceId}`, type: 'Organization' },
    request: cr.originalClaimReference
      ? { reference: `Claim/${cr.originalClaimReference}`, type: 'Claim' }
      : undefined,
    outcome,
    disposition: cr.denialReason ?? (cr.accepted ? 'Approved' : undefined),
    item:    item.length > 0 ? item : undefined,
    total:   total.length > 0 ? total : undefined,
    payment: payerAmount !== undefined && cr.accepted
      ? {
          type:   { coding: [{ system: PAYMENT_TYPE_SYSTEM, code: 'complete', display: 'Complete' }] },
          amount: { value: payerAmount, currency: 'SAR' },
        }
      : undefined,
    error: cr.denialReason
      ? [{
          itemSequence: 1,
          code: {
            coding: [{
              system:  ADJUDICATION_REASON_SYS,
              code:    'denied',
              display: cr.denialReason,
            }],
            text: cr.denialReasonAr ?? cr.denialReason,
          },
        }]
      : undefined,
  };
}

