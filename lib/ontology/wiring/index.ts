// Phase 7.3 — Ontology wiring barrel.
// One file per Thea entity type that bridges to an external code system.

export {
  FORMULARY_DRUG_ENTITY_TYPE,
  FORMULARY_DRUG_RXNORM_SYSTEM,
  mapFormularyDrugToRxNorm,
  findRxNormConceptForDrug,
  type MapFormularyDrugResult,
} from './formularyDrug';

export {
  DIAGNOSIS_CATALOG_ENTITY_TYPE,
  DIAGNOSIS_CATALOG_ICD10_SYSTEM,
  mapDiagnosisCatalogToIcd10,
  findIcd10ConceptForDiagnosis,
  type MapDiagnosisCatalogResult,
} from './diagnosisCatalog';
