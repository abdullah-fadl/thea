// =============================================================================
// Phase 5.3 — Ontology typed errors
// =============================================================================

export class OntologyDisabled extends Error {
  constructor() {
    super('FF_ONTOLOGY_ENABLED is OFF — ontology operations are disabled');
    this.name = 'OntologyDisabled';
  }
}

export class OntologyNotFound extends Error {
  constructor(detail: string) {
    super(`Ontology entity not found: ${detail}`);
    this.name = 'OntologyNotFound';
  }
}
