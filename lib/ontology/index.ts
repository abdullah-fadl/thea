// Phase 5.3 — Ontology public API barrel

export { ONTOLOGY_GLOBAL_TENANT_ID, ONTOLOGY_SYSTEMS } from './constants';
export type { OntologySystem } from './constants';

export { OntologyDisabled, OntologyNotFound } from './errors';

export {
  findConceptByCode,
  findConceptsByDisplay,
  getMappingsForEntity,
} from './lookup';
export type { OntologyConcept, OntologyMapping as OntologyMappingRecord } from './lookup';

export { mapEntityToConcept, unmapEntityFromConcept } from './mapping';
export type { MapEntityToConceptArgs, UnmapEntityFromConceptArgs } from './mapping';

// Phase 7.3 — lazy concept upsert + entity-specific wiring helpers.
export { ensureConcept } from './lazyUpsert';
export type { EnsureConceptArgs } from './lazyUpsert';

export {
  FORMULARY_DRUG_ENTITY_TYPE,
  FORMULARY_DRUG_RXNORM_SYSTEM,
  mapFormularyDrugToRxNorm,
  findRxNormConceptForDrug,
  DIAGNOSIS_CATALOG_ENTITY_TYPE,
  DIAGNOSIS_CATALOG_ICD10_SYSTEM,
  mapDiagnosisCatalogToIcd10,
  findIcd10ConceptForDiagnosis,
} from './wiring';
export type { MapFormularyDrugResult, MapDiagnosisCatalogResult } from './wiring';
