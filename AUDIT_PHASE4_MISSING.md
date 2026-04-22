# AUDIT PHASE 4 -- Missing Features & Incomplete Work

**Auditor:** Claude Opus 4.6 (Senior QA)
**Date:** 2026-04-01
**Scope:** Thea full-stack -- EHR, CVision (HR), SAM (Governance), Imdad (Supply Chain)

---

## 4.1 Started but Not Finished

### 4.1.1 TODO / FIXME Comments (Critical Unfinished Work)

| Severity | File | Line | TODO |
|----------|------|------|------|
| **HIGH** | `lib/core/org/structure.ts` | 25 | "TODO: Create a Prisma model `OrgNode` with all fields from the OrgNode interface." |
| **HIGH** | `lib/core/org/structure.ts` | 486 | "TODO: Implement actual checks against real Prisma models (users, encounters, etc.)" |
| **HIGH** | `lib/core/org/structure.ts` | 500 | "TODO: Implement reassignment against real Prisma models." -- Function is a no-op stub |
| **HIGH** | `lib/services/structureService.ts` | 7 | "TODO: Create Prisma models for Floor, FloorDepartment, FloorRoom to replace raw SQL." |
| **HIGH** | `lib/services/structureService.ts` | 27 | "TODO: Replace with prisma.floor.findMany once Floor model is created." |
| **HIGH** | `lib/sam/operationLinks.ts` | 6 | "TODO: Add Prisma model for operation_documents when SAM module is migrated" |
| **HIGH** | `lib/sam/tenantContext.ts` | 78 | "TODO: Add Prisma models for tenant_context_packs and tenant_context_overlays" |
| **MEDIUM** | `lib/core/subscription/middleware.ts` | 52 | "TODO: Add subscription status to JWT payload at login" |
| **MEDIUM** | `lib/utils/translation.ts` | 14 | "TODO: Integrate with translation service (e.g., Google Translate API, DeepL, etc.)" |
| **MEDIUM** | `lib/workflow/escalation.ts` | 334 | "TODO: Add flag/isRead columns to LabResult model or use a different approach." |
| **LOW** | `scripts/bulk-apply-wrapper.ts` | 121 | "TODO: Migrate existing handler logic here" |

### 4.1.2 Stub / Skeleton Modules (Return Empty or Hardcoded Data)

| Severity | File | Description |
|----------|------|-------------|
| **CRITICAL** | `lib/ai/cv-analyzer.ts` | Entire module is a stub. `analyzeCV()` returns `{ skills: [], experience: [], education: [], summary: 'CV analysis not yet implemented' }`. CVision recruitment depends on this. |
| **CRITICAL** | `lib/ai/cv-matcher.ts` | Entire module is a stub. `aiMatchCandidateToJobs()` and `aiMatchJobToCandidates()` both return empty arrays. |
| **HIGH** | `lib/integrations/process-policy-check.ts` | Stub -- logs and returns `Promise.resolve()`. No actual policy checking. |
| **HIGH** | `lib/core/org/structure.ts:503` | `reassignNodeData` is explicitly commented as "a no-op stub" |
| **MEDIUM** | `app/api/imdad/integrations/sfda/track-trace/route.ts` | "Phase 5 stub -- actual SFDA endpoints TBD" |
| **MEDIUM** | `app/api/imdad/integrations/sfda/verify-drug/route.ts` | "Phase 5 stub -- actual SFDA endpoints TBD" |
| **MEDIUM** | `app/api/imdad/integrations/sfda/device-lookup/route.ts` | "Phase 5 stub -- actual SFDA endpoints TBD" |
| **MEDIUM** | `app/api/imdad/dashboard/summary/route.ts:287` | `budgetUtilization: 0` -- hardcoded placeholder |
| **MEDIUM** | `app/api/cvision/predictive/route.ts:86` | "Update parameters (placeholder)" |
| **MEDIUM** | `app/api/cvision/recruitment/candidates/[id]/documents/route.ts:7-8` | "metadata-only. Actual file storage (S3/etc.) not implemented yet. The storageKey is a placeholder." |
| **LOW** | `app/api/orders/[orderId]/results/route.ts:265` | Uses `provider: 'local_stub'` for storage |
| **LOW** | `app/api/attachments/route.ts:19` | Storage limited to `local_stub` and `s3_stub` -- no real S3/cloud implementation |

### 4.1.3 Mock/Simulation Dependencies in Production Code

| Severity | File | Description |
|----------|------|-------------|
| **HIGH** | `lib/identityProviders/index.ts` | Defaults to `mock` provider when `IDENTITY_PROVIDER` env var is not set. In production, patient identity lookups would return fabricated data. |
| **HIGH** | `app/api/cvision/absher/lookup/route.ts` | Entire API returns mock data with `source: 'mock'`. No real Absher integration. |
| **HIGH** | `lib/cvision/integrations/yaqeen/yaqeen-client.ts` | SIMULATION mode returns mock data. No indication of forced production mode. |
| **HIGH** | `lib/cvision/integrations/mudad/mudad-client.ts` | SIMULATION mode returns mock responses for WPS/Mudad. |
| **HIGH** | `lib/cvision/integrations/muqeem/muqeem-api-client.ts` | Returns mock data with `FAKE-IQM-*` prefixed IDs |
| **MEDIUM** | `lib/cvision/sms/sender.ts` | Defaults to `mock` SMS provider -- messages are logged, not sent |
| **MEDIUM** | `app/api/admission/requests/[id]/verify-insurance/route.ts:55` | "Fallback: mock eligibility for dev environments" |
| **MEDIUM** | `app/api/admission/requests/[id]/request-preauth/route.ts:111` | "Fallback: mock preauth for dev" |

### 4.1.4 Placeholder Content in UI

| Severity | File | Line | Description |
|----------|------|------|-------------|
| **MEDIUM** | `app/(dashboard)/pharmacy/controlled-substances/PharmacyControlledSubstances.tsx` | 173 | `witnessUserId: 'witness-placeholder'` -- hardcoded placeholder in controlled substances (regulatory concern) |
| **LOW** | `app/(website)/contact/ContactContent.tsx` | 302 | `{/* Map placeholder */}` -- map section not implemented |

---

## 4.2 Should Exist but Doesn't

### EHR (Thea Health)

| Feature | Status | Notes |
|---------|--------|-------|
| Medication Interactions | **EXISTS** | `app/api/pharmacy/drug-interactions/route.ts`, AI drug check at `app/api/ai/drug-check/route.ts` |
| Allergy Alerts | **EXISTS** | Allergy management at `app/api/patients/[id]/allergies/route.ts`, drug-allergy checks in pharmacy verify |
| Lab Notifications | **EXISTS** | Critical lab alerts at `app/api/lab/critical-alerts/route.ts` and `app/api/lab/critical-check/route.ts` |
| Appointment Reminders | **PARTIAL** | OPD booking confirmation at `app/api/opd/booking/[bookingId]/send-confirmation/route.ts` but no automated reminder system (no cron-based reminders before appointment) |
| Discharge Summaries | **EXISTS** | Full discharge workflow at `app/api/ipd/episodes/[episodeId]/discharge-summary/route.ts` and PDF export |
| Medical Reports Export | **EXISTS** | PDF endpoints: visit report, prescription, excuse, discharge summary, lab report at `app/api/pdf/*` |

### HR / CVision

| Feature | Status | Notes |
|---------|--------|-------|
| Overtime Calculation | **EXISTS** | Implemented in `app/api/cvision/attendance/route.ts` (calculate-overtime action) and nursing scheduling |
| Leave Balance | **EXISTS** | Leave management at `app/(dashboard)/cvision/leaves/page.tsx` |
| Document Management | **EXISTS** | Full document system at `app/(dashboard)/cvision/documents/page.tsx` with categories (ID, passport, certificate, contract, etc.) |
| Org Chart | **MISSING** | Website mentions it (`CVisionHRContent.tsx:109`) but no actual `org-chart` page or component exists. `app/(dashboard)/cvision/org/page.tsx` exists but is org structure, not a visual org chart. |
| Self-Service Portal | **EXISTS** | `app/(dashboard)/cvision/self-service/` with leaves, payslips, requests sub-pages |
| AI CV Analysis | **STUB** | Module exists but returns empty data. See section 4.1.2. |
| AI Candidate Matching | **STUB** | Module exists but returns empty data. See section 4.1.2. |

### SAM (Governance)

| Feature | Status | Notes |
|---------|--------|-------|
| Audit Trail | **PARTIAL** | Audit logging exists across the system (`lib/utils/audit.ts`, `lib/security/audit.ts`) but SAM has no dedicated audit trail viewer/dashboard |
| Compliance Dashboards | **MISSING** | No SAM-specific compliance dashboard. CBAHI compliance exists at `app/(dashboard)/admin/compliance/` but belongs to EHR admin, not SAM platform. SAM pages: home, library, drafts, conflicts, gaps, issues, assistant, setup -- no compliance dashboard. |
| Automated Reminders | **MISSING** | No automated document review reminders. SAM library has lifecycle status but no scheduled reminder system for expiring/overdue documents. |
| Evidence System | **MISSING** | CBAHI evidence upload exists at `app/api/compliance/cbahi/evidence/route.ts` but is under EHR admin, not SAM. SAM has no standalone evidence management system for compliance audits. |

### Imdad (Supply Chain)

| Feature | Status | Notes |
|---------|--------|-------|
| Inventory Alerts | **EXISTS** | Pharmacy inventory alerts at `app/api/pharmacy/inventory/alerts/route.ts`, Imdad dashboard alerts at `app/api/imdad/dashboard/recent-alerts/route.ts` |
| Vendor Comparison | **PARTIAL** | Top vendors dashboard at `app/api/imdad/dashboard/top-vendors/route.ts`, vendor audits at quality module, but no side-by-side vendor comparison tool |
| Budget Tracking | **EXISTS** | Full budget system at `app/api/imdad/financial/budgets/route.ts`, budget burn dashboard at `app/api/imdad/dashboard/budget-burn/route.ts` |
| Delivery Tracking | **MISSING** | Only SFDA track-trace stub exists. No PO/delivery status tracking, no shipment tracking, no ETA management. |
| Quality Inspection | **EXISTS** | Full quality inspection system at `app/api/imdad/quality/inspections/route.ts` with templates, NCR, recalls |
| Contract Expiry Alerts | **PARTIAL** | `CONTRACT_EXPIRY` signal type defined in `core/brain/ImdadBrain.ts` but implemented only in the AI brain simulation, not as real contract monitoring |

---

## 4.3 Skeleton Code

### Empty/Redirect-Only Pages

| File | Description |
|------|-------------|
| `app/(dashboard)/sam/page.tsx` | Redirect-only to `/sam/home` |
| `app/(dashboard)/opd/doctor-worklist/page.tsx` | Redirect-only to `/opd/doctor-station` |
| `app/(dashboard)/opd/home/page.tsx` | Redirect-only to `/opd/dashboard` |
| `app/(dashboard)/opd/doctor/schedule/page.tsx:7` | `return null;` -- completely empty page |
| `app/(dashboard)/opd/encounter/[encounterCoreId]/prescription-print/page.tsx:14` | `return null;` after redirect |
| `app/(dashboard)/opd/encounter/[encounterCoreId]/ophthalmology-report/page.tsx:14` | `return null;` after redirect |

### Functions Returning Hardcoded/Empty Values

| File | Function | Returns |
|------|----------|---------|
| `lib/ai/cv-analyzer.ts` | `analyzeCV()` | Empty arrays for skills, experience, education |
| `lib/ai/cv-analyzer.ts` | `matchToPositions()` | Empty array |
| `lib/ai/cv-matcher.ts` | `aiMatchCandidateToJobs()` | Empty array |
| `lib/ai/cv-matcher.ts` | `aiMatchJobToCandidates()` | Empty array |
| `lib/integrations/process-policy-check.ts` | `processPolicyCheck()` | `Promise.resolve()` (no-op) |
| `lib/core/org/structure.ts:500` | `reassignNodeData()` | No-op stub with warning log |

---

## Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Unfinished TODOs | 0 | 7 | 4 | 1 |
| Stub Modules | 2 | 4 | 6 | 2 |
| Missing Expected Features | 0 | 4 | 3 | 0 |
| Skeleton Code | 2 | 0 | 1 | 3 |
| **Total** | **4** | **15** | **14** | **6** |

**Top Priority Items:**
1. **CV Analyzer and CV Matcher stubs** -- CVision recruitment is non-functional for AI features
2. **SAM missing compliance dashboard, evidence system, and automated reminders** -- Core governance features absent
3. **Imdad delivery tracking** -- No shipment/PO delivery tracking exists
4. **Org Chart for CVision** -- Advertised on website but not implemented
5. **Mock integrations defaulting in production** -- Identity provider, Absher, Yaqeen, Muqeem, SMS all default to mock mode
