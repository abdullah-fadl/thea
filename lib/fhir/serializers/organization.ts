// Phase 8.1.3 — FHIR R4 Organization serializer (NPHIES supporting actor)
// Sync pure function: Hospital | BillingPayer → FhirOrganization.
//
// Discovery: NPHIES uses a single Organization resource for two roles —
// the *facility* (a hospital / clinic delivering care) and the *insurance
// company* (a payer). Thea has these split across Hospital (core.prisma)
// and BillingPayer (billing.prisma). The serializer accepts a tagged
// union and discriminates on `kind` to pick:
//   - the right `type` CodeableConcept (`prov` for facility, `pay` for payer)
//   - the right identifier system + display name shape
//
// Both flavors stamp `meta.profile = [NPHIES_PROFILES.ORGANIZATION]`.
import type { Hospital, BillingPayer } from '@prisma/client';
import type { FhirOrganization, FhirIdentifier } from '../resources/types';
import { NPHIES_PROFILES } from '../nphies-profiles';

const ORG_TYPE_SYSTEM      = 'http://terminology.hl7.org/CodeSystem/organization-type';
const HOSPITAL_CODE_SYSTEM = 'https://thea.com.sa/fhir/hospital-code';
const PAYER_CODE_SYSTEM    = 'http://nphies.sa/identifier/payer-license';

export type OrganizationInput =
  | { kind: 'facility'; row: Hospital }
  | { kind: 'payer';    row: BillingPayer };

export function serializeOrganization(
  input: OrganizationInput,
  _tenantId: string,
): FhirOrganization {
  if (input.kind === 'facility') {
    const h = input.row;
    const identifier: FhirIdentifier[] = [];
    if (h.code) {
      identifier.push({ use: 'official', system: HOSPITAL_CODE_SYSTEM, value: h.code });
    }
    return {
      resourceType: 'Organization',
      id: h.id,
      meta: {
        lastUpdated: h.updatedAt.toISOString(),
        profile:     [NPHIES_PROFILES.ORGANIZATION],
      },
      identifier: identifier.length > 0 ? identifier : undefined,
      active: h.isActive,
      type: [{
        coding: [{ system: ORG_TYPE_SYSTEM, code: 'prov', display: 'Healthcare Provider' }],
      }],
      name: h.name,
    };
  }

  // payer
  const p = input.row;
  return {
    resourceType: 'Organization',
    id: p.id,
    meta: {
      lastUpdated: p.updatedAt.toISOString(),
      profile:     [NPHIES_PROFILES.ORGANIZATION],
    },
    identifier: [{ use: 'official', system: PAYER_CODE_SYSTEM, value: p.code }],
    active: p.status === 'ACTIVE',
    type: [{
      coding: [{ system: ORG_TYPE_SYSTEM, code: 'pay', display: 'Payer' }],
    }],
    name: p.name,
  };
}
