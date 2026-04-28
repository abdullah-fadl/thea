// Phase 8.1.1 — FHIR R4 Claim serializer (NPHIES financial foundation)
// Async pure function: BillingClaim (Prisma) → FhirClaim
//
// Discovery: BillingClaim is the canonical FHIR Claim source — it carries
// the local domain claim with claimNumber, encounter ref, patient snapshot,
// provider context, totals, breakdown, line items, and payer context.
// NphiesClaim is the *response* side (adjudication outcome) — that's the
// canonical ClaimResponse source, not the request.
//
// Per-line ontology enrichment: when the line item came from a recognized
// origin we attempt RxNorm enrichment (medication-kind orders) via
// findRxNormConceptForDrug. Diagnosis-level ICD-10 enrichment runs once for
// the encounter via findIcd10ConceptForDiagnosis. Both are best-effort —
// any miss leaves the FHIR resource without that coding, never throws,
// never blocks the read.
import type { BillingClaim } from '@prisma/client';
import type {
  FhirClaim,
  FhirCodeableConcept,
  FhirCoding,
  FhirReference,
} from '../resources/types';
import { prisma } from '@/lib/db/prisma';
import { findRxNormConceptForDrug } from '@/lib/ontology/wiring/formularyDrug';
import { findIcd10ConceptForDiagnosis } from '@/lib/ontology/wiring/diagnosisCatalog';
import { NPHIES_PROFILES } from '../nphies-profiles';

const THEA_SYSTEM       = 'https://thea.com.sa/fhir';
const RXNORM_SYSTEM     = 'http://www.nlm.nih.gov/research/umls/rxnorm';
const ICD10_SYSTEM      = 'http://hl7.org/fhir/sid/icd-10-am';
const CLAIM_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/claim-type';
const PRIORITY_SYSTEM   = 'http://terminology.hl7.org/CodeSystem/processpriority';
const PAYEE_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/payeetype';

// ── BillingClaim Json shapes (denormalized from buildClaimDraft) ─────────────
interface PatientSnapshot {
  id?:          string;
  name?:        string;
  identifiers?: unknown;
  dob?:         string | null;
  gender?:      string | null;
}
interface ProviderSnapshot {
  department?:    string;
  encounterType?: string;
}
interface ClaimLineItem {
  chargeEventId?: string;
  code?:          string;
  name?:          string;
  department?:    string | null;
  unitType?:      string;
  qty?:           number | string;
  unitPrice?:     number | string;
  total?:         number | string;
  origin?: {
    orderId?:    string | null;
    orderCode?:  string | null;
    kind?:       string | null;
  };
}
interface PayerContextSnapshot {
  mode?:                 'CASH' | 'INSURANCE' | string;
  insuranceCompanyId?:   string;
  insuranceCompanyName?: string;
  memberOrPolicyRef?:    string;
}

function num(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function typeConcept(code: string, display: string): FhirCodeableConcept {
  return { coding: [{ system: CLAIM_TYPE_SYSTEM, code, display }] };
}

export async function serializeClaim(
  c: BillingClaim,
  tenantId: string,
): Promise<FhirClaim> {
  const patient   = (c.patient   as PatientSnapshot  | null) ?? null;
  const provider  = (c.provider  as ProviderSnapshot | null) ?? null;
  const totals    = (c.totals    as { grandTotalActive?: number | string } | null) ?? null;
  const lineItems = (Array.isArray(c.lineItems) ? c.lineItems : []) as ClaimLineItem[];
  const payerCtx  = (c.payerContext as PayerContextSnapshot | null) ?? null;

  const isInstitutional = String(provider?.encounterType ?? '').toUpperCase() === 'IPD';

  // ── Diagnosis: best-effort tenant-scoped ICD-10-AM enrichment ──────────────
  // BillingClaim doesn't carry an explicit diagnosis list — we resolve via the
  // encounter's primary diagnosis row (DiagnosisCatalog) when available.
  const diagnosisCodings: FhirCoding[] = [];
  const enc = await prisma.encounterCore.findFirst({
    where:  { tenantId, id: c.encounterCoreId },
    select: { id: true, department: true },
  });
  if (enc) {
    // PatientProblem is the per-encounter diagnosis surface in Thea. The
    // serializer pulls the most recent active problem for the patient and
    // enriches via the Phase 7.3 wiring layer.
    const dxProblem = patient?.id
      ? await prisma.patientProblem.findFirst({
          where:   { tenantId, patientId: patient.id, status: 'active' },
          orderBy: { createdAt: 'desc' },
          select:  { code: true, icdCode: true, problemName: true },
        })
      : null;
    if (dxProblem?.icdCode) {
      diagnosisCodings.push({
        system:  ICD10_SYSTEM,
        code:    dxProblem.icdCode,
        display: dxProblem.problemName,
      });
    }
    if (dxProblem?.code) {
      const dx = await prisma.diagnosisCatalog.findFirst({
        where:  { tenantId, code: dxProblem.code },
        select: { id: true },
      });
      if (dx) {
        const concept = await findIcd10ConceptForDiagnosis(dx.id);
        if (concept) {
          const dup = diagnosisCodings.some(
            (d) => d.system === ICD10_SYSTEM && d.code === concept.code,
          );
          if (!dup) {
            diagnosisCodings.push({
              system:  ICD10_SYSTEM,
              code:    concept.code,
              display: concept.display ?? dxProblem.problemName,
            });
          }
        }
      }
    }
  }

  // ── Items: per-line code mapping (+ best-effort RxNorm for medication kind)
  const items: NonNullable<FhirClaim['item']> = [];
  for (let i = 0; i < lineItems.length; i++) {
    const li = lineItems[i];
    const codings: FhirCoding[] = [];
    if (li.code) {
      codings.push({
        system:  `${THEA_SYSTEM}/charge`,
        code:    li.code,
        display: li.name,
      });
    }
    // Medication-kind line items: try RxNorm via the FormularyDrug wiring.
    // Match by drug name (li.name); silent on miss.
    if (String(li.origin?.kind ?? '').toUpperCase() === 'MEDICATION' && li.name) {
      const drug = await prisma.formularyDrug.findFirst({
        where:  { tenantId, genericName: { equals: li.name, mode: 'insensitive' } },
        select: { id: true },
      });
      if (drug) {
        const concept = await findRxNormConceptForDrug(drug.id);
        if (concept) {
          codings.push({
            system:  RXNORM_SYSTEM,
            code:    concept.code,
            display: concept.display ?? li.name,
          });
        }
      }
    }
    const qty       = num(li.qty);
    const unitPrice = num(li.unitPrice);
    const total     = num(li.total);
    items.push({
      sequence: i + 1,
      productOrService: {
        coding: codings.length > 0 ? codings : undefined,
        text:   li.name,
      },
      quantity:  qty       !== undefined ? { value: qty } : undefined,
      unitPrice: unitPrice !== undefined ? { value: unitPrice, currency: 'SAR' } : undefined,
      net:       total     !== undefined ? { value: total,     currency: 'SAR' } : undefined,
    });
  }

  // ── Insurance: link to the canonical PatientInsurance Coverage when present
  const insurance: FhirClaim['insurance'] = [];
  if (payerCtx?.insuranceCompanyId || payerCtx?.memberOrPolicyRef) {
    const cov = patient?.id
      ? await prisma.patientInsurance.findFirst({
          where:   { tenantId, patientId: patient.id, isPrimary: true },
          orderBy: { updatedAt: 'desc' },
          select:  { id: true },
        })
      : null;
    insurance.push({
      sequence: 1,
      focal:    true,
      coverage: cov
        ? { reference: `Coverage/${cov.id}`, type: 'Coverage' }
        : { display: payerCtx.insuranceCompanyName ?? payerCtx.memberOrPolicyRef ?? 'Coverage' },
    });
  } else {
    // FHIR Claim.insurance is required (cardinality 1..*); supply a placeholder
    // self-pay entry when no payer context exists.
    insurance.push({
      sequence: 1,
      focal:    true,
      coverage: { display: 'self-pay' },
    });
  }

  const grandTotal = num(totals?.grandTotalActive);

  const providerRef: FhirReference = {
    reference: `Organization/${tenantId}`,
    type:      'Organization',
    display:   provider?.department ?? undefined,
  };

  return {
    resourceType: 'Claim',
    id: c.id,
    meta: {
      lastUpdated: c.createdAt.toISOString(),
      profile:     [NPHIES_PROFILES.CLAIM],
    },
    identifier: [{ system: `${THEA_SYSTEM}/claim-number`, value: c.claimNumber }],
    status: 'active',
    type:    typeConcept(isInstitutional ? 'institutional' : 'professional',
                         isInstitutional ? 'Institutional' : 'Professional'),
    use:     'claim',
    patient: patient?.id
      ? { reference: `Patient/${patient.id}`, type: 'Patient', display: patient.name ?? undefined }
      : { reference: 'Patient/unknown',        type: 'Patient' },
    created: c.createdAt.toISOString(),
    provider: providerRef,
    priority: { coding: [{ system: PRIORITY_SYSTEM, code: 'normal', display: 'Normal' }] },
    payee: {
      type:  { coding: [{ system: PAYEE_TYPE_SYSTEM, code: 'provider', display: 'Provider' }] },
      party: providerRef,
    },
    diagnosis: diagnosisCodings.length > 0
      ? [{
          sequence: 1,
          diagnosisCodeableConcept: { coding: diagnosisCodings },
        }]
      : undefined,
    insurance,
    item:   items.length > 0 ? items : undefined,
    total:  grandTotal !== undefined ? { value: grandTotal, currency: 'SAR' } : undefined,
  };
}
