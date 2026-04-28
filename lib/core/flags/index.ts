// Platform-wide feature flags. Each flag maps to an env var.
// Convention: THEA_FF_<FLAG_NAME>=true|false
// All flags default to false (safe off) unless explicitly enabled.
// See docs/DISASTER_RECOVERY.md and master-plan.md §Phase 0.2 for context.

export const FLAGS = {
  // Phase 1
  FF_PORTAL_SLUG_ROUTING:   'THEA_FF_PORTAL_SLUG_ROUTING',
  // Phase 2
  FF_HOSPITAL_ENTITLEMENT:  'THEA_FF_HOSPITAL_ENTITLEMENT',
  FF_TENANT_OWNER_ROLE:     'THEA_FF_TENANT_OWNER_ROLE',
  FF_HOSPITAL_SCOPED_GUARD: 'THEA_FF_HOSPITAL_SCOPED_GUARD',
  // Phase 3
  FF_ORG_DEPT_UNIFIED:           'THEA_FF_ORG_DEPT_UNIFIED',
  FF_ORG_UNIT_UNIFIED:           'THEA_FF_ORG_UNIT_UNIFIED',
  // Phase 3.1 — Department unification infrastructure (both default OFF)
  FF_DEPARTMENT_DUAL_WRITE:            'THEA_FF_DEPARTMENT_DUAL_WRITE',
  FF_DEPARTMENT_UNIFIED_READ_SHADOW:   'THEA_FF_DEPARTMENT_UNIFIED_READ_SHADOW',
  // Phase 3.2 — Unit unification infrastructure (both default OFF)
  FF_UNIT_DUAL_WRITE:                  'THEA_FF_UNIT_DUAL_WRITE',
  FF_UNIT_UNIFIED_READ_SHADOW:         'THEA_FF_UNIT_UNIFIED_READ_SHADOW',
  // Phase 3.3 — Staff identity FK enforcement (default OFF — see NOTES.md §Phase 3.3 runbook)
  FF_STAFF_FK_ENFORCED:                'THEA_FF_STAFF_FK_ENFORCED',
  FF_STAFF_IDENTITY_FK:     'THEA_FF_STAFF_IDENTITY_FK',
  FF_AUDIT_LOG_UNIFIED:     'THEA_FF_AUDIT_LOG_UNIFIED',
  // Phase 3.4 — AuditLog unification infrastructure (both default OFF)
  FF_AUDITLOG_DUAL_WRITE:              'THEA_FF_AUDITLOG_DUAL_WRITE',
  FF_AUDITLOG_UNIFIED_READ_SHADOW:     'THEA_FF_AUDITLOG_UNIFIED_READ_SHADOW',
  // Phase 4
  FF_EXTENSION_CONTRACT:    'THEA_FF_EXTENSION_CONTRACT',
  // Phase 4.2 — Event bus (LISTEN/NOTIFY + events table). Default OFF.
  // When OFF, emit() is a no-op. Subscribers are registered in memory but never dispatched.
  FF_EVENT_BUS_ENABLED:     'THEA_FF_EVENT_BUS_ENABLED',
  // Phase 4.3 — Cedar declarative authorization engine. Both default OFF.
  // FF_CEDAR_SHADOW_EVAL: Cedar evaluates in parallel with legacy checks and logs any disagreements.
  //   Cedar decision is NEVER returned to the caller — legacy decision always wins.
  // FF_CEDAR_AUTHORITATIVE: Cedar becomes the decision source (flip only after shadow-eval shows
  //   zero disagreements over a monitoring period). NOT flipped in Phase 4.3.
  FF_CEDAR_SHADOW_EVAL:     'THEA_FF_CEDAR_SHADOW_EVAL',
  FF_CEDAR_AUTHORITATIVE:   'THEA_FF_CEDAR_AUTHORITATIVE',
  // Phase 5.1 — Event sourcing projection layer. Default OFF.
  // When OFF: registerProjection() is a no-op, getProjectionState() / rebuildProjection() throw
  //   ProjectionsDisabled, listProjections() returns []. Zero behavioral change to existing code.
  // When ON: projections are registered, rebuild scans the events table, snapshots are written.
  //   Apply the 20260424000007_projection_tables migration before enabling.
  FF_EVENT_PROJECTIONS_ENABLED: 'THEA_FF_EVENT_PROJECTIONS_ENABLED',
  // Phase 5.2 — pgvector semantic embeddings. Default OFF.
  // When OFF: getDefaultProvider() returns EmbeddingsDisabled (no-op), zero OpenAI calls, zero
  //   embedding writes. When ON: embedCoreDepartment() calls OpenAI text-embedding-3-large and
  //   stores the resulting vector in core_departments.embedding.
  //   Requires: OPENAI_API_KEY set + migration 20260424000008_pgvector_embeddings applied.
  FF_EMBEDDINGS_ENABLED: 'THEA_FF_EMBEDDINGS_ENABLED',
  // Phase 5.3 — Clinical ontology mapping layer. Default OFF.
  // When OFF: findConceptByCode() / findConceptsByDisplay() / getMappingsForEntity() return
  //   null / [] immediately; mapEntityToConcept() / unmapEntityFromConcept() throw
  //   OntologyDisabled. Zero DB reads or writes; zero behavioral change to existing code.
  // When ON: OntologyCodeSystem, OntologyConcept, OntologyMapping tables are live.
  //   Apply migration 20260424000009_clinical_ontology before enabling.
  //   Seed OntologyCodeSystem rows via scripts/import-ontology.ts before lookups work.
  //   Licensed datasets (SNOMED CT, LOINC, ICD-10-AM, RxNorm) must be imported separately.
  //   Phase 7.3 reuses this flag for the FormularyDrug.rxNorm + DiagnosisCatalog.icd10 wiring
  //   helpers + backfill scripts (lib/ontology/lazyUpsert.ts, lib/ontology/wiring/*).
  FF_ONTOLOGY_ENABLED: 'THEA_FF_ONTOLOGY_ENABLED',
  // Phase 5.4 — FHIR R4 read-only API. Default OFF.
  // When OFF: all GET /api/fhir/* routes return HTTP 404 OperationOutcome immediately.
  //   No DB reads. Zero behavioral change to existing clinical workflows.
  // When ON: read-only FHIR R4 endpoints are live. Requires permission fhir.patient.read.
  //   Writes (POST/PUT) are NOT enabled in this phase — see Phase 5.5 for write support.
  //   Phase 5.4 shipped Patient/Encounter/Observation; Phase 7.7 extends with
  //   MedicationRequest/AllergyIntolerance/Condition (still read-only, same flag).
  FF_FHIR_API_ENABLED: 'THEA_FF_FHIR_API_ENABLED',
  // Phase 6.1 — Arabic-native NLP stack. Default OFF.
  // When OFF: normalizeArabic() returns lowercase+trim only, matchMedicalPhrases() returns [],
  //   expandSearchTerms() returns [query] only. Zero behavioral change to existing search/forms.
  // When ON: full Arabic text normalization (diacritics, tatweel, alef unification, taa-marbuta,
  //   digit conversion), Saudi-dialect medical phrase matching via curated lexicon, and bilingual
  //   search term expansion. No external NLP service required — local lexicon only.
  FF_ARABIC_NLP_ENABLED: 'THEA_FF_ARABIC_NLP_ENABLED',
  // Phase 6.2 — AI agents framework. Default OFF.
  // When OFF: registry is empty, tool calls throw AgentsDisabled, POST /api/agents/*/run returns 404.
  //   Zero Anthropic SDK loads, zero DB writes to agent_* tables.
  // When ON: registerAgent() / registerTool() populate in-memory registries; runAgent() creates
  //   AgentRun rows, evaluates Cedar shadow policy, emits events, writes AgentToolCall rows.
  //   Requires: ANTHROPIC_API_KEY set + migration 20260424000009_ai_agents applied.
  FF_AI_AGENTS_ENABLED: 'THEA_FF_AI_AGENTS_ENABLED',
  // Phase 6.3 — Outcome metrics framework. Default OFF.
  // When OFF: registerOutcome() is a no-op, listOutcomes() returns [], computeOutcome() throws
  //   OutcomeMetricsDisabled, GET /api/outcomes/* returns 404. Zero DB activity.
  // When ON: registerOutcome() populates in-memory registry; computeOutcome() reads events table
  //   and upserts OutcomeMeasurement rows; getMeasurements() queries stored rows for dashboards.
  //   Outcome formulas are declarative JSON specs referencing event names from Phase 4.2.
  //   Requires: migration 20260424000010_outcome_metrics applied before enabling.
  FF_OUTCOME_METRICS_ENABLED: 'THEA_FF_OUTCOME_METRICS_ENABLED',
  // Phase 8.1.4 — NPHIES HTTP transport. Default OFF.
  // When OFF: lib/integrations/nphies/adapter.ts returns a synthetic mock response (echoes
  //   input bundle with httpStatus 200 + mock outcome) AFTER a 50ms delay; lib/integrations/nphies/auth.ts
  //   returns a constant mock token without any network call; the three send/$process-message API
  //   routes return HTTP 404 OperationOutcome. Zero outbound HTTP traffic; safe to enable in CI.
  // When ON: adapter POSTs the message Bundle JSON to NPHIES_GATEWAY_URL with a Bearer token
  //   minted via OAuth2 client_credentials (cached in-memory, lazy-fetched). Single retry on 5xx
  //   with exponential backoff; 4xx never retried. All requests/responses logged with tenantId
  //   under category 'nphies.http'. Requires NPHIES_GATEWAY_URL, NPHIES_CLIENT_ID,
  //   NPHIES_CLIENT_SECRET, NPHIES_ENVIRONMENT in env (8.1.5 will add profile validation).
  FF_NPHIES_HTTP_ENABLED: 'THEA_FF_NPHIES_HTTP_ENABLED',
  // Phase 8.1.5 — NPHIES profile validator. Both default OFF.
  // When FF_NPHIES_VALIDATION_ENABLED is OFF: validateBundle / validateResource return
  //   { valid: true, issues: [] } immediately; the NPHIES adapter performs no validation
  //   and behavior is identical to 8.1.4. Zero CPU spent on shape checks.
  // When FF_NPHIES_VALIDATION_ENABLED is ON: every outbound message bundle is checked
  //   against the per-profile required-field + structural rules in lib/fhir/validation/profiles/*.
  //   By default validation is non-blocking — issues are logged under category
  //   'nphies.validation' and the send proceeds.
  // FF_NPHIES_VALIDATION_STRICT (only meaningful when the first flag is ON): when ON,
  //   any error-severity issue aborts the send with NphiesValidationError BEFORE any
  //   network call is made. Warnings still allow the send to proceed.
  FF_NPHIES_VALIDATION_ENABLED: 'THEA_FF_NPHIES_VALIDATION_ENABLED',
  FF_NPHIES_VALIDATION_STRICT:  'THEA_FF_NPHIES_VALIDATION_STRICT',
} as const;

export type FlagKey = keyof typeof FLAGS;

export function isEnabled(flag: FlagKey): boolean {
  return process.env[FLAGS[flag]] === 'true';
}

export function requireFlag(flag: FlagKey): void {
  if (!isEnabled(flag)) {
    throw new Error(`Feature flag ${FLAGS[flag]} is not enabled`);
  }
}
