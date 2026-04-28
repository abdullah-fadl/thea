// =============================================================================
// Phase 5.3 — Ontology constants
// =============================================================================

/**
 * Sentinel tenantId used for globally-shared concepts (e.g. concepts loaded
 * from licensed SNOMED / LOINC / ICD-10-AM / RxNorm datasets).
 * Global concepts are visible to all tenants via findConceptByCode() regardless
 * of the caller's tenantId.
 */
export const ONTOLOGY_GLOBAL_TENANT_ID = '00000000-0000-0000-0000-000000000000';

export type OntologySystem = 'SNOMED_CT' | 'LOINC' | 'ICD_10_AM' | 'RXNORM';

export const ONTOLOGY_SYSTEMS: readonly OntologySystem[] = [
  'SNOMED_CT',
  'LOINC',
  'ICD_10_AM',
  'RXNORM',
] as const;
