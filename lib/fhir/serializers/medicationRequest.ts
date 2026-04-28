// Phase 7.7 — FHIR R4 MedicationRequest serializer
// Async pure function: PharmacyPrescription (Prisma) → FhirMedicationRequest
// Attaches RxNorm coding when FF_ONTOLOGY_ENABLED is ON, the prescription's
// genericName resolves to a FormularyDrug row in the tenant, and that drug has
// an OntologyMapping to RxNorm via the Phase 7.3 wiring layer.
//
// Discovery: PharmacyPrescription chosen as the canonical FHIR MedicationRequest
// source because it carries the full prescribe → verify → dispense workflow
// (status, prescriber, encounter, dosage instructions, refills, audit timestamps).
// HomeMedication is patient-reported (closer to FHIR MedicationStatement);
// DischargePrescription is an encounter-bound subset.
import type { PharmacyPrescription } from '@prisma/client';
import type { FhirMedicationRequest, FhirCoding } from '../resources/types';
import { prisma } from '@/lib/db/prisma';
import { findRxNormConceptForDrug } from '@/lib/ontology/wiring/formularyDrug';

const THEA_SYSTEM = 'https://thea.com.sa/fhir';
const RXNORM_SYSTEM = 'http://www.nlm.nih.gov/research/umls/rxnorm';

const STATUS_MAP: Record<string, FhirMedicationRequest['status']> = {
  PENDING:   'draft',
  VERIFIED:  'active',
  DISPENSED: 'completed',
  PICKED_UP: 'completed',
  CANCELLED: 'cancelled',
};

export async function serializeMedicationRequest(
  rx: PharmacyPrescription,
  tenantId: string,
): Promise<FhirMedicationRequest> {
  const coding: FhirCoding[] = [];

  if (rx.medication || rx.genericName) {
    coding.push({
      system:  `${THEA_SYSTEM}/medication`,
      code:    rx.genericName ?? rx.medication ?? undefined,
      display: rx.medication ?? rx.genericName ?? undefined,
    });

    // Best-effort RxNorm enrichment via the Phase 7.3 wiring layer.
    // Resolve the prescription's free-text genericName to a FormularyDrug row
    // in this tenant, then look up its RxNorm OntologyConcept. Any miss
    // (no formulary match, ontology flag off, no mapping) leaves the FHIR
    // coding without a RxNorm entry — never throws, never blocks the read.
    const lookupName = rx.genericName ?? rx.medication;
    if (lookupName) {
      const drug = await prisma.formularyDrug.findFirst({
        where:  { tenantId, genericName: { equals: lookupName, mode: 'insensitive' } },
        select: { id: true },
      });
      if (drug) {
        const concept = await findRxNormConceptForDrug(drug.id);
        if (concept) {
          coding.push({
            system:  RXNORM_SYSTEM,
            code:    concept.code,
            display: concept.display ?? undefined,
          });
        }
      }
    }
  }

  return {
    resourceType: 'MedicationRequest',
    id: rx.id,
    meta: {
      lastUpdated: rx.updatedAt.toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/MedicationRequest'],
    },
    status: STATUS_MAP[rx.status] ?? 'unknown',
    intent: 'order',
    medicationCodeableConcept: {
      coding: coding.length > 0 ? coding : undefined,
      text:   rx.medication ?? rx.genericName ?? undefined,
    },
    subject: rx.patientId
      ? { reference: `Patient/${rx.patientId}`, type: 'Patient' }
      : { reference: 'Patient/unknown', type: 'Patient' },
    encounter: rx.encounterId
      ? { reference: `Encounter/${rx.encounterId}`, type: 'Encounter' }
      : undefined,
    authoredOn: rx.prescribedAt?.toISOString(),
    requester: rx.doctorId
      ? { reference: `Practitioner/${rx.doctorId}`, type: 'Practitioner', display: rx.doctorName ?? undefined }
      : undefined,
    dosageInstruction: (rx.instructions || rx.frequency || rx.route)
      ? [{
          text:  rx.instructions ?? undefined,
          route: rx.route ? { text: rx.route } : undefined,
        }]
      : undefined,
    note: rx.pharmacistNotes
      ? [{ text: rx.pharmacistNotes }]
      : undefined,
  };
}
