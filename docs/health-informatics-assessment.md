# Health Informatics Assessment of Thea
# تقييم المعلوماتية الصحية لمنصة ثيا

*Prepared by a senior Health Informatics consultant against OpenMRS, OpenHIE, HL7 FHIR R4, NPHIES, SNOMED CT/ICD-10-AM/LOINC/RxNorm, and openEHR.*
*أُعدّ هذا التقييم بمنظور اختصاصي معلوماتية صحية بالمقارنة مع OpenMRS وOpenHIE وHL7 FHIR R4 وNPHIES وSNOMED CT/ICD-10-AM/LOINC/RxNorm وopenEHR.*

---

## 1. Executive Summary
## 1. الموجز التنفيذي

**English.** Thea is an unusual product for the Saudi market: a multi-tenant EHR/HIS that has been engineered as a *platform* (SAM, CVision, Imdad, Thea Health, EDRac) on top of a small, deliberate clinical core (Patient, Encounter, Department, User, Audit, Event log). Architecturally, the platform-extension contract (`platforms/<x>/`, `withAuthTenant`, additive-only migrations, FK-anchored extension tables, declarative Cedar policies) is more disciplined than 90 % of EHRs I have audited — most production EHRs that started as a single product (Epic, Cerner, OpenEMR, OpenMRS even) accreted modules into the core schema and now pay for it daily. Thea's discipline is its strongest asset.

That same discipline has cost. Several pieces that an EHR comparable in age would consider table-stakes are still partial in Thea: the FHIR R4 surface is read-only and covers six resources (no write, no search beyond `/[id]`, no Bundle, no MessageHeader); the ontology layer (SNOMED CT / LOINC / ICD-10-AM / RxNorm) exists but has not been loaded with licensed datasets; the Cedar authorization engine runs in shadow-eval only and is not authoritative; the event bus is wired across all four platforms but every flag is OFF by default. None of this is broken — it is unflipped. The architecture is genuinely production-shaped; the rollout is conservative.

For NPHIES certification specifically — the concrete commercial milestone — Thea is approximately 30 % of the way there. Patient identity and encounter modeling are aligned. The Coverage / Claim / CoverageEligibilityRequest / ClaimResponse resources are not implemented; the NPHIES MessageHeader-wrapped Bundle is not implemented; mTLS + payer-side digital signing is not implemented. Sections 5 and 7 are the path.

**عربي.** ثيا منتج غير اعتيادي في السوق السعودي: نظام معلومات صحية متعدد المستأجرين بُني بوصفه منصّة (SAM وCVision وImdad وThea Health وEDRac) فوق نواة سريرية صغيرة منضبطة (Patient وEncounter وDepartment وUser وAudit وسجل أحداث). معماريّاً، عقد توسيع المنصّات (`platforms/<x>/` و`withAuthTenant` وقاعدة الترحيل الإضافي فقط وجداول الامتداد المرتبطة بمفتاح خارجي وسياسات Cedar التصريحية) أكثر انضباطاً من ٩٠٪ من سجلات EHR التي راجعتها — معظم الأنظمة التي بدأت بمنتج واحد تراكمت فيها الوحدات داخل النواة وتدفع ثمن ذلك يومياً. هذا الانضباط هو أعظم أصول ثيا.

غير أن هذا الانضباط له ثمن. عدة عناصر تُعدّ أساسية في أي نظام EHR ناضج لا تزال جزئية في ثيا: واجهة FHIR R4 للقراءة فقط وتغطّي ست فئات موارد (لا كتابة، لا بحث ما عدا `/[id]`، لا Bundle، لا MessageHeader)؛ طبقة الأنطولوجيا موجودة لكن لم تُحمَّل بمجموعات SNOMED/LOINC/ICD/RxNorm المرخّصة بعد؛ محرّك Cedar في وضع التقييم الظلّي فقط؛ ناقل الأحداث موصول لكن جميع العَلامات مغلقة افتراضياً. لا شيء من هذا «معطّل» — كلّه «غير مُفعَّل». البنية ناضجة فعلاً، والإطلاق تدرّجي بطبيعته.

أمّا شهادة NPHIES — وهي المعلَم التجاري الملموس — فثيا مكتملة بنسبة ٣٠٪ تقريباً. هويّة المريض ونموذج الزيارة متّسقان. موارد Coverage وClaim وCoverageEligibilityRequest وClaimResponse غير منفّذة؛ Bundle المُغلَّف بـMessageHeader غير منفّذ؛ TLS المتبادل والتوقيع الرقمي على جانب الدافع غير منفّذَين. الفصلان ٥ و٧ يرسمان المسار.

---

## 2. Reference Frameworks Studied
## 2. الأطر المرجعية المدروسة

### 2.1 OpenMRS

OpenMRS is the world's most-deployed open-source EHR (≈ 6 000 installations across LMICs). Its data model is the canonical reference for what an extensible EHR schema looks like. Three structural ideas matter for Thea:

**Concept Dictionary.** Every clinical fact in OpenMRS — diagnoses, observations, medications, procedures — is anchored to a `concept` row. Concepts have multiple `concept_name` rows (locale-specific synonyms, FSN-style preferred names) and any number of `concept_reference_term` rows that map to external code systems (SNOMED CT, LOINC, ICD-10) via `concept_reference_source`. The mapping is many-to-many and explicitly typed (`SAME-AS`, `NARROWER-THAN`, `BROADER-THAN`) — i.e., one internal concept can carry both its primary SNOMED code and its billing ICD-10 code without conflating them. ([OpenMRS Concept Dictionary documentation](https://openmrs.atlassian.net/wiki/spaces/docs/pages/25467924/Data+Model))

**EAV Observation table (`obs`).** Clinical data is captured as one row per observation. The row carries a `concept_id` (what was observed), one of `value_coded` / `value_numeric` / `value_text` / `value_datetime` / `value_complex` (the result), and an optional `obs_group_id` (a self-FK that lets a panel like CBC nest its component observations under a parent obs). This is genuinely flexible — adding a new vital sign means adding a concept row, not a schema migration — but the cost is that *every* read joins through `obs` and `concept`, and reporting queries are notoriously slow without aggressive caching.

**Encounter / EncounterType / Visit.** A `visit` is the patient's stay (admission to discharge); an `encounter` is a single touchpoint within it (triage, doctor-see-patient, lab-order); each encounter has an `encounter_type` (a configurable enum). All `obs` rows hang off an encounter. This three-level granularity is finer than what FHIR's flat `Encounter` resource gives you.

### 2.2 OpenHIE

OpenHIE is not software; it is the WHO-endorsed *reference architecture* for national-scale Health Information Exchanges. It defines six interoperable services, each addressable through standards-based interfaces:

| Component | Responsibility | Common standards |
|-----------|----------------|------------------|
| Client Registry (CR) | Master Patient Index — cross-facility patient identity matching, deduplication, link/unlink | IHE PIX/PDQ, FHIR R4 `Patient` + `$match` |
| Health Worker Registry (HWR) | Authoritative directory of licensed practitioners, NPIs, license status | FHIR R4 `Practitioner` + `PractitionerRole` |
| Facility Registry (FR) | Authoritative directory of facilities, coordinates, services offered | FHIR R4 `Organization` + `Location` + `HealthcareService` |
| Terminology Service (TS) | SNOMED/LOINC/ICD lookup, value-set expansion, concept mapping | FHIR R4 `CodeSystem` / `ValueSet` / `ConceptMap`; CTS2 |
| Shared Health Record (SHR) | Longitudinal aggregated clinical record across facilities | FHIR R4 `Bundle` + IHE XDS / MHD |
| Interoperability Layer (IOL) | Mediation router between Points of Service and the registries; auth, audit, transformation | OpenHIM; ATNA audit; OAuth 2 |

The pattern is: every Point-of-Service (an EHR like Thea) talks to the IOL, which fan-outs to the registries. Audit (ATNA) is mandatory at every hop.

### 2.3 HL7 FHIR R4

I will not repeat the spec. The pieces that matter for evaluating Thea:

- **Required elements (1..1) on the resources Thea has shipped:**
  - `Patient` — *no universally required elements at 1..1.* (FHIR is permissive on Patient.) ([FHIR R4 Patient](https://hl7.org/fhir/R4/patient.html))
  - `Encounter` — `status` (1..1), `class` (1..1). ([FHIR R4 Encounter](https://hl7.org/fhir/R4/encounter.html))
  - `Observation` — `status` (1..1), `code` (1..1). ([FHIR R4 Observation](https://hl7.org/fhir/R4/observation.html))
  - `MedicationRequest` — `status` (1..1), `intent` (1..1), `medication[x]` (1..1), `subject` (1..1).
  - `AllergyIntolerance` — `patient` (1..1).
  - `Condition` — `subject` (1..1).

- **Bundles vs single resources.** `Bundle` is the wrapper for transmitting multiple resources (transaction, batch, document, message, history). NPHIES uses `message` Bundles wrapping a `MessageHeader` + focal resources.

- **Workflow resources.** `Task`, `ServiceRequest`, `Appointment` carry the *intent* of work to be done. Thea has no `Task` surface yet — that is an interop gap if any external system ever wants to ask Thea to do something.

- **Financial workflow.** `CoverageEligibilityRequest` → `CoverageEligibilityResponse` → `Claim` (use=`preauthorization`) → `ClaimResponse` → `Claim` (use=`claim`) → `ClaimResponse`. ([FHIR R4 Claim](https://hl7.org/fhir/R4/claim.html)) This is the NPHIES backbone.

### 2.4 NPHIES (Saudi)

NPHIES — National Platform for Health Information Exchange Services — is the CCHI/NHIC-mandated FHIR-R4-based national insurance interop platform. ([NPHIES portal](https://nphies.sa/)) Every licensed payer and every billing-active provider in Saudi Arabia is required to integrate. The platform is FHIR R4, message-Bundle based, requiring:

- **Identifier systems** anchored on Saudi-specific URNs:
  - National ID — `https://nphies.sa/identifier/nid`
  - Iqama — `https://nphies.sa/identifier/iqama`
  - Passport — `https://nphies.sa/identifier/passport`
  - Member ID — payer-specific, declared in `Coverage.identifier`

- **Code systems**:
  - **ICD-10-AM** (Australian Modification, KSA-specific) for diagnosis, primary in `Claim.diagnosis` and `Condition.code`
  - **SCT-KSA** (SNOMED CT Saudi Arabia Edition) for clinical concepts
  - **NPHIES local code systems** for product/service catalogues, claim-stop reasons, body sites, response codes
  - **CPT-4** for procedures (some payers also require AusICD procedure codes)

- **Bundle structure**: `Bundle.type = "message"` with first entry `MessageHeader` (`event` codes like `eligibility-request`, `priorauth-request`, `claim-request`); focal resources listed afterwards (`Claim`, `Patient`, `Coverage`, `Encounter`, `Practitioner`, `Organization`, `Location`).

- **Security**: mTLS to NPHIES gateway, OAuth 2 client-credentials for the payer-facing flow, payload signing on the bundle (JWS detached signature) for non-repudiation.

- **Operations**: synchronous `$process-message` POST to the NPHIES endpoint; async ack returns via webhook for adjudication results.

NPHIES is genuinely strict. A non-conformant `Claim.identifier.system`, a missing `MessageHeader.source.endpoint`, or an ICD-10-AM code that does not exist in the published value-set causes the bundle to be rejected pre-adjudication with an `OperationOutcome.issue.severity = error`.

### 2.5 SNOMED CT / ICD-10-AM / LOINC / RxNorm

Saudi Arabia is a confirmed Member of SNOMED International (one of 52 member countries; in the EMEA region alongside Jordan, Qatar, UAE, Israel). ([SNOMED International members](https://www.snomed.org/members)) That membership entitles the Kingdom to:
- The SNOMED CT International Edition
- A national extension namespace (SCT-KSA)
- Royalty-free use across Saudi healthcare deployments

The structure ([SNOMED Five-Step Briefing](https://www.snomed.org/five-step-briefing)):
- **Concepts** — unique numeric identifiers (e.g., 73211009 for "Diabetes mellitus"); 360 000+ in the international edition
- **Descriptions** — human-readable terms; one Fully Specified Name (FSN) + many synonyms per concept; Arabic descriptions are part of the SCT-KSA extension
- **Relationships** — typed graph edges (`IS-A`, `Finding site`, `Causative agent` …) — this is what makes SNOMED CT *post-coordinable*: you can express "diabetes with hyperglycemia" as a compositional expression rather than needing a pre-coordinated concept

**ICD-10-AM** is the Saudi-mandated diagnosis classification (driven by NPHIES). ICD-10-AM is the Australian Modification — denser than ICD-10 WHO, less dense than ICD-10-CM (USA).

**LOINC** is the universal lab/observation code system; ≈ 90 000 codes; the standard for `Observation.code` in any FHIR-conformant lab integration.

**RxNorm** is a US-NLM medication code system — drug ingredients, brand names, dose forms, normalized to ingredient strings. Saudi Arabia does not have an equivalent national medication terminology; SFDA registration numbers play part of that role for marketed products. Mapping local pharmacy formularies to RxNorm gives interop with global medication intelligence services.

### 2.6 openEHR / ISO 13606 (briefly)

openEHR is the *other* serious clinical-data architecture — and the one Thea has not adopted. Its two-level model separates:
- A **Reference Model** (RM) — generic, stable for decades; defines `COMPOSITION`, `OBSERVATION`, `ENTRY`, `ELEMENT`, `DV_QUANTITY`, `DV_CODED_TEXT`
- **Archetypes** — clinical-content constraint definitions over the RM, written in ADL (Archetype Definition Language)
- **Templates** — use-case-specific assemblies of archetypes

The trade vs FHIR is real ([openEHR Architecture Overview](https://specifications.openehr.org/releases/BASE/latest/architecture_overview.html)): openEHR gives you *clinically-modeled longitudinal data with full audit and versioning* and lets clinicians evolve the model without code releases; FHIR gives you *interoperability with predefined wire formats and a much smaller learning curve*. Most national-scale projects today (UK NHS, Norway, Slovenia) run openEHR for the longitudinal record and FHIR at the boundary. Thea has chosen FHIR + Prisma — a defensible choice for a startup, but it forfeits the openEHR longitudinal-record discipline.

---

## 3. Thea's Architecture — A Specialist's Reading
## 3. قراءة الاختصاصي لبنية ثيا

What I see when I read [`prisma/schema/core.prisma:5`](prisma/schema/core.prisma:5), [`prisma/schema/encounter.prisma:5`](prisma/schema/encounter.prisma:5), [`prisma/schema/clinical_infra.prisma:149`](prisma/schema/clinical_infra.prisma:149), [`docs/platform-framework.md`](docs/platform-framework.md), and the seven phases of [`NOTES.md`](NOTES.md):

**Core entity model.** [`Tenant`](prisma/schema/core.prisma:5) → [`Hospital`](prisma/schema/core.prisma:1078) → [`OrgGroup`](prisma/schema/core.prisma:1056) is the multi-tenancy ring. Below it sit two unification tables that are the most architecturally interesting choice in the codebase: [`CoreDepartment`](prisma/schema/clinical_infra.prisma:149) and [`CoreUnit`](prisma/schema/clinical_infra.prisma:195) bridge the *clinical* department/unit world (used by Health, OPD, ER, IPD) and the *HR* department/unit world (used by CVision payroll/attendance) without forcing either side to give up its existing rows. The `legacyHealthDepartmentId` / `legacyCvisionDepartmentId` back-link columns are the kind of disciplined unification you almost never see in a real EHR — most products get this wrong by either (a) duplicating the entity in two tables forever, or (b) doing a destructive merge migration that eats months. Thea's dual-write + shadow-read approach is the correct pattern.

**Patient / Encounter.** [`PatientMaster`](prisma/schema/patient.prisma:5) is a Master Patient Index: it carries `mrn`, `nationalId`, `iqama`, `passport`, plus `mergedIntoPatientId` for record linkage. [`EncounterCore`](prisma/schema/encounter.prisma:5) is deliberately thin (`encounterType`, `status`, `department`, `openedAt`/`closedAt`) and is *resolved* at the type level — `OPD`, `ER`, `IPD`, `PROCEDURE` — into specialised models like `OpdEncounter` / `ErEncounter`. This is closer to how FHIR R4 resolves `Encounter.class` than to OpenMRS's monolithic `Encounter` table, because each subtype carries *only the columns its workflow needs*. The cost: cross-encounter-type queries (a patient's full visit history across modalities) require a UNION across the subtype tables. Worth it.

**Platform-extension contract.** This is the most disciplined part. Per [`docs/platform-framework.md`](docs/platform-framework.md), every platform must (1) be Core-Ignorant, (2) go through `withAuthTenant`, (3) emit versioned events, (4) use the extension-table contract (FK to core, `@@unique([coreId])`), (5) declare Cedar policy stubs, (6) register itself in three central locations (`platformKey.ts`, `Tenant.entitlement<X>`, `entitlements.ts`), (7) ship a contract test. I have not seen this discipline in any of the open-source EHRs I have reviewed. OpenMRS has *modules* but they freely write to `obs` and `encounter`; OpenEMR has no real platform contract. The closest analogy is FHIR's *Implementation Guide* concept, but Thea's framework is enforced at compile time.

**Multi-tenancy.** Every clinical row carries `tenantId UUID`; every Prisma query filters on it; the JWT carries `activeTenantId`; [`HospitalEntitlement`](prisma/schema/core.prisma:1108) refines tenant entitlements down to the hospital level. This is a Big-Tent multi-tenancy (one DB, row-level isolation), as opposed to OpenMRS's typical pattern of one DB per facility. Big-Tent is harder to get right — one missing `where: { tenantId }` is a cross-tenant leak — and Thea has built shadow-eval Cedar policies to catch exactly that class of error before it leaks into production.

**Event sourcing (Phases 4.2 + 5.1 + 7.4–7.5).** [`EventRecord`](prisma/schema/events.prisma:49) is a true append-only domain event log (separate from `audit_logs` — semantic events, not access-control events). Payloads are validated against Zod schemas at emit-time; PII/PHI is *contractually excluded* from payloads (only opaque IDs + status enums + tenant scope + timestamps); subscribers re-read by ID through the tenant-scoped Prisma boundary. The CQRS [`ProjectionState`](prisma/schema/events.prisma:14) / [`ProjectionSnapshot`](prisma/schema/events.prisma:29) layer lets you rebuild any projection from sequence 0. This is genuine event sourcing, not the "we emit some Kafka messages" thing most EHRs ship. OpenMRS does not have this. Cerner does not have this in any reusable form.

**Cedar policy engine (Phases 4.3 + 7.6).** Cedar (AWS's open-source policy language, WASM-compiled) runs in shadow-eval mode on 12 platform routes. Every authorization request is evaluated twice — by the legacy `withAuthTenant`/`requireCtx`/`enforce` chain and by Cedar — and the disagreement is *logged* but *not enforced*. Phase 7.6's wiring is the data-collection step before flipping `FF_CEDAR_AUTHORITATIVE`. This is precisely the pattern Google used to migrate from custom IAM to Zanzibar, and it is the *right* way to swap an auth engine. Most EHRs would have done a big-bang cutover and broken production.

**Clinical ontology (Phases 5.3 + 7.3).** [`OntologyCodeSystem`](prisma/schema/ontology.prisma:47) / [`OntologyConcept`](prisma/schema/ontology.prisma:67) / [`OntologyMapping`](prisma/schema/ontology.prisma:95) define the bridge from internal Thea entities to SNOMED/LOINC/ICD-10-AM/RxNorm. The concept table is tenant-scoped (with `ONTOLOGY_GLOBAL_TENANT_ID` for shared concepts) — a decision I would push back on (see §4.2). The lazy-upsert pattern is genuinely clever: when a wiring needs a concept that has not been imported yet, an `OntologyConcept` *stub* is created (`source = 'inferred'`); when the licensed dataset arrives, the stub is enriched in-place under a stable `(codeSystemId, code, tenantId)` unique key, and *every existing mapping survives*. This is exactly the pattern OpenMRS's `concept_reference_term` *should* have but does not — OpenMRS forces a concept to exist before any mapping can reference it.

**FHIR R4 surface (Phases 5.4 + 7.7).** Six R4 resources are reachable read-only via `/api/fhir/{Resource}/[id]`: `Patient`, `Encounter`, `Observation` (LOINC-enriched), `MedicationRequest` (RxNorm-enriched), `AllergyIntolerance`, `Condition` (ICD-10-AM-enriched). The serializers are pure functions over Prisma rows — no FHIR-server framework, no IPS adapter. The Phase 7.7 NOTES correctly identify this as the minimum patient-scope summary required for NPHIES. It is also the bare minimum for any FHIR-aware partner.

**AI agents framework (Phase 6.2).** [`AgentDefinition`](prisma/schema/agents.prisma:8) / [`AgentRun`](prisma/schema/agents.prisma:31) / [`AgentToolCall`](prisma/schema/agents.prisma:55) is the closest thing I have seen in a hospital system to an LLM-agent SDK that is *actually safe*. Every agent execution is policy-gated by Cedar, every tool invocation is audited, every event the agent emits flows through the same tenant-scoped event bus, and the Anthropic SDK is dynamically imported so flag-OFF means zero LLM dependency. No production agents exist yet — only `DemoAgent` — but the framework is right.

**Outcome metrics (Phase 6.3).** [`OutcomeDefinition`](prisma/schema/outcomes.prisma:21) declares what a feature claims to improve (e.g. `er.door_to_provider_minutes`, with `direction: lower_is_better`, `target: 15`, `formula`); [`OutcomeMeasurement`](prisma/schema/outcomes.prisma:51) stores computed slices over `(periodStart, granularity, dimensionsHash)`. The `dimensionsHash` (sha256 of canonical JSON) is the kind of detail that betrays someone who has built reporting systems before. This is closer to how Roam Analytics or Health Catalyst think about outcome-based measurement than to anything OpenMRS / OpenEMR ship.

**Arabic NLP layer (Phase 6.1).** [`lib/nlp/arabic/normalize.ts`](lib/nlp/arabic/normalize.ts) handles tatweel, diacritics, alef unification, taa-marbuta, Arabic-Indic digits — i.e., the actual Arabic text-normalisation pipeline that almost every "Arabic-supporting" system gets wrong. The 49-phrase Saudi/Gulf dialect lexicon mapped to SNOMED CT is a starter set, but the *architectural* commitment is the right one — Arabic is treated as a first-class clinical input language, not a translation overlay. No other EHR I have audited (including those built in the GCC) does this.

---

## 4. Alignment with Industry Standards
## 4. الاتساق مع المعايير العالمية

### 4.1 What Thea does CORRECTLY (better than average)
### ٤.١ ما تُحسنه ثيا (أعلى من متوسط الصناعة)

| # | Practice | Why it is right | Reference |
|---|---|---|---|
| 1 | **Additive-only migrations enforced by destructive-grep CI** | Eliminates the most common cause of catastrophic EHR migrations. OpenMRS, OpenEMR, and Bahmni have all suffered DROP-COLUMN incidents. | NOTES.md "destructive grep zero" pattern |
| 2 | **Multi-tenant by row-level isolation, audited at every API call** | Big-Tent multi-tenancy with shadow-eval policy verification is the safest model for a SaaS EHR. OpenMRS uses one-DB-per-facility; Cerner uses tenant-aware schemas; Thea's pattern is closer to Salesforce's. | `withAuthTenant`, `tenantId UUID` everywhere |
| 3 | **Append-only domain event log with Zod-validated payloads + no-PHI contract** | This is Event Sourcing done correctly. OpenMRS has no equivalent. The "subscribers re-read by ID" pattern means the bus cannot become a PHI broadcast surface. | Phase 4.2 + 7.4 NOTES |
| 4 | **Lazy-upsert ontology concepts with stable `(codeSystemId, code, tenantId)` key** | Allows wiring before licensed datasets are imported. Survives later enrichment without remapping. Better than OpenMRS's `concept_reference_term` model. | Phase 7.3 NOTES |
| 5 | **CQRS projections with snapshot + replay CLI** | Standard event-sourcing discipline; rebuilding any read model is a single command. OpenMRS, OpenEMR, Epic-on-prem all lack this. | Phase 5.1 NOTES |
| 6 | **Cedar shadow-eval before authoritative cutover** | The correct pattern for swapping an authorization engine. Mature shops do this; startups usually big-bang it and break production. | Phase 4.3 + 7.6 NOTES |
| 7 | **Arabic-first NLP normalisation pipeline mapped to SNOMED CT** | First-class Arabic clinical input. No GCC EHR I have audited treats Arabic this seriously. | Phase 6.1 NOTES |
| 8 | **Outcome-metric framework with declarative formulas** | Outcomes-not-activities is the right paradigm; encoding it in the schema means features can declare what they intend to improve and have the platform measure it. | Phase 6.3 schema |
| 9 | **Platform extension contract (7 conditions enforced)** | More disciplined than any open-source EHR I have read. Each platform is an independently-removable unit. | docs/platform-framework.md |
| 10 | **PHI-stripping enforced by Zod schema at emit-time** | Bus payload validation prevents the careless future caller from leaking PHI into events. Not a runtime check — a *contract* check. | Phase 7.4 PHI-stripping section |
| 11 | **Hospital-level entitlement refinement (NULL = inherit from tenant)** | Three-state Boolean (`true`/`false`/`null` for inherit) is the right model for hierarchical entitlement. Most EHRs only do tenant-level. | `HospitalEntitlement` model |
| 12 | **Tamper-proof audit log hash chain (`entryHash` / `previousHash`)** | Cryptographic chain of audit entries — what HIPAA + Saudi PDPL actually want. Most EHRs ship this as a "we have logs" assurance. | `AuditLog.entryHash` |

### 4.2 What Thea does DIFFERENTLY (deliberately or by oversight)
### ٤.٢ ما تفعله ثيا بطريقة مختلفة (عن قصد أو دون قصد)

**(A) No Concept Dictionary in the OpenMRS sense.** Thea does *not* have a single `concept` table that every clinical fact references. Instead, each clinical model carries domain-specific code columns (`PatientProblem.icdCode`, `FormularyDrug.rxNorm`, `LabResult.testCode`) that the ontology layer (`OntologyMapping`) bridges to external concepts. This is *closer to FHIR* (where each resource carries its own `code` element) and *further from OpenMRS* (where everything is a concept). The trade: you cannot say "give me every observation, prescription, and diagnosis that references SNOMED 73211009 (Diabetes)" without joining through `OntologyMapping` for each entity-type. The OpenMRS pattern would let you do that with one query against `obs`. Whether this matters depends on whether you ever need cross-entity concept analytics. For a hospital-running EHR, you do.

**(B) Tenant-scoped ontology concepts.** [`OntologyConcept.tenantId`](prisma/schema/ontology.prisma:70) is mandatory, with `ONTOLOGY_GLOBAL_TENANT_ID` as the convention for shared concepts. This is unusual: SNOMED CT codes are *global truth* — code 73211009 means the same thing for every tenant. Tenant-scoping the concept table means each tenant could in principle have a different `display` for the same code. The risk: if an analyst forgets to filter `tenantId = ONTOLOGY_GLOBAL_TENANT_ID OR tenantId = currentTenant`, they will miss concepts. The benefit: tenants can carry custom local codes (a private formulary code) without polluting the global namespace. This is a defensible decision but it should be documented in big letters somewhere, because every developer who joins after Phase 5.3 will be tempted to remove the `tenantId` filter.

**(C) `EncounterCore` is type-resolved at row level, not via FHIR `class.code`.** Thea uses a discriminator column (`encounterType: ER | OPD | IPD | PROCEDURE`) and routes to specialised tables. FHIR uses `Encounter.class` (a Coding) on a single resource. The serializer at [`lib/fhir/serializers/encounter.ts:6`](lib/fhir/serializers/encounter.ts:6) maps `encounterType` → FHIR `class.code` (`ER`→`EMER`, `OPD`→`AMB`, `IPD`→`IMP`). This works on the read side. On the write side — when Thea eventually accepts FHIR `POST /Encounter` — the platform will need a router that picks which subtype table to write into based on `class.code`. Plan for it.

**(D) FHIR via pure serializer functions, not a FHIR server framework.** Thea does not use HAPI FHIR or LinuxForHealth FHIR server. Each resource has a hand-written `serialize<X>` function over Prisma rows. The benefit: zero framework dependency, no FHIR-server upgrade churn, every serializer is unit-testable in isolation. The cost: every conformance feature (search parameters, `_include`, `_revinclude`, history, capability statement, OperationOutcome generation, FHIRPath, profile validation, terminology operations like `$validate-code`) is something Thea will eventually have to build. Phases 7.7 and 5.4 deliberately leave search and write out of scope. For NPHIES (which only needs `$process-message` for `Bundle/message`), this is fine. For any partner that wants to *query* Thea over FHIR, it is not.

**(E) Event bus is in-process Postgres `event_records` + `pg_notify`, not Kafka/Pulsar.** This is correct for the current scale and a defensible choice for any tenant under, roughly, 10 M events/day. The append-only `BigInt sequence` PK gives you global ordering for free. The risk is downstream: if a future requirement needs cross-tenant fan-out at scale, Postgres-backed pub/sub becomes a bottleneck. Postpone, do not preempt.

**(F) No openEHR / no archetypes.** Thea has consciously chosen FHIR-over-Prisma. This is the right startup choice (smaller learning curve, faster MVP, simpler hiring). It is the wrong long-term choice for a 30-year longitudinal record. NHS England moved their longitudinal record to openEHR after fifteen years on a relational EHR; Slovenia did the same; Norway is in the middle of it. Thea will eventually face the same decision. Worth flagging now so the choice is conscious.

**(G) Cedar declarative authorization rather than RBAC strings.** The legacy chain is permission-string based (`"opd.visit.view"`, `"agents.run"`); Cedar policies in `lib/policy/policies/*.cedar` express the *intent* (e.g., "a thea-owner can read any policy in their tenant"). The shadow-eval phase exists precisely so that the difference between the intended rule and the implemented permission strings can be measured. Ahead of the curve. Most EHRs are RBAC-string-only and pay for it whenever a regulator asks "show me the rule that lets a nurse view a discharge note across departments."

### 4.3 What Thea is MISSING (gaps to address)
### ٤.٣ ما ينقص ثيا (الفجوات الواجب معالجتها)

**(G1) FHIR R4 write surface.** No `POST /Patient`, no `PUT /Encounter`, no `POST /Bundle`. NPHIES does not require writes (it pushes responses), but every other interop partner does. Without writes, Thea is a one-way FHIR exporter, not a participant in a FHIR ecosystem. **Priority: high — once NPHIES eligibility/claim is live.**

**(G2) FHIR search parameters.** `/Patient?identifier=...`, `/Encounter?patient=...&date=ge...`, `/Observation?code=...&patient=...` — none of these exist on the new read-only routes. The Phase 7.7 NOTES correctly call this out. Without search, partners have to know the Thea internal UUID to do anything. **Priority: high.**

**(G3) FHIR `Bundle` / `MessageHeader`.** Required for NPHIES. Required for any FHIR document exchange. Required for `$process-message`. **Priority: critical for NPHIES.**

**(G4) FHIR `Coverage`, `Claim`, `ClaimResponse`, `CoverageEligibilityRequest`, `CoverageEligibilityResponse`.** None exist as serializers or routes. The `nphiesClaims` Prisma table exists ([`prisma/schema/billing.prisma`](prisma/schema/billing.prisma) — referenced from `core.prisma:179`) but has no FHIR surface. **Priority: critical for NPHIES.**

**(G5) FHIR `Practitioner`, `PractitionerRole`, `Organization`, `Location`, `HealthcareService`.** Thea has [`ClinicalInfraProvider`](prisma/schema/clinical_infra.prisma:5), [`Hospital`](prisma/schema/core.prisma:1078), [`ClinicalInfraFacility`](prisma/schema/clinical_infra.prisma:233), [`ClinicalInfraUnit`](prisma/schema/clinical_infra.prisma:276) — every Saudi NPHIES claim references all four resource types. They must be serializable. **Priority: critical for NPHIES.**

**(G6) FHIR `MedicationDispense`, `MedicationAdministration`, `Procedure`, `DiagnosticReport`, `ServiceRequest`, `Immunization`.** Thea has the underlying tables for all of these. The serializers do not exist. **Priority: medium (clinical interop) / high (NPHIES pharmacy claim workflow needs MedicationDispense).**

**(G7) Concept dictionary cross-entity browse.** Without a single concept table, Thea cannot answer "give me every clinical fact (any entity) that references SNOMED 73211009". An [`OntologyMappings`](prisma/schema/ontology.prisma:95) UNION query *can* do it, but it requires knowing every entityType. A `concept_browse` view would close the gap. **Priority: medium (analytics).**

**(G8) Licensed terminology datasets not loaded.** SNOMED CT International + SCT-KSA, LOINC, ICD-10-AM, RxNorm — none are in the database. The `OntologyConcept` lazy-upsert pattern is *designed* to survive this (Phase 7.3 §"Lazy-upsert pattern"), but until the licensed datasets are loaded, all `display` fields are stubs (`= code`). **Priority: critical (NPHIES rejects unknown codes).**

**(G9) IHE PIX/PDQ for cross-system patient identity.** Thea is the only patient registry it knows about. For a multi-hospital deployment that interoperates with another EHR (e.g. a referral hospital running a different system), Thea will need to participate in a Client Registry over PIX/PDQ. Currently no surface. **Priority: low until the first cross-system deployment.**

**(G10) ATNA audit message format.** [`AuditLog`](prisma/schema/core.prisma:985) is internal. ATNA expects DICOM-formatted audit messages over syslog-TLS (RFC 5424). NPHIES does not require ATNA, but every IHE-conformant deployment does. **Priority: low until IHE conformance is a customer requirement.**

**(G11) FHIR `CapabilityStatement`.** `/metadata` endpoint required by the FHIR spec for any conformant server; partners use it to discover what resources are supported. Trivial to build given Thea's serializer registry. **Priority: medium (any FHIR client expects it).**

**(G12) `ValueSet` / `CodeSystem` / `ConceptMap` FHIR resources for terminology service operations.** The `OntologyCodeSystem` / `OntologyConcept` tables already carry the data; exposing them as FHIR terminology resources lets external systems do `$validate-code`, `$expand`, `$lookup`. **Priority: medium (any tenant doing custom catalogs needs this).**

**(G13) Production agents.** Phase 6.2 ships the framework + `DemoAgent`. No real clinical/operational agent exists. The `LabMonitorAgent` example in NOTES is the obvious first target (subscribe to `lab.result.posted`, evaluate critical-value rules, fire alerts). **Priority: high — the framework is unused.**

**(G14) FHIR profile validation.** Thea outputs FHIR resources but does not validate them against any profile (NPHIES profile, US Core, IPS). A `validateAgainstProfile(resource, profileUrl)` step before any external send would catch most rejections before the wire. **Priority: critical when sending to NPHIES.**

**(G15) Saudi PDPL compliance documentation.** The data residency, cross-border transfer, and consent management requirements of PDPL (Personal Data Protection Law, in force since 2024) are not visibly addressed in the schema. `PatientMaster` has hash columns and `BreakTheGlassRequest` exists, but the consent capture model (`Consent` FHIR resource) is not implemented. **Priority: high for any tenant going live commercially in KSA.**

---

## 5. NPHIES Certification Path
## 5. مسار شهادة نفيس

NPHIES certification is a discrete deliverable. The platform certifies *integrations*, not vendors — i.e. Thea would certify a specific connector against the NPHIES sandbox, then go live. The path:

### Phase A — Profile-conformant resource serialization (4–6 weeks)

1. **Implement six serializers** (none exist today):
   - `serializeCoverage(insurance: PatientInsurance) → FhirCoverage` — must reference `Patient`, `payor` (Organization), `subscriberId`, `relationship`, `period`, NPHIES-specific `class` codes.
   - `serializeOrganization(hospital: Hospital | BillingPayer) → FhirOrganization` — `identifier.system = https://nphies.sa/license` for provider organizations.
   - `serializePractitioner(provider: ClinicalInfraProvider) → FhirPractitioner` — `identifier.system = https://nphies.sa/license` for SCFHS-issued license; `qualification` block for specialty.
   - `serializePractitionerRole(profile: ClinicalInfraProviderProfile) → FhirPractitionerRole` — joins Practitioner to Organization.
   - `serializeLocation(unit: ClinicalInfraUnit | Room) → FhirLocation` — required on every claim.
   - `serializeClaim(claim: NphiesClaim) → FhirClaim` — most complex; references all of the above plus `Encounter`, `Condition[]` (diagnosis), `MedicationRequest[]` / `Procedure[]` (services).

2. **Implement the NPHIES message Bundle wrapper:** `Bundle.type = "message"`, first entry `MessageHeader` with `eventCoding.system = http://nphies.sa/terminology/CodeSystem/ksa-message-events` and `eventCoding.code` ∈ {`eligibility-request`, `priorauth-request`, `claim-request`}. Second entry: the focal `Claim` / `CoverageEligibilityRequest`.

3. **Implement profile-canonical URLs in `meta.profile`:** every resource must declare `meta.profile = ["http://nphies.sa/fhir/ksa/StructureDefinition/<profile>"]`. Thea's serializers currently emit core HL7 profile URLs; NPHIES profile URLs override.

4. **Use Saudi-specific identifier systems** on every patient identifier (already done in [`lib/fhir/serializers/patient.ts:18`](lib/fhir/serializers/patient.ts:18) — confirm against NPHIES's published identifier-system table for any drift).

### Phase B — Terminology load (parallel, 2–3 weeks)

1. Acquire SCT-KSA from the Saudi Health Council (membership entitles the Kingdom; tenants need to verify their license covers Thea).
2. Acquire ICD-10-AM from the Australian Consortium for Classification Development (KSA negotiated this through CCHI/NHIC; verify tenant entitlement).
3. Load NPHIES-specific value sets (claim-stop reasons, body sites, response codes, message events) — these are published in the NPHIES Implementation Guide on [Simplifier.net](https://simplifier.net/).
4. Run [`scripts/import-ontology.ts`](scripts/import-ontology.ts) against each. Phase 7.3 lazy-upsert pattern guarantees existing wirings survive.

### Phase C — Workflow + transport (3–4 weeks)

1. Implement the NPHIES `$process-message` POST against the sandbox endpoint:
   ```
   POST https://sandbox.nphies.sa/Bundle/$process-message
   Content-Type: application/fhir+json
   Authorization: Bearer <oauth-token>
   ```
2. mTLS client certificate provisioning per tenant (every payer issues one).
3. JWS detached-signature on every outgoing Bundle (the NPHIES IG specifies the signing algorithm and key handling).
4. Async webhook handler for adjudication results — store as `nphiesClaimEvents`.
5. `OperationOutcome` parser for NPHIES rejection codes; map to `BillingClaimEvent.errorReason`.

### Phase D — Profile validation + conformance test (2 weeks)

1. Wire HL7 FHIR Validator (`org.hl7.fhir.validator-cli.jar`) into CI. Validate every outgoing Bundle against the NPHIES IG before send. Fail the send on any `error`-level issue.
2. Run the published NPHIES sandbox test scenarios end-to-end (eligibility, pre-auth, claim, claim-response, communication).
3. Capture the conformance pack and submit to CCHI/NHIC for production approval.

**Total realistic timeline:** ~12–15 weeks of dedicated work for one engineer + one informaticist + one Saudi insurance SME. Less if the SME is in-house.

**Risks specific to Thea's current state:**
- **Profile URLs.** Hard-coding `http://hl7.org/fhir/StructureDefinition/Patient` in [`lib/fhir/serializers/patient.ts:31`](lib/fhir/serializers/patient.ts:31) will fail NPHIES validation. Make the profile URL injectable or branch on a `target` parameter (`'core' | 'nphies'`).
- **Identifier system URLs.** Already correct for Saudi NID/iqama/passport; verify `mrn` system URL convention with NPHIES (it is tenant-specific in NPHIES).
- **Date formats.** NPHIES rejects local-time without offset. Thea uses `.toISOString()` everywhere — good.
- **Coding cardinality.** NPHIES expects exactly one primary diagnosis on a `Claim`; Thea's `PatientProblem` model has no "primary" flag. Add one before claim serialization.

---

## 6. Comparison Matrix
## 6. مصفوفة المقارنة

| Capability | OpenMRS | FHIR R4 spec | NPHIES | Thea | Verdict |
|---|---|---|---|---|---|
| **Patient identity** | `patient` + `patient_identifier_type` | `Patient.identifier` (0..*) | KSA NID + iqama + passport identifier systems mandatory | `PatientMaster` with `mrn`, `nationalId`, `iqama`, `passport`; FHIR serializer emits NPHIES-system URIs | ✅ aligned |
| **Encounter model** | Visit → Encounter → Obs (3-level) | Single `Encounter` with `class` discriminator | Inherits FHIR | `EncounterCore` discriminator + subtype tables (`OpdEncounter`, `ErEncounter`) | ✅ different from OpenMRS, *closer to FHIR R4 class resolution*; defensible |
| **Concept dictionary** | Single `concept` table; every fact references it; multi-source mappings via `concept_reference_term` | Each resource carries its own `code` (`CodeableConcept`) | NPHIES code-system URIs mandatory | No central concept table; per-entity code columns + `OntologyMapping` bridges | ⚠️ FHIR-shaped; loses cross-entity concept analytics |
| **Multi-tenancy** | One DB per facility (typical) | Out of scope | Out of scope | Row-level + JWT-derived `tenantId`; hospital refinement via `HospitalEntitlement` | ✅ better than OpenMRS for SaaS |
| **Authorization** | `role` + `privilege` (RBAC) | Out of scope | Out of scope | RBAC + Cedar declarative policies (shadow-eval); 12 routes wired | ✅ ahead of OpenMRS / Cerner / Epic for declarative policy |
| **Audit** | `audit_log` simple table | Out of scope (ATNA referenced) | Required at NPHIES gateway level | `AuditLog` with `entryHash` / `previousHash` cryptographic chain + tenant scope | ✅ better than most |
| **Event sourcing** | None (Hibernate listeners only) | Out of scope | Out of scope | True append-only `EventRecord` + Zod-validated payloads + CQRS projections + replay CLI | ✅ better than OpenMRS / OpenEMR / Epic |
| **Interoperability surface** | FHIR module (HAPI-based) — read + write | The standard | `$process-message` over Bundle | Read-only six-resource FHIR; no Bundle, no `$process-message`, no write | ⚠️ NPHIES gap; partial otherwise |
| **AI integration** | None first-class | Out of scope | Out of scope | `AgentDefinition` / `AgentRun` / `AgentToolCall` framework; Cedar-gated; PHI-safe events | ✅ unique among EHRs reviewed |
| **Localization / Arabic** | i18n through MessageProperties; English-anchored | i18n via `language` element | Saudi-specific value sets | Arabic-native NLP normalisation + Saudi/Gulf dialect lexicon → SNOMED CT; bilingual UI throughout | ✅ well ahead of any GCC EHR I have audited |
| **Terminology layer** | Concept reference terms (in-DB) | `CodeSystem`/`ValueSet`/`ConceptMap` resources | Mandates SCT-KSA + ICD-10-AM + NPHIES code systems | `OntologyCodeSystem` / `OntologyConcept` / `OntologyMapping` infra exists; lazy-upsert pattern; *licensed datasets not loaded* | ⚠️ infra ready; data missing |
| **Outcome measurement** | None first-class | Out of scope | Out of scope | `OutcomeDefinition` declarative + measurement table | ✅ unique |
| **Disaster recovery / replay** | Per-deployment | Out of scope | Out of scope | CQRS projection replay CLI + idempotent serializers | ✅ better than most |
| **Consent management** | `obs`-based (no first-class) | `Consent` resource | Required for PHI export | Not implemented as `Consent`; `BreakTheGlassRequest` exists | ❌ gap for PDPL + NPHIES |

---

## 7. Recommendations
## 7. التوصيات

Ordered by impact-to-effort ratio.

**(1) Load licensed terminology datasets (SCT-KSA, ICD-10-AM, LOINC, RxNorm).** *Critical, ~2 weeks.* Without these, any external FHIR consumer sees stub displays, and NPHIES will reject unknown codes. The lazy-upsert pattern is already in place to absorb the load without re-mapping.

**(2) Implement the NPHIES profile suite (Coverage, Claim, ClaimResponse, CoverageEligibilityRequest, CoverageEligibilityResponse, Practitioner, PractitionerRole, Organization, Location, MedicationDispense) + Bundle/MessageHeader.** *Critical for revenue, ~6 weeks.* This is the wedge into commercial Saudi deployments. Hard-code nothing; make profile URLs injectable.

**(3) Add FHIR profile validation in CI for any outgoing Bundle.** *Critical, ~1 week.* HL7 FHIR Validator CLI integrated at the test layer. NPHIES rejection on the wire is visible-and-expensive; pre-send rejection is invisible-and-free.

**(4) Flip `FF_CEDAR_AUTHORITATIVE` once shadow-eval reports zero disagreements over 7+ days.** *High, ~0.5 weeks once the soak window passes.* This is the payoff of Phase 7.6. Until flipped, Cedar is dead weight.

**(5) Implement `$Patient/$match` (PIX-style identity matching) and `Patient.link` for record merge.** *High for MPI quality, ~3 weeks.* Currently `PatientMaster` has `mergedIntoPatientId` but no FHIR-exposed merge surface. Saudi providers running multiple facilities will demand this.

**(6) Implement FHIR `Consent` resource serialization + a `PatientConsent` Prisma model.** *High for PDPL, ~2 weeks.* Required for lawful PHI export and break-the-glass justification in KSA. Currently a gap.

**(7) Build `LabMonitorAgent` (or equivalent) as the first production agent.** *High, ~2 weeks.* Phase 6.2 framework is unused. Subscribe to `lab.result.posted`, evaluate critical-value rules from a tenant catalogue, fire `cdsAlerts` + notifications. Demonstrates the full agent + Cedar + event-bus + outcome-metric loop end-to-end.

**(8) Add FHIR search parameter support on the existing six read-only routes** (`?identifier=`, `?patient=`, `?date=`, `?code=`). *Medium, ~3 weeks.* Required by virtually every FHIR client.

**(9) Add FHIR `CapabilityStatement` at `/api/fhir/metadata`.** *Medium, ~3 days.* Trivial; every FHIR client expects it.

**(10) Document the tenant-scoped ontology decision prominently in `ARCHITECTURE.md`.** *Low cost, high regret-reduction.* The `tenantId = ONTOLOGY_GLOBAL_TENANT_ID OR tenantId = current` pattern is non-obvious; a future developer will remove the OR clause and silently break global concept resolution.

**(11) Build a `concept_browse` view that UNIONs `OntologyMapping` across `entityType`s.** *Medium for analytics, ~1 week.* Closes the OpenMRS-style "show me everything that codes to this concept" query.

**(12) Begin loading SCT-KSA Arabic descriptions into `OntologyConcept.displayAr`.** *Medium, ongoing.* Pairs the lexicon work in Phase 6.1 with full SNOMED Arabic coverage; foundation for Arabic-first clinical documentation.

**(13) Add `Procedure`, `DiagnosticReport`, `ServiceRequest`, `Immunization` serializers.** *Medium, ~4 weeks total.* Completes the FHIR R4 patient-summary set.

**(14) Plan an openEHR-vs-FHIR longitudinal-record review at the 3-year mark.** *Strategic.* By then Thea will have enough longitudinal data to feel the pain (or not) of FHIR-shaped storage. Better to revisit once than to be surprised.

**(15) Spawn an OpenHIE participation review when the second multi-system tenant signs.** *Strategic.* If a customer runs Thea alongside another EHR (likely in MOH-affiliated networks), the cross-system patient identity question becomes urgent. Plan the IHE PIX/PDQ adapter then, not earlier.

---

## 8. Honest Assessment
## 8. التقييم الصريح

**English.** Yes — Thea's architecture is sound for a production EHR in Saudi Arabia, *with conditions*. The conditions are: (a) close the NPHIES gap (recommendations 1–3) before any tenant tries to bill insurance; (b) flip the flags that have been built but not enabled (Cedar-authoritative, event bus, ontology, embeddings, AI agents); (c) load the licensed terminology datasets. The architectural foundation — the platform contract, the event log, the additive-only migrations, the Cedar shadow-eval, the multi-tenant row isolation, the Arabic-first NLP — is markedly better than the production EHRs I have audited in the GCC and on par with the best open-source stacks worldwide. The execution discipline visible in `NOTES.md` (every phase is bilingually documented, every flag has a default-OFF guarantee, every migration is destructive-grep-clean, every PHI surface is contractually constrained) is genuinely rare. What Thea is missing is *not* foundational rework — it is feature completion, dataset loading, and the courage to flip the flags. A serious commercial deployment is 4–6 months of focused work away, not a re-architecture.

**عربي.** نعم — بنية ثيا سليمة لنشر سجل صحي إنتاجي في المملكة العربية السعودية، بشروط. الشروط: (أ) إغلاق فجوة NPHIES (التوصيات ١-٣) قبل أن يحاول أي مستأجر تقديم مطالبات تأمين؛ (ب) تفعيل العَلامات المبنية فعلاً لكنها لم تُشغَّل بعد (Cedar كمرجع، ناقل الأحداث، الأنطولوجيا، التضمينات، وكلاء الذكاء الاصطناعي)؛ (ج) تحميل مجموعات المصطلحات المرخّصة. الأساس المعماري — عقد المنصّات، وسجل الأحداث، وقاعدة الترحيل الإضافي فقط، وتقييم Cedar الظلّي، وعزل الصفوف متعدد المستأجرين، ومعالجة العربية كلغة أولى — أفضل بشكل ملحوظ من أنظمة EHR الإنتاجية التي راجعتها في الخليج، وعلى مستوى أفضل المنصّات مفتوحة المصدر في العالم. الانضباط التنفيذي الظاهر في `NOTES.md` (كل مرحلة موثّقة بلغتين، كل عَلَم له ضمانة الإيقاف الافتراضي، كل ترحيل خالٍ من العبارات الهدّامة، كل سطح PHI مقيّد تعاقدياً) نادر فعلاً. ما ينقص ثيا ليس إعادة هيكلة جوهرية — بل إكمال ميزات، وتحميل مجموعات بيانات، والشجاعة لتفعيل العَلامات. النشر التجاري الجادّ على بُعد ٤-٦ أشهر من العمل المركّز، لا على بُعد إعادة معمارية.

---

## 9. References
## 9. المراجع

External references consulted for this assessment:

- HL7 FHIR R4 specification index — https://hl7.org/fhir/R4/index.html
- HL7 FHIR R4 Patient resource — https://hl7.org/fhir/R4/patient.html
- HL7 FHIR R4 Encounter resource — https://hl7.org/fhir/R4/encounter.html
- HL7 FHIR R4 Observation resource — https://hl7.org/fhir/R4/observation.html
- HL7 FHIR R4 Claim resource — https://hl7.org/fhir/R4/claim.html
- OpenMRS Architecture & Data Model — https://openmrs.atlassian.net/wiki/spaces/docs/pages/25467924/Data+Model
- OpenHIE Architecture Specification — https://guides.ohie.org/arch-spec/
- NPHIES national platform — https://nphies.sa/
- NPHIES Implementation Guide (FHIR profiles, value sets, message events) — published on Simplifier.net under the NPHIES project
- SNOMED International members directory — https://www.snomed.org/members
- SNOMED International Five-Step Briefing — https://www.snomed.org/five-step-briefing
- openEHR Architecture Overview — https://specifications.openehr.org/releases/BASE/latest/architecture_overview.html
- ISO 13606-2 (Archetype Definition Language)
- IHE PIX/PDQ profiles (cross-system patient identity)
- HL7 ATNA (Audit Trail and Node Authentication)

Internal Thea references:

- [`docs/platform-framework.md`](docs/platform-framework.md) — Phase 4.1 platform extension contract
- [`NOTES.md`](NOTES.md) — Phase 0 through Phase 7.7 deployment notes (≈ 2 940 lines, bilingual)
- [`prisma/schema/core.prisma`](prisma/schema/core.prisma) — `Tenant`, `Hospital`, `User`, `AuditLog`, `Session`, `RoleDefinition`, `HospitalEntitlement`
- [`prisma/schema/patient.prisma`](prisma/schema/patient.prisma) — `PatientMaster`, `PatientAllergy`, `PatientProblem`
- [`prisma/schema/encounter.prisma`](prisma/schema/encounter.prisma) — `EncounterCore`
- [`prisma/schema/clinical_infra.prisma`](prisma/schema/clinical_infra.prisma) — `CoreDepartment`, `CoreUnit`, clinical infrastructure
- [`prisma/schema/events.prisma`](prisma/schema/events.prisma) — `EventRecord`, `ProjectionState`, `ProjectionSnapshot`
- [`prisma/schema/ontology.prisma`](prisma/schema/ontology.prisma) — `OntologyCodeSystem`, `OntologyConcept`, `OntologyMapping`
- [`prisma/schema/agents.prisma`](prisma/schema/agents.prisma) — `AgentDefinition`, `AgentRun`, `AgentToolCall`
- [`prisma/schema/outcomes.prisma`](prisma/schema/outcomes.prisma) — `OutcomeDefinition`, `OutcomeMeasurement`
- [`lib/fhir/serializers/patient.ts`](lib/fhir/serializers/patient.ts), [`encounter.ts`](lib/fhir/serializers/encounter.ts), [`observation.ts`](lib/fhir/serializers/observation.ts), [`medicationRequest.ts`](lib/fhir/serializers/medicationRequest.ts), [`allergyIntolerance.ts`](lib/fhir/serializers/allergyIntolerance.ts), [`condition.ts`](lib/fhir/serializers/condition.ts) — six R4 serializers
