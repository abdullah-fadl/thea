## قاعدة معرفة منصة SAM (مرجع شامل)

**آخر تحديث**: 2026-01-23  
**النطاق**: منصة SAM داخل مشروع Thea (Next.js App Router + MongoDB tenant DB + policy-engine)  
**هدف هذا الملف**: أن يكون “وعي كامل” بما تم بناؤه في SAM: الفلسفة، البنية، التدفقات، البيانات، التكاملات، وفهرس الملفات/المسارات.

> ملاحظة مهمة: “SAM v1.0” مجمّدة بحسب وثائق المشروع (`docs/SAM_BOUNDARIES.md`) بتاريخ 2026-01-21. أي توسعة/سلوك جديد يجب اعتباره Phase جديد.

---

## 1) تعريف سريع: ما هي SAM؟

حسب الوثائق الرسمية:
- **Organization-first**: سلوك SAM يعتمد على **Organization Profile** للـ tenant + **Context Rules** المشتقة منه.
- **Task-first UX**: نقطة البداية هي **Work Queues** (`/sam/home`) ثم الانتقال لواجهات التنفيذ (Library / Conflicts / Drafts / Integrity).
- **Deterministic + Auditable**: كل الأفعال المحورية تُسجَّل في **Audit Logs** مع (actor + time + identifiers).
- **Draft-first authoring**: الإنشاء يتم عبر drafts بversioning واضح ثم publish للـ Library.

مراجع “مصدر الحقيقة”:
- `docs/SAM_BOUNDARIES.md`
- `docs/SAM_CONTEXT_RULES.md`
- `docs/SAM_QA_RUNBOOK.md`

---

## 2) حدود الملكية (Ownership Boundaries)

### 2.1 من يملك ماذا؟
- **Policy-engine** يملك: الملفات الفعلية، الاستخراج/OCR، الفهرسة، البحث، توليد “issues/conflicts/rewrite”.
- **Tenant DB (منصة sam داخل tenant DB)** يملك: metadata الحوكمة، ربط المستند بالعمليات/المخاطر، tasks، drafts، integrity runs/findings، queues مشتقة.
- **Platform DB** يملك: مكتبة المجموعة (Group Library) `sam_group_library_documents` (قوالب مشتركة على مستوى group).

### 2.2 حدود الأمان/الضوابط
- Drafts “اقتراحات” وليست اعتماد نهائي.
- قاعده: org profile/setup قد تمنع تشغيل بعض التحليلات أو تعرض رسائل توجيه.

---

## 3) نقاط الدخول والحراسة (Entry points & Guards)

### 3.1 بوابة منصة SAM (Entitlement + Auth)
- **Route**: `/platforms/sam`  
  **File**: `app/platforms/sam/page.tsx`  
  **المسؤولية**:
  - تحقق auth-token (Edge) عبر `verifyTokenEdge`.
  - منع owner من دخول tenants بدون approved access (إلا owner tenant).
  - التحقق من entitlement `payload.entitlements?.sam`.
  - redirect النهائي إلى `/sam/home`.

### 3.2 حارس /sam/** (source of truth)
- **File**: `app/(dashboard)/sam/layout.tsx`
- يعمل Server-side على كل `/sam/**`:
  - يتحقق من وجود token.
  - يتحقق من JWT payload و `activeTenantId`.
  - يتحقق entitlement عبر `isPlatformEnabled(tenantId,'sam')`.
  - إذا مسموح: يلف كل الصفحات بـ `SamOrgProfileGate`.

### 3.3 بوابة Org Profile في الواجهة (setup gate + context header)
- **File**: `components/sam/SamOrgProfileGate.tsx`
- **سلوكها**:
  - تستدعي `/api/sam/org-profile`.
  - إذا setupComplete=false وكانت الصفحة ليست `/sam/setup` → redirect إلى `/sam/setup?returnTo=...`
  - تعرض “Context Header” دائماً فوق محتوى صفحات SAM عند توفر الـ profile.

---

## 4) Organization Profile & Context Rules

### 4.1 البيانات (Organization Profile)
- **Model**: `lib/models/OrganizationProfile.ts`
- **الـ API**: `app/api/sam/org-profile/route.ts`
  - `GET`: يرجع profile + `setupComplete`.
  - `POST`: upsert مع validation (zod) + normalization + audit diff.
  - يسجل audit event: `org_profile_updated` مع before/after + diff.

### 4.2 تطبيع البيانات (Normalization)
- **File**: `lib/sam/orgProfile.ts`
  - `normalizeOrganizationType` (catalog match أو slugify).
  - `normalizeStandards` (dedupe + known standards + تحسين تنسيق).
  - `deriveRiskProfile` بناء على maturityStage + onboardingPhase.
  - `isOrgProfileSetupComplete`.

### 4.3 Context Rules (مشتقة من Org Profile)
- **File**: `lib/sam/contextRules.ts`
  - المخرجات:
    - `strictnessLevel`: lenient | balanced | strict
    - `tone`: coaching | operational | audit
    - `preferReuse`: boolean (إذا org ضمن group)
    - `suppressAdvancedConflicts`: boolean (خاصة للـ New/ Foundation)
    - `priorities`: قائمة أولويات (foundation_gaps, audit_readiness, …)
  - `getOrgContextSnapshot(req, tenantId, departmentId?)`:
    - يقرأ/ينشئ profile إن لم يوجد.
    - يشتق rules.
    - يعيد snapshot للاثنين.

### 4.4 Snapshotting (التتبّع Traceability)
SNAPSHOTS يتم تضمينها في:
- `policy_documents` (عند ingest)
- `draft_documents` (عند create/version/publish)
- `integrity_runs` (عند تشغيل integrity)
- policy-engine requests (headers/body عبر gateway)

---

## 5) Work Queues (المحور الأساسي للـ UX)

### 5.1 الصفحة
- **Route**: `/sam/home`
- **File**: `app/(dashboard)/sam/home/page.tsx`
- تستدعي:
  - departments: `/api/structure/departments`
  - queues: `/api/sam/queues?departmentId=...`
  - actions: `/api/sam/queues/actions`
  - create_missing: `/api/sam/drafts/create-missing`
  - reuse_from_group: يفتح `/sam/group-library?operationId=...&requiredType=...`

### 5.2 الـ API الذي يبني الطوابير
- **File**: `app/api/sam/queues/route.ts`
- **Queue types** (ثابت):
  - `high_risk_gaps`
  - `required_missing`
  - `conflicts_to_review`
  - `lifecycle_alerts`
  - `my_tasks`

### 5.3 قاعدة “clean-slate invariant”
داخل `/api/sam/queues`:
- إذا كان `policy_documents` النشطة = 0 → يرجع كل queues=0  
هدفها: منع ظهور findings/tasks التاريخية على tenant نظيف.

### 5.4 مصادر البيانات لكل Queue
- **High-Risk Gaps**:
  - مصدرها: `integrity_findings` (status OPEN/IN_REVIEW + severity HIGH/CRITICAL).
  - actions: ack/resolve/snooze.
  - deep-link: `/integrity?queueType=high_risk_gaps...`
- **Conflicts to Review**:
  - مصدرها: `integrity_findings` مع heuristic `isConflictFinding`.
  - deep-link: `/sam/policies/conflicts?queueType=conflicts_to_review&sourceId=...`
- **Lifecycle Alerts**:
  - مصدرها: `policy_documents` حيث status ∈ EXPIRING_SOON/EXPIRED.
  - deep-link: `/sam/policies/library?queueType=lifecycle_alerts...`
- **My Tasks**:
  - مصدرها: `document_tasks` حسب assigneeUserId/email.
  - action محتمل: assign to me.
  - deep-link: `/sam/policies/library?queueType=my_tasks&documentId=...`
- **Required / Missing**:
  - إذا يوجد department filter:
    - يستنتج العمليات الموجودة من `policy_documents.classification.operations`.
    - يشتق required types عبر `getRequiredTypesForOperation` من `lib/sam/coverageTemplates.ts`.
    - يحسب المفقود حسب `entityType` الموجود (Policy/SOP/Workflow).
    - يعرض action: create_missing (+ reuse_from_group إذا enabled).
  - بدون department:
    - ينظر للـ `taxonomy_operations` ويحسب العمليات التي لا يوجد عليها أي mapping.

### 5.5 تنفيذ Actions + Audit
- **File**: `app/api/sam/queues/actions/route.ts`
- `ack/resolve/snooze`:
  - يحدّث `integrity_findings` بالحالة + timestamps + actor.
  - يسجل audit: `queue_item_ack|resolve|snooze`
- `assign`:
  - يحدّث `document_tasks` بالحقل assignee*.
  - يسجل audit: `queue_item_assign`

---

## 6) Drafts (Draft-first authoring)

### 6.1 إنشاء Draft من “Missing required type”
- **Endpoint**: `POST /api/sam/drafts/create-missing`
- **File**: `app/api/sam/drafts/create-missing/route.ts`
- **المدخلات**: `operationId`, `requiredType`, (اختياري: `departmentId`)
- **المنطق**:
  - يقرأ snapshot: `getOrgContextSnapshot`.
  - يجلب operation name من `taxonomy_operations`.
  - ينشئ draft نصّي Markdown عبر OpenAI (`getOpenAI`) مع system/user prompts واضحة.
  - يحسب `promptHash` (sha256) للتتبّع.
  - يحفظ في `draft_documents` مع:
    - `versions[0]` (model, promptHash, inputs includes snapshots)
    - `orgProfileSnapshot`, `contextRulesSnapshot`
  - Audit: `draft_created`
- **Response**: `{ redirectTo: "/sam/drafts/:draftId" }`

### 6.2 صفحة عرض/تحرير Draft
- **Route**: `/sam/drafts/:draftId`
- **File**: `app/(dashboard)/sam/drafts/[draftId]/page.tsx`
- عمليات:
  - GET draft: `/api/sam/drafts/:draftId`
  - Save version: `/api/sam/drafts/:draftId/versions`
  - Publish: `/api/sam/drafts/:draftId/publish`

### 6.3 إنشاء Version جديد (Human edit)
- **Endpoint**: `POST /api/sam/drafts/:draftId/versions`
- **File**: `app/api/sam/drafts/[draftId]/versions/route.ts`
- يضيف نسخة `model: "human_edit"`.
- Audit: `draft_version_created`.

### 6.4 Publish draft → policy-engine ingest → تحديث draft status
- **Endpoint**: `POST /api/sam/drafts/:draftId/publish`
- **File**: `app/api/sam/drafts/[draftId]/publish/route.ts`
- يرسل ملف Markdown إلى `${POLICY_ENGINE_URL}/v1/ingest` (FormData).
- يمرر `orgProfile/contextRules` أيضاً.
- ثم:
  - يحدث `draft_documents.status = published`
  - يحفظ `publishedPolicyEngineId`
  - Audit: `draft_published`
- redirectTo: `/sam/policies/library`

---

## 7) Group Library (Reuse from group)

### 7.1 صفحة الواجهة
- **Route**: `/sam/group-library`
- **File**: `app/(dashboard)/sam/group-library/page.tsx`
- تحميل: `GET /api/sam/group-library/list`
- إعادة استخدام: `POST /api/sam/group-library/reuse` + optional adaptationNotes.

### 7.2 API list (Platform DB)
- **File**: `app/api/sam/group-library/list/route.ts`
- يعتمد على orgProfile: `isPartOfGroup && groupId`.
- يقرأ من platform db: `sam_group_library_documents`.

### 7.3 API reuse (يحفظ Draft محلي)
- **File**: `app/api/sam/group-library/reuse/route.ts`
- ينشئ draft جديد:
  - `versions[0].model = "group_reuse"`
  - `reuseSource` يحفظ groupId + groupDocumentId + adaptationNotes
  - snapshots: orgProfile/contextRules
- Audit: `draft_reused_from_group`

---

## 8) Library (Documents execution view)

### 8.1 صفحة المكتبة
- **Route**: `/sam/policies/library`
- **File**: `app/(dashboard)/sam/policies/library/page.tsx`
- **مفهومها**: عرض موحّد يجمع:
  - policy-engine: قائمة الملفات وحالتها (READY/PROCESSING/…)
  - tenant DB: metadata الحوكمة + operational mapping + tasks + integrity
- تدعم:
  - search/filter/pagination
  - upload (AI preview classify + ingest)
  - edit metadata
  - bulk actions (archive/delete/reassign/mark scope)
  - run lifecycle automation
  - run integrity على selection أو على filters

### 8.2 API list (join PE + Mongo metadata)
- **Endpoint**: `GET /api/sam/library/list`
- **File**: `app/api/sam/library/list/route.ts`
- آليات مهمة:
  - إذا يوجد `search` → يستخدم `policyEngineSearch` ثم يضيق القائمة للنتائج.
  - `upsertPolicyEnginePolicies`: يضمن وجود/تحديث وثائق `policy_documents` بالمعلومات الأساسية القادمة من PE.
  - enrich:
    - `taskCount` من `document_tasks` aggregation
    - `integrityOpenCount` من `integrity_findings` aggregation
    - `integrityRunStatus` من `integrity_runs` إذا RUNNING/QUEUED على هذا doc
    - lifecycleStatus يحسب via `evaluateLifecycle` (`lib/sam/lifecycle.ts`)
- permissions:
  - `permissionKey: 'sam.library.list'`

### 8.3 API metadata (قراءة/تحديث)
- **Endpoint**:
  - `GET /api/sam/library/metadata?policyEngineId=...`
  - `PUT /api/sam/library/metadata`
- **File**: `app/api/sam/library/metadata/route.ts`
- ملاحظات مهمة:
  - تحديث metadata يمكنه:
    - تحديث `operationIds` و/أو `classification.operations`
    - تحديد `operationalMappingNeedsReview` إذا فيه tokens لم تُحل
    - تحديث `operation_documents` links عبر `replaceOperationLinks` (`lib/sam/operationLinks.ts`)
  - بعد تحديث mapping/department/scope/entityType… → trigger integrity run (best-effort) على الوثيقة.
- permissions:
  - read: `sam.library.metadata.read`
  - write: `sam.library.metadata.write`

### 8.4 API bulk actions
- **Endpoint**: `POST /api/sam/library/bulk-action`
- **File**: `app/api/sam/library/bulk-action/route.ts`
- actions:
  - delete: يحذف من policy-engine أولاً ثم يحذف محلياً (policy_documents + policy_chunks)
  - archive/unarchive
  - reassign-departments
  - mark-global / mark-shared
- permission: `sam.library.bulk-action`

### 8.5 عرض الملف (proxy)
- **Endpoint**: `GET /api/sam/library/view-file?policyEngineId=...`
- **File**: `app/api/sam/library/view-file/route.ts`
- يعمل proxy لـ `policyEngineGetFile` ويعيد stream للملف.
- permission: `sam.library.view-file`

### 8.6 Upload dialog + AI preview classify
- **Component**: `components/sam/library/LibraryUploadDialog.tsx`
- تدفق:
  1) اختيار classification (scope/entityType/departments/dates/tagsStatus)
  2) اختيار ملفات
  3) `POST /api/sam/policy-engine/preview-classify` لتحليل واقتراح mappings
  4) `POST /api/sam/policy-engine/ingest` ثم `PUT /api/sam/library/metadata` لتثبيت metadata/mapping

---

## 9) Policy Engine Gateway (قلب قدرات المستندات)

### 9.1 لماذا Gateway؟
SAM لا يتعامل مباشرة مع policy-engine من المتصفح. بدلاً من ذلك:
- Next API routes تعمل كـ gateway/proxy وتضيف:
  - `tenantId`
  - `orgProfile/contextRules` (headers أو body)
  - تحقق org profile gate في بعض المسارات
  - error shaping + serviceUnavailable flags

### 9.2 الملف المحوري لتجميع “context headers/body”
- **File**: `lib/sam/policyEngineGateway.ts`
- وظائف مثل:
  - `policyEngineSearch`
  - `policyEngineListPolicies`
  - `policyEngineGetFile`
  - `policyEngineDeletePolicy`
  - `policyEngineReprocessPolicy`
  - `policyEngineRewritePolicy`
- يضيف headers:
  - `x-org-profile`
  - `x-context-rules`

### 9.3 أهم Routes في gateway
- `POST /api/sam/policy-engine/ingest`  
  **File**: `app/api/sam/policy-engine/ingest/route.ts`  
  - يرسل FormData إلى `${POLICY_ENGINE_URL}/v1/ingest`
  - يتحقق OrgProfileRequired من `getTenantContext`
  - يثبت metadata مباشرة في `policy_documents` بعد ingest:
    - `entityType`, `scope`, `departmentIds`, `operationIds`, snapshots، إلخ
  - يحدّث `operation_documents` عبر `replaceOperationLinks`
  - يشغّل integrity run best-effort بعد ingest

- `POST /api/sam/policy-engine/preview-classify`  
  **File**: `app/api/sam/policy-engine/preview-classify/route.ts`  
  - يرسل الملفات إلى `${POLICY_ENGINE_URL}/v1/ingest/preview-classify`
  - ثم يحاول **مطابقة اقتراحات** policy-engine مع catalog عندكم:
    - departments (org_nodes/floor_departments من tenant db)
    - operations/functions/risk-domains (taxonomies)
    - entity types / scopes / sectors (tenant taxonomy collections)
  - يعيد نتائج enriched تشمل matchedId/resolvedIds + mappingStatus/confidence

- `GET /api/sam/policy-engine/policies`  
  **File**: `app/api/sam/policy-engine/policies/route.ts`  
  - يرجع `serviceUnavailable=true` بدلاً من error إذا policy-engine down

- `POST /api/sam/policy-engine/search`  
  **File**: `app/api/sam/policy-engine/search/route.ts`

- `POST /api/sam/policy-engine/conflicts`  
  **File**: `app/api/sam/policy-engine/conflicts/route.ts`

- `POST /api/sam/policy-engine/issues/ai`  
  **File**: `app/api/sam/policy-engine/issues/ai/route.ts`  
  - يعيد `serviceUnavailable=true` و `issues: []` إذا الخدمة down (بدون كسر UI).

- `POST /api/sam/policy-engine/policies/:policyId/rewrite`  
  **File**: `app/api/sam/policy-engine/policies/[policyId]/rewrite/route.ts`

---

## 10) Conflicts execution view

### 10.1 الصفحة
- **Route**: `/sam/policies/conflicts`
- **File**: `app/(dashboard)/sam/policies/conflicts/page.tsx`
- 3 أوضاع:
  - single
  - pair
  - global
- يعتمد على:
  - `GET /api/sam/policy-engine/policies` لجلب READY policies
  - `POST /api/sam/policy-engine/conflicts` للحصول على issues
  - `POST /api/sam/policy-engine/issues/ai` لSystem Review
  - `POST /api/sam/policy-engine/policies/:id/rewrite` لإعادة صياغة
- يدعم حفظ rewrittenPolicies في localStorage + تنزيل نص/PDF (client-side).

---

## 11) Integrity (تحليل مستمر + dedupe)

### 11.1 الموديلات
- **Model**: `lib/models/Integrity.ts`
  - `IntegrityRun` / `IntegrityFinding` / `IntegrityEvidence`

### 11.2 أدوات dedupe والتلخيص
- **File**: `lib/sam/integrity.ts`
  - `buildDedupeKey` (sha256 من type+severity+docIds+summary+top evidence quotes)
  - `summarizeFindings`

### 11.3 تشغيل integrity
- **Endpoint**: `POST /api/sam/integrity/runs`
- **File**: `app/api/sam/integrity/runs/route.ts`
- Features:
  - dedupe runKey لتجنب تشغيل متكرر خلال 10 دقائق لنفس المعلمات
  - scope resolution:
    - selection (documentIds)
    - filter: يستدعي `/api/sam/library/list` لاستخراج documentIds حتى 500
  - **قاعدة صلبة**: إذا resolvedDocumentIds فارغة → لا ينتج findings (يحمي clean-slate)
  - sources:
    - type=conflicts → calls `/api/sam/policy-engine/conflicts`
    - type=issues → calls `/api/sam/policy-engine/issues/ai`
  - upsert findings حسب dedupeKey مع خيار `allowReopenResolved`
  - يحدث `policy_documents.integrityLastRunAt/Id`

### 11.4 قراءة findings لرن معين
- **Endpoint**: `GET /api/sam/integrity/runs/:runId/findings`
- **File**: `app/api/sam/integrity/runs/[runId]/findings/route.ts`

---

## 12) Operational Tasks

### 12.1 موديل
- `lib/models/DocumentTask.ts`

### 12.2 API
- **File**: `app/api/sam/documents/[documentId]/tasks/route.ts`
  - `GET`: list tasks
  - `POST`: create task
- **File**: `app/api/sam/documents/[documentId]/tasks/[taskId]/route.ts`
  - `PATCH`: update
  - `DELETE`: delete

### 12.3 الربط مع Work Queues
- Queue: `my_tasks` يعتمد على document_tasks ويدعم assign-to-me عبر `/api/sam/queues/actions`.

---

## 13) Lifecycle Automation (ملخص)

- **File**: `lib/sam/lifecycle.ts`
- `evaluateLifecycle(doc)` ينتج:
  - ACTIVE / EXPIRING_SOON / UNDER_REVIEW / EXPIRED / ARCHIVED
  - يحسب nextReviewDate من reviewCycleMonths إذا لم تُحدد.
  - rule: إذا مرّ >90 يوم بعد expiry → ARCHIVED.

> صفحة المكتبة تستدعي endpoint `POST /api/sam/policies/lifecycle/status` (المسار موجود بالمشروع ضمن `app/api/sam/policies/lifecycle/status/route.ts`) لتحديث حالات الوثائق بشكل مجمع.

---

## 14) فهرس الملفات (SAM File Index)

### 14.1 وثائق SAM
- `docs/SAM_BOUNDARIES.md`: حدود SAM + freeze + ownership + guardrails.
- `docs/SAM_CONTEXT_RULES.md`: قواعد context rules + traceability.
- `docs/SAM_QA_RUNBOOK.md`: خطة اختبار end-to-end لـ SAM.
- `docs/SAM_PLATFORM_KNOWLEDGE_BASE_AR.md`: (هذا الملف) قاعدة معرفة SAM.

### 14.2 صفحات الـ Dashboard (SAM UI)
هذه هي الملفات الموجودة تحت `app/(dashboard)/sam/**`:

- `app/(dashboard)/sam/layout.tsx`: server-side entitlement/auth guard + يلف `SamOrgProfileGate`.
- `app/(dashboard)/sam/page.tsx`: redirect إلى `/sam/home`.
- `app/(dashboard)/sam/home/page.tsx`: Work Queues UI + actions.
- `app/(dashboard)/sam/setup/page.tsx`: إعداد org profile (orgType/maturity/group/standards/phase).
- `app/(dashboard)/sam/drafts/[draftId]/page.tsx`: عرض/تحرير/publish draft.
- `app/(dashboard)/sam/group-library/page.tsx`: اختيار قالب من group + إنشاء draft.
- `app/(dashboard)/sam/policies/library/page.tsx`: Library execution view (filters/upload/metadata/bulk/integrity).
- `app/(dashboard)/sam/policies/conflicts/page.tsx`: Conflicts scan + AI review + rewrite.

### 14.3 مدخل المنصة
- `app/platforms/sam/page.tsx`: نقطة الدخول العامة (entitlements + owner guard) ثم redirect.

### 14.4 Components خاصة بـ SAM
هذه هي الملفات الموجودة تحت `components/sam/**`:

- `components/sam/SamOrgProfileGate.tsx`: client gate + context header + redirect setup.
- `components/sam/library/LibraryUploadDialog.tsx`: upload + preview-classify + ingest + metadata.
- `components/sam/library/LibraryMetadataDrawer.tsx`: edit metadata + إدارة tasks (CRUD).

### 14.5 مكتبات SAM (lib/sam)
هذه هي الملفات الموجودة تحت `lib/sam/**`:

- `lib/sam/contextRules.ts`: بناء context rules + تحميل orgProfile snapshot.
- `lib/sam/coverageRules.ts`: قواعد تغطية (coverage) لتحديد expected docs.
- `lib/sam/coverageTemplates.ts`: قوالب تغطية + `getRequiredTypesForOperation` (تُستخدم في Required/Missing).
- `lib/sam/integrity.ts`: dedupeKey + summaries.
- `lib/sam/lifecycle.ts`: evaluateLifecycle.
- `lib/sam/operationLinks.ts`: إدارة collection `operation_documents` (replace/get).
- `lib/sam/orgProfile.ts`: normalization + derived risk + setupComplete.
- `lib/sam/overlaySuggestions.ts`: اقتراحات overlays/سياق (تستخدم في تخصيص التجربة).
- `lib/sam/policyEngineGateway.ts`: gateway helper functions + context headers/body.
- `lib/sam/taxonomyMatch.ts`: similarity + findBestMatch.
- `lib/sam/tenantContext.ts`: tenant context packs/overlays merge + defaults.

---

## 15) فهرس Routes تحت `/app/api/sam` (كامل)

> هذه قائمة **دقيقة** (87 ملف) لمسارات SAM كما هي في الشجرة تحت `app/api/sam/**/route.ts`.

```text
app/api/sam/ai/policy-assistant/route.ts
app/api/sam/ai/policies/upload/route.ts
app/api/sam/debug/operation-links/route.ts
app/api/sam/debug/tenant-reset-state/route.ts
app/api/sam/documents/export/route.ts
app/api/sam/documents/suggestions/route.ts
app/api/sam/documents/[documentId]/task-draft/route.ts
app/api/sam/documents/[documentId]/tasks/route.ts
app/api/sam/documents/[documentId]/tasks/suggest/route.ts
app/api/sam/documents/[documentId]/tasks/[taskId]/route.ts
app/api/sam/drafts/create-missing/route.ts
app/api/sam/drafts/[draftId]/publish/route.ts
app/api/sam/drafts/[draftId]/route.ts
app/api/sam/drafts/[draftId]/versions/route.ts
app/api/sam/group-library/list/route.ts
app/api/sam/group-library/reuse/route.ts
app/api/sam/integrity/activity/route.ts
app/api/sam/integrity/findings/[findingId]/apply/route.ts
app/api/sam/integrity/findings/[findingId]/route.ts
app/api/sam/integrity/reset/route.ts
app/api/sam/integrity/rulesets/route.ts
app/api/sam/integrity/rulesets/[rulesetId]/route.ts
app/api/sam/integrity/runs/route.ts
app/api/sam/integrity/runs/[runId]/cancel/route.ts
app/api/sam/integrity/runs/[runId]/findings/route.ts
app/api/sam/integrity/runs/[runId]/route.ts
app/api/sam/library/backfill-operation-ids/route.ts
app/api/sam/library/bulk-action/route.ts
app/api/sam/library/list/route.ts
app/api/sam/library/metadata/route.ts
app/api/sam/library/view-file/route.ts
app/api/sam/operational/gaps/route.ts
app/api/sam/operational/operation/[id]/route.ts
app/api/sam/operational/summary/route.ts
app/api/sam/operations/overview/route.ts
app/api/sam/operations/[operationId]/details/route.ts
app/api/sam/org-profile/route.ts
app/api/sam/policies/ai-ask/route.ts
app/api/sam/policies/ai-create/route.ts
app/api/sam/policies/ai-harmonize/route.ts
app/api/sam/policies/ai-summarize/route.ts
app/api/sam/policies/bulk-actions/route.ts
app/api/sam/policies/bulk-operations/route.ts
app/api/sam/policies/bulk-upload/route.ts
app/api/sam/policies/classify/route.ts
app/api/sam/policies/delete-all/route.ts
app/api/sam/policies/draft/route.ts
app/api/sam/policies/enrich-operations/route.ts
app/api/sam/policies/fix-entity-type/route.ts
app/api/sam/policies/lifecycle/alerts/route.ts
app/api/sam/policies/lifecycle/status/route.ts
app/api/sam/policies/list/route.ts
app/api/sam/policies/search/route.ts
app/api/sam/policies/tag-review-queue/route.ts
app/api/sam/policies/upload/route.ts
app/api/sam/policies/view/[id]/route.ts
app/api/sam/policies/policy-builder/gap-analysis/route.ts
app/api/sam/policies/policy-builder/generate/route.ts
app/api/sam/policies/policy-builder/save-draft/route.ts
app/api/sam/policies/policy-builder/validate-role/route.ts
app/api/sam/policies/[id]/actions/route.ts
app/api/sam/policies/[id]/archive/route.ts
app/api/sam/policies/[id]/rename/route.ts
app/api/sam/policies/[id]/replace/route.ts
app/api/sam/policies/[id]/rerun-tagging/route.ts
app/api/sam/policies/[id]/suggest-tags/route.ts
app/api/sam/policies/[id]/update-metadata/route.ts
app/api/sam/policy-engine/conflicts/analyze/route.ts
app/api/sam/policy-engine/conflicts/analyze/[analysisId]/progress/route.ts
app/api/sam/policy-engine/conflicts/resolve/route.ts
app/api/sam/policy-engine/conflicts/route.ts
app/api/sam/policy-engine/generate/route.ts
app/api/sam/policy-engine/health/route.ts
app/api/sam/policy-engine/harmonize/route.ts
app/api/sam/policy-engine/ingest/route.ts
app/api/sam/policy-engine/issues/ai/route.ts
app/api/sam/policy-engine/jobs/[jobId]/route.ts
app/api/sam/policy-engine/policies/route.ts
app/api/sam/policy-engine/policies/[policyId]/file/route.ts
app/api/sam/policy-engine/policies/[policyId]/reprocess/route.ts
app/api/sam/policy-engine/policies/[policyId]/rewrite/route.ts
app/api/sam/policy-engine/policies/[policyId]/route.ts
app/api/sam/policy-engine/policies/[policyId]/text/route.ts
app/api/sam/policy-engine/preview-classify/route.ts
app/api/sam/policy-engine/search/route.ts
app/api/sam/queues/actions/route.ts
app/api/sam/queues/route.ts
```

---

## 16) Audit events (الأحداث المدقّقة)

الأحداث المؤكدة في SAM v1.0 (حسب `docs/SAM_QA_RUNBOOK.md` + الكود):
- `org_profile_updated`
- `queue_item_ack`
- `queue_item_resolve`
- `queue_item_snooze`
- `queue_item_assign`
- `draft_created`
- `draft_version_created`
- `draft_reused_from_group`
- `draft_published`

---

## 17) خرائط البيانات (Collections) — “أين تُخزن الأشياء؟”

> الأسماء هنا هي “أسماء collections المنطقية” التي تُستخدم في `getTenantCollection(req, name, 'sam')`. على مستوى DB قد تُسبق بـ `sam_` حسب تطبيق platform scoping.

### 17.1 `organization_profiles`
- يكتب/يقرأ: `/api/sam/org-profile`
- يستخدم للـ gating + context header + contextRules.

### 17.2 `policy_documents`
- يكتب:
  - gateway ingest يثبت metadata بعد policy-engine ingest
  - library metadata PUT
  - integrity runs يحدث lastRunAt/Id
- يقرأ:
  - library list/join
  - queues (lifecycle/required_missing)

### 17.3 `draft_documents`
- يكتب:
  - create-missing
  - reuse-from-group
  - versions
  - publish (تحديث status)
- يقرأ:
  - draft GET

### 17.4 `document_tasks`
- CRUD:
  - `/api/sam/documents/:id/tasks` (+/:taskId)
  - queue assign action
- يقرأ:
  - queues: my_tasks
  - library list: taskCount aggregation

### 17.5 `integrity_runs` / `integrity_findings` / `integrity_activity`
- تشغيل: `/api/sam/integrity/runs`
- قراءة findings: `/api/sam/integrity/runs/:runId/findings`
- queues: high_risk_gaps + conflicts_to_review تعتمد على findings.

### 17.6 `taxonomy_operations` (+ functions/risk_domains)
- تستخدم لـ:
  - required_missing queue
  - preview-classify matching
  - metadata operationId resolution

### 17.7 `operation_documents`
- يكتب/يستبدل عبر `replaceOperationLinks` عند:
  - metadata updates
  - ingest (إذا operations موجودة)
- هدفه: ربط سريع operationId ↔ documentId.

---

## 18) كيف نختبر SAM بسرعة (ملخص عملي)

اتبع `docs/SAM_QA_RUNBOOK.md`، وأهم مسار smoke:
- `/sam` → يروح `/sam/home`
- إذا setup ناقص → `/sam/setup` → حفظ → رجوع
- Work Queues → نفّذ ack/resolve/assign
- Required/Missing → Create missing → Draft → Save version → Publish → يظهر في Library
- Upload → Preview classify → Confirm upload → Metadata → Run integrity

---

## 19) نقاط “حساسة” لازم تظل ثابتة (Hard invariants)

- **SAM access control** مصدره layout `app/(dashboard)/sam/layout.tsx`.
- **clean-slate invariant** داخل `/api/sam/queues` + integrity runs (لا findings بدون documents).
- **OrgProfileRequired** لبعض قدرات policy-engine (ingest/conflicts/preview) لضمان context.
- **Snapshotting** لكل عمليات AI/analysis/publish لضمان traceability.

