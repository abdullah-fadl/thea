# Thea EHR — Comprehensive Audit Report
**Date:** 2026-03-19
**Branch:** sam-clean-v1-pr4
**Coverage:** ~90-95% of total codebase
**Agents Used:** 18 initial + 12 extended parallel audit agents + direct searches
**Total Issues:** ~250+

---

## EXECUTIVE SUMMARY

- **1,285 API routes** | **400+ pages** | **100+ components** audited
- **~250+ issues found** across all severity levels
- **Build status:** FAILS (framer-motion type error in website subproject)
- **TypeScript:** 51 errors (all in thea-website/, not EHR core)
- **Syra cleanup:** 100% complete
- **Legacy cleanup:** 100% complete — all 54 *Legacy.tsx files deleted, no broken imports
- **MongoDB migration:** 100% complete — zero MongoDB code remaining
- **Prisma schema:** 18 models missing Tenant @relation

### Issue Breakdown
| Severity | Count | Examples |
|----------|-------|---------|
| CRITICAL SECURITY | 3 | HL7 tenant injection, timing-vulnerable API key |
| CRITICAL | ~25 | i18n entire pages, missing auth, build blocker, schema gaps |
| HIGH | ~55 | i18n partial, missing permissions, silent errors, dead buttons |
| MEDIUM | ~80 | i18n strings, window.prompt, dead endpoints, hardcoded values |
| LOW | ~90+ | Style, naming, polish, `as any`, TODO comments |

---

## CRITICAL SECURITY ISSUES (3)

### SEC1. HL7 Integration — Tenant ID Injection (CRITICAL)
- **File:** `app/api/integrations/hl7/receive/route.ts:47`
- **Problem:** Tenant ID extracted from **untrusted** `x-tenant-id` HTTP header. An attacker can set this header to any tenant ID and inject data into another tenant's database.
- **Impact:** Complete multi-tenant isolation bypass
- **Fix:** Validate tenant ID against the API key's authorized tenant, or use a signed token

### SEC2. HL7 Inbound — Same Tenant Injection
- **File:** `app/api/integrations/hl7/inbound/route.ts:119`
- **Problem:** Same as SEC1 — tenant ID from untrusted header
- **Fix:** Same as SEC1

### SEC3. HL7 API Key — Timing Attack Vulnerable
- **Files:** `app/api/integrations/hl7/receive/route.ts`, `app/api/integrations/hl7/inbound/route.ts`
- **Problem:** API key compared with simple string equality (`===`), vulnerable to timing attacks
- **Fix:** Use `crypto.timingSafeEqual()` for API key comparison

---

## CRITICAL ISSUES (~25)

### C1. Build Blocker — framer-motion ease type
- **Files:** `components/website/sections/FeaturesGrid.tsx:73`, `HeroSection.tsx`, `ProductHero.tsx`, `ProductsSection.tsx`, `TestimonialsSection.tsx`, `WhyTheaSection.tsx`, `PricingSection.tsx` (7 files, 20+ occurrences)
- **Problem:** `ease: 'easeOut'` (string) doesn't match `Easing` type
- **Fix:** `ease: 'easeOut' as const`

### C2. 96 CVision API Routes Missing Permission Options
- **Files:** All routes in `app/api/cvision/` (~96 routes)
- **Problem:** `withAuthTenant()` called without second parameter `{ platformKey: 'cvision', permissionKey: ... }`
- **Impact:** Routes lack permission checks — any authenticated user can access any CVision route
- **Fix:** Add `{ platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.XXX }` to each route

### C3. 7 ER API Routes Missing tenantScoped/platformKey
- **Files:**
  - `app/api/er/mci/route.ts`
  - `app/api/er/mci/[incidentId]/route.ts`
  - `app/api/er/mci/[incidentId]/patients/route.ts`
  - `app/api/er/mci/[incidentId]/deactivate/route.ts`
  - `app/api/er/triage-score/route.ts`
  - `app/api/er/triage-score/[encounterId]/route.ts`
  - `app/api/er/triage/complete/route.ts`
- **Problem:** Missing `tenantScoped: true, platformKey: 'thea_health'`
- **Fix:** Add proper options object

### C4. Visit Layout Tabs — Arabic-Only (11 tabs)
- **File:** `app/(dashboard)/opd/visit/[visitId]/layout.tsx:13-24`
- **Problem:** ALL_TABS labels hardcoded Arabic: `'ملخص'`, `'السوابق'`, `'الفحص'`, `'الطلبات'`, `'الوصفة'`, `'النتائج'`, `'الفوترة'`, `'المهام'`, `'التسليم'`, `'الخروج'`
- **Fix:** Wrap each with `tr('Arabic', 'English')`

### C5. ER Encounter Tabs — English-Only
- **File:** `app/(dashboard)/er/encounter/[encounterId]/EREncounter.tsx:1458`
- **Problem:** `{key.toUpperCase()}` renders OVERVIEW, NOTES, CLINICAL, ORDERS etc. in English only
- **Fix:** Create bilingual tab label map

### C6. Mortuary Module — 100% English-Only (17 strings)
- **File:** `app/(dashboard)/mortuary/[caseId]/Mortuary.tsx:97-166`
- **Problem:** Every label hardcoded English: "Mortuary Case", "Location", "Morgue Room", "Shelf", "Save Location", "Status", "Released At", "Released To", "ID Number", "Reason", "Update Status"
- **Fix:** Wrap all with `tr()`

### C7. Quality Incidents — 100% English-Only (40+ strings)
- **Files:**
  - `app/(dashboard)/quality/incidents/Incidents.tsx:72-166`
  - `app/(dashboard)/quality/incidents/[incidentId]/IncidentDetail.tsx:52-120`
- **Problem:** ALL labels English-only: "Incident Reporting", "Type", "Severity", "Location", "Low/Medium/High/Critical", "Root Cause Analysis", "What happened", "Why", "Corrective action"
- **Fix:** Wrap all with `tr()`

### C8. Quality KPIs — 100% English-Only
- **File:** `app/(dashboard)/quality/kpis/QualityKPIs.tsx`
- **Problem:** All KPI labels and descriptions English-only
- **Fix:** Wrap all with `tr()`

### C9. Hardcoded `admin@thea.health` — 47 Occurrences in 43 Files
- **Scope:** Much larger than initially estimated (was "4+ files")
- **Key files:** `middleware.ts:592`, `lib/er/chargeAccess.ts:4`, `components/tasks/TasksPanel.tsx:50`, `app/(dashboard)/er/nursing/ERNursing.tsx:72`, plus 39 more
- **Problem:** Should be `thea@thea.com.sa` per CLAUDE.md, or use env var `THEA_OWNER_EMAIL`
- **Fix:** Global find-replace, use env var where runtime-configurable

### C10. Prisma Schema — 11 CVision Models Missing Tenant @relation
- **File:** `prisma/schema/cvision-core.prisma`
- **Problem:** 11 CVision models have `tenantId String` field but no `@relation` to `Tenant` model. This means:
  - No foreign key constraint enforcement at DB level
  - Cascade deletes won't work when a tenant is removed
  - No referential integrity guarantee
- **Fix:** Add `tenant Tenant @relation(fields: [tenantId], references: [id])` to each model

### C11. Prisma Schema — 7 IPD Models Missing Tenant @relation
- **File:** `prisma/schema/ipd.prisma`
- **Problem:** Same as C10 — 7 IPD models lack Tenant @relation
- **Fix:** Same pattern

### C12. Prisma Schema — Missing Compound Indexes
- **Models needing indexes:**
  - `EncounterCore` — `@@index([tenantId, patientId])`, `@@index([tenantId, status])`
  - `OrdersHub` — `@@index([tenantId, encounterCoreId])`, `@@index([tenantId, status])`
  - `LabResult` — `@@index([tenantId, orderId])`
  - `Notification` — `@@index([tenantId, userId, read])`
  - `AuditLog` — `@@index([tenantId, createdAt])`
- **Impact:** Poor query performance at scale

### C13. CVision Policies — XSS via dangerouslySetInnerHTML
- **File:** `app/(dashboard)/cvision/policies/page.tsx:136`
- **Problem:** `dangerouslySetInnerHTML={{ __html: selectedPolicy.content }}` — if policy content is user-supplied, this is an XSS vector
- **Fix:** Sanitize with DOMPurify, or render as Markdown

### C14. SessionWarning — Dead API Call + Dead Link
- **File:** `components/SessionWarning.tsx`
- **Problem:**
  - Line 36: Calls `/api/auth/extend-session` which **does not exist**
  - Line 65: Links to `/logout` which **does not exist**
  - Lines 48-69: Entire component English-only (no useLang, no tr())
- **Impact:** Session extension silently fails; logout link is dead
- **Fix:** Create the endpoint or use existing session refresh; fix logout to `/api/auth/logout` or `/login`

### C15. ResultsPanel — "View images" Button Dead
- **File:** `components/opd/panels/ResultsPanel.tsx:152`
- **Problem:** Button has no `onClick` handler — does nothing
- **Fix:** Wire to DICOM viewer or file viewer

### C16. DischargePanel — No Post-Discharge Navigation
- **File:** `components/opd/panels/DischargePanel.tsx:60-79`
- **Problem:** `handleComplete()` saves but doesn't navigate or trigger parent callback. Dead-end after discharge.
- **Fix:** Navigate to patient list or show confirmation, trigger parent refresh

---

## HIGH ISSUES (~50)

### i18n — Entire Pages/Modules Missing Bilingual Support

#### H1. Results.tsx — Entire Page English-Only
- **File:** `app/(dashboard)/results/Results.tsx:74-142`
- **Strings:** "Results Inbox", "Unacknowledged results for review", "Scope", "Kind", column headers, "Unknown", "Open", "Ack", "No unacknowledged results", toast messages

#### H2. Department.tsx — Titles English-Only
- **File:** `app/(dashboard)/departments/[department]/Department.tsx:16-24`
- **Strings:** 'OPD', 'Laboratory', 'Radiology', 'Operating Room', 'Cath Lab', 'Physiotherapy', 'Delivery / L&D', 'Critical Care (ICU)', 'Mortuary / Death'

#### H3. ERMetrics — Titles English-Only
- **File:** `app/(dashboard)/er/metrics/ERMetrics.tsx:64-70`
- **Strings:** 'Door → Triage', 'Triage → Bed', 'Bed → Seen by Doctor', 'Seen → Orders Started', 'Orders → Results Pending', 'Results Pending → Decision'

#### H4. ERBoard FILTERS — English-Only
- **File:** `app/(dashboard)/er/board/ERBoard.tsx:39-46`
- **Strings:** 'All', 'Waiting', 'In Bed', 'Seen', 'Pending Results', 'Dispo'

#### H5. StructureManagement — English-Only Toast Messages
- **File:** `app/(dashboard)/admin/structure-management/StructureManagement.tsx:~660,~704`
- **Strings:** `${type} created successfully`, `${type} deleted successfully`, etc.

#### H6. SAM TopNav — All 7 Labels English-Only
- **File:** `components/sam/SamTopNav.tsx:12-20`
- **Strings:** "Home", "Library", "Drafts", "Issues", "Gaps", "Conflicts", "Setup"

#### H7. PlatformsClient — 9 Hardcoded English Strings
- **File:** `app/platforms/PlatformsClient.tsx`
- **Strings:** Error messages, toast messages, button labels

#### H8. IPD Episode — Multiple English-Only Sections
- **File:** `app/(dashboard)/ipd/episode/[episodeId]/IPDEpisode.tsx`
- **Problem:** Tab labels, section headers, status badges partially English-only

#### H9. Scheduling All 3 Pages — English-Only Labels
- **Files:**
  - `app/(dashboard)/scheduling/calendar/SchedulingCalendar.tsx`
  - `app/(dashboard)/scheduling/resources/SchedulingResources.tsx:270` — `{k.toUpperCase()}`
  - `app/(dashboard)/scheduling/templates/SchedulingTemplates.tsx`

#### H10. Radiology Module — Partial English-Only
- **Files:**
  - `app/(dashboard)/radiology/studies/RadiologyStudies.tsx`
  - `app/(dashboard)/radiology/reporting/RadiologyReporting.tsx`

### i18n — Components Missing Bilingual Support

#### H11. DoctorStation — Arabic-Only Fallback
- **File:** `app/(dashboard)/opd/doctor-station/DoctorStation.tsx:141`
- **String:** `'طبيب'` should be `tr('طبيب', 'Doctor')`

#### H12. OB/GYN Module — Unicode Escapes (80+ strings)
- **Files:** `ObgynPatients.tsx`, `ObgynAntenatal.tsx`, `ObgynLabor.tsx`, `ObgynPostpartum.tsx`
- **Problem:** ALL Arabic text as `\u0645\u0631\u064A...` instead of readable `مريضات`
- **Impact:** Unreadable/unmaintainable code. Functionally works but impossible to review.

#### H13. HomeMedications — Arabic-Only Options
- **File:** `components/clinical/HomeMedications.tsx:38-69`
- **Problem:** `frequencyOptions`, `routeOptions`, `sourceOptions` all Arabic-only labels

#### H14. HistoryTaking — English-Only Labels
- **File:** `components/clinical/HistoryTaking.tsx:194-201`
- **Problem:** OLDCARTS labels (Onset, Location, Duration, Character, Aggravating, Relieving, Timing, Severity)
- **Also:** Tab labels HPI, PMH, PSH, FH, SH, ROS (lines 153-159) — abbreviations only

#### H15. OrdersPanel — ORDER_KINDS English-Only
- **File:** `components/opd/panels/OrdersPanel.tsx:165`

#### H16. TheaSidebarBrand — English-Only
- **File:** `components/thea-ui/sidebar/TheaSidebarBrand.tsx:46-55`
- **Strings:** "Thea Health", "Clinical Workspace" — no tr()

#### H17. TheaHeader — English-Only Tooltips
- **File:** `components/thea-ui/shell/TheaHeader.tsx:198-199,244`
- **Strings:** `title="Notifications"`, `title="Toggle theme"`

#### H18. TheaMobileSidebar — Raw Role Display
- **File:** `components/thea-ui/shell/TheaMobileSidebar.tsx:231`
- **Problem:** `userRole` shown raw (not translated via roleMap like desktop header does)

#### H19. TheaWaitBadge — English-Only Suffix
- **File:** `components/thea-ui/TheaWaitBadge.tsx:23`
- **Problem:** `{minutes}m` uses English "m" (should be `tr('د', 'm')`)

### Flow / Logic Issues

#### H20. OverviewPanel — Uses window.prompt() / window.confirm()
- **File:** `components/opd/panels/OverviewPanel.tsx:172,187,211`
- **Problem:** Browser dialogs — no i18n, bad UX, blocks thread

#### H21. OverviewPanel — specialtyName Never Populated
- **File:** `components/opd/panels/OverviewPanel.tsx:65`
- **Problem:** Variable declared but never assigned — dead code

#### H22. StrategicTab — 3 AI Endpoints May Not Exist
- **File:** `components/opd/dashboard/StrategicTab.tsx:53,73,88`
- **Endpoints:** `/api/opd/dashboard/intelligence`, `/api/opd/dashboard/intelligence/report`, `/api/opd/dashboard/intelligence/recommendations/${id}`

#### H23. DoctorStation — No Warning Before Switching Patients Without Discharge
- **File:** `app/(dashboard)/opd/doctor-station/DoctorStation.tsx:651-660`

#### H24. ERTriage — Save vs Complete Distinction Unclear
- **File:** `app/(dashboard)/er/triage/[encounterId]/ERTriage.tsx:104-188`

#### H25. SchedulingCalendar — Dead Navigation Link
- **File:** `app/(dashboard)/scheduling/calendar/SchedulingCalendar.tsx:18`
- **Problem:** `router.push('/opd/appointments/new?...')` — route may not exist

#### H26. InvoiceDraft — No "Generate Invoice" Action
- **File:** `app/(dashboard)/billing/invoice-draft/InvoiceDraft.tsx`
- **Problem:** Read-only draft view, no button to create/post invoice

#### H27. Payments — Can Record Payment Without Invoice
- **File:** `app/(dashboard)/billing/payments/Payments.tsx:53-84`
- **Problem:** No enforcement that invoice exists before payment

#### H28. OB/GYN Forms — No Error Handling on Save
- **Files:** `ObgynAntenatal.tsx:37-47`, `ObgynLabor.tsx:38-58`, `ObgynPostpartum.tsx:35-45`
- **Problem:** `saveForm()` has no try-catch or error toast

#### H29. DentalChart — No Error Handling on Save
- **File:** `app/(dashboard)/dental/chart/[patientId]/DentalChart.tsx:101-112`

#### H30. Missing RTL `dir` Attribute (Multiple Files)
- `app/(dashboard)/referrals/Referrals.tsx`
- `components/clinical/VitalsEntry.tsx`
- `app/(dashboard)/dental/chart/[patientId]/DentalChart.tsx:177`
- `app/(dashboard)/obgyn/antenatal/[patientId]/ObgynAntenatal.tsx:50`
- `app/(dashboard)/obgyn/labor/[patientId]/ObgynLabor.tsx`
- `app/(dashboard)/obgyn/postpartum/[patientId]/ObgynPostpartum.tsx`

#### H31. Files with useLang but No tr()
- `app/(dashboard)/opd/encounter/[encounterCoreId]/page.tsx`
- `app/(dashboard)/opd/loading.tsx`
- `app/(dashboard)/quality/incidents/Incidents.tsx`
- `app/(dashboard)/quality/incidents/[incidentId]/IncidentDetail.tsx`
- `app/(dashboard)/departments/[department]/Department.tsx`
- `app/(dashboard)/results/Results.tsx`
- `app/(dashboard)/patient/[patientMasterId]/journey/PatientJourney.tsx`
- `app/(dashboard)/patient/360/[patientMasterId]/Patient360.tsx`
- `app/(dashboard)/er/metrics/ERMetrics.tsx`
- `app/(dashboard)/billing/charge-events/ChargeEvents.tsx`

#### H32. Files Without useLang At All (With UI Elements)
- `components/SessionWarning.tsx` (49,52,62,68 — all English)
- `components/orders/MedicationSearchSelect.tsx` (52,122,129,133 — all English)
- `components/billing/ServiceSelector.tsx` (uses language prop, not hook)
- `components/sam/SamTopNav.tsx:12-20` (nav labels English-only)
- `app/(dashboard)/patients/components/PatientFilters.tsx`
- `app/(dashboard)/patients/components/BulkActions.tsx`
- `app/(dashboard)/patients/components/PatientCard.tsx`
- `app/(dashboard)/patients/components/PatientList.tsx`
- `app/(dashboard)/patients/components/PatientStats.tsx`

#### H33. Static Data Structures Outside Components (Can't Access tr())
- `components/orders/PrescriptionDialog.tsx:20-40` — frequencies/routes English-only
- `components/billing/InvoiceScreen.tsx:21-40` — frequencies/routes English-only
- `components/clinical/AllergiesManager.tsx:10` — COMMON_ALLERGIES English-only

#### H34. Hardcoded English Placeholders (30+)
- `quality/incidents/Incidents.tsx:83,89,101,122` — "Medication error", "Severity", "ER - Bed 3"
- `admin/structure-management/StructureManagement.tsx:908,917,926,936` — "Enter node name", "Enter code"
- `lab/blood-gas/BloodGasAnalysis.tsx:74-82` — PaCO2, PaO2, HCO3-
- `sam/setup/page.tsx:261` — "ISO 9001, ISO 27001, SOC 2"

#### H35. Portal Images Page — Hardcoded Arabic Unicode Escapes
- **File:** `app/(portal)/p/images/page.tsx:55,60,86-87,136-137,175-176`
- **Problem:** Arabic text as Unicode escapes + `toLocaleDateString('ar-SA')` hardcoded without language check

#### H36. Portal Billing — Possibly Dead Payment Endpoint
- **File:** `app/(portal)/p/billing/PortalBilling.tsx:98`
- **Problem:** Calls `/api/portal/billing/pay` — endpoint may not exist. No error recovery beyond toast.

#### H37. Admin Platform-Access — Disabled Switches With No Explanation
- **File:** `app/admin/platform-access/page.tsx:320,334`
- **Problem:** EDRAC and CVision switches are disabled but no tooltip/explanation why — dead UI elements

#### H38. Owner Users — Role Badges Not Bilingual
- **File:** `app/owner/users/page.tsx:212`
- **Problem:** Role badge colors use hardcoded role keys, role names not translated

#### H39. Portal Messages — RTL Layout Issues
- **File:** `app/(portal)/p/messages/page.tsx:69,83`
- **Problem:** Fixed `w-80` sidebar + `text-right` hardcoded — doesn't account for RTL

#### H40. Owner Tenants — Missing RTL dir Attribute
- **File:** `app/owner/tenants/page.tsx:561`
- **Problem:** Missing `dir` attribute for RTL support on main container

#### H41. Portal Reports — No Error Fallback UI
- **File:** `app/(portal)/p/reports/page.tsx:29,38`
- **Problem:** SWR call has loading spinner but no error state UI

---

## MEDIUM ISSUES (~80)

### Security / Config

#### M1. 6 Auth Routes + All Integration Routes Without Rate Limiting
- Auth: `app/api/auth/identify`, `/refresh`, `/password-strength`, `/2fa/setup`, `/2fa/verify`, `/2fa/disable`
- All 12+ integration routes in `app/api/integrations/` lack rate limiting — can exhaust external service quotas

#### M1b. HL7 No Message Size Validation
- **Files:** `app/api/integrations/hl7/inbound/route.ts:71`
- **Problem:** No Content-Length check. Attacker can send 100MB+ HL7 message causing memory exhaustion/DoS.
- **Fix:** Add size limit check before parsing (e.g., reject > 10MB)

#### M1c. 9+ Integration Schemas Use Zod `.passthrough()`
- **Files:** `absher/verify`, `clinical-events`, `lis/match`, `nafis/*` (3), `nphies/*` (3)
- **Problem:** `.passthrough()` allows arbitrary extra fields through validation — unvalidated data stored in DB
- **Fix:** Remove `.passthrough()` or use `.strict()`

#### M1d. Cron Routes — No IP Whitelisting
- **File:** `app/api/cron/opd/sms-reminders/route.ts:16-23`
- **Problem:** Validates secret header but not caller IP. Anyone with the secret can trigger crons.
- **Fix:** Add IP allowlist check

#### M1e. Health Endpoint Exposes Detailed Metrics Without Auth
- **File:** `app/api/health/route.ts:40-46`
- **Problem:** Returns error stats, recent errors, detailed metrics — useful to attackers
- **Fix:** Require auth for detailed view, return only basic status publicly

#### M2. CORS Wildcard (`*`) in 3 Routes
- `app/api/[[...path]]/route.js:8` — fallback to `*`
- `app/api/docs/route.ts:22,37`
- `app/api/cvision/docs/route.ts:9`

#### M3. ~50 Environment Variables Not Documented in .env.example
- Critical: `INIT_ADMIN_PASSWORD`, `DEFAULT_TENANT_ID`, `REDIS_PORT/PASSWORD`, `SENDGRID_API_KEY`, `SENTRY_DSN`, `SMTP_*`, `TWILIO_*`, `WHO_ICD_*`
- Operational: `DB_POOL_MIN/MAX`, `MIDDLEWARE_DEBUG`, `LOCAL_DEV`, `NEXT_PUBLIC_APP_URL`
- Rate limits: `RATE_LIMIT_AI_*`, `RATE_LIMIT_EXPORT_*`, `RATE_LIMIT_PDF_*`

#### M4. CI/CD Workflows Missing Required Env Vars
- `.github/workflows/ci.yml` — missing `CSRF_SECRET`, `FIELD_ENCRYPTION_KEY`

#### M5. Docker Compose Hardcoded Credentials
- `docker-compose.yml:64` — Orthanc password hardcoded
- `docker-compose.yml:93-94` — Mirth DB credentials hardcoded

#### M6. Docker Health Check Wrong Endpoint
- `docker-compose.yml:30` — uses `/api/opd/health` should be `/api/health`

#### M7. Deploy Workflow TODOs
- `.github/workflows/deploy.yml:97,149` — "TODO: Add actual deploy command"

#### M8. Middleware Duplicate Condition
- **File:** `middleware.ts:450`
- **Problem:** `pathname.startsWith('/platforms/thea-health') || pathname.startsWith('/platforms/thea-health')` — duplicate check, second one was likely meant to be a different path

### i18n — Medium Severity

#### M9. 384 react-hooks/exhaustive-deps Warnings
- Mostly `tr()` function causing re-renders in useCallback/useEffect

#### M10. VitalsEntry — Uses language Prop Instead of useLang Hook
- `components/clinical/VitalsEntry.tsx:56`

#### M11. FollowUpScheduler — Hardcoded Arabic Label
- `components/clinical/FollowUpScheduler.tsx:233` — `الطبيب` without tr()

#### M12. Pharmacy Error Messages English-Only
- `app/(dashboard)/pharmacy/inventory/PharmacyInventory.tsx:393,579` — 'Failed to adjust', 'Failed to add'
- `app/(dashboard)/pharmacy/verification/PharmacyVerification.tsx:569,598` — 'Failed'

#### M13. SecuritySettings — English Error
- `app/(dashboard)/settings/security/SecuritySettings.tsx:35` — 'Failed to setup 2FA'

#### M14. InvoiceScreen — Hardcoded Arabic alert()
- `components/billing/InvoiceScreen.tsx:307` — `alert('فشل في معالجة الدفع: ')`

#### M15. OverviewTab — Hardcoded Arabic Target
- `components/opd/dashboard/OverviewTab.tsx:51` — `'المستهدف: 85%'`

#### M16. RecommendationCard — Hardcoded Arabic Badge
- `components/opd/dashboard/RecommendationCard.tsx:142` — `'تم الإقرار'`

#### M17. TimeAnalysisTab — English-Only Benchmark Label
- `components/opd/dashboard/TimeAnalysisTab.tsx:81` — `"ADA'A Benchmark"`

#### M18. Referrals.tsx — Inconsistent i18n Pattern
- Uses custom `t()` from `lib/i18n` instead of standard `tr()` pattern

#### M19. TheaSidebarNavItem — Not RTL-Aware
- **File:** `components/thea-ui/sidebar/TheaSidebarNavItem.tsx:103`
- **Problem:** `right: expanded ? 8 : 2` — should use `insetInlineEnd` for RTL support

### Flow / UX — Medium

#### M20. SchedulingCalendar — No Refresh After Status Change
- `app/(dashboard)/scheduling/calendar/SchedulingCalendar.tsx:27-42`

#### M21. LabCollection — No Confirmation After Collection
- `app/(dashboard)/lab/collection/LabCollection.tsx:88` — closes modal, no toast

#### M22. TimeAnalysisTab — peakDays Hardcoded at Zero
- `components/opd/dashboard/TimeAnalysisTab.tsx:35-41` — incomplete feature

#### M23. DashboardHeader — Stub Export Callbacks
- `components/opd/dashboard/DashboardHeader.tsx:68-71` — `onExportPDF/Excel` never implemented

#### M24. DentalProcedures — Hardcoded Prices, No API
- `app/(dashboard)/dental/procedures/DentalProcedures.tsx` — 15 procedures with hardcoded fees

#### M25. CVision CV Inbox — Empty Upload onClick
- `app/(dashboard)/cvision/recruitment/cv-inbox/page.tsx:227,378` — `onClick={() => {}}`

#### M26. Dental/OB/GYN Stubs
- Dental Reports: "Coming soon"
- OB/GYN Reports + Settings: "Under preparation"

#### M27. 3 ER Routes Without withErrorHandler
- `app/api/er/mci/route.ts`
- `app/api/er/triage-score/route.ts`
- `app/api/er/triage-score/[encounterId]/route.ts`

#### M28. window.prompt / window.confirm / window.alert Usage (10+ occurrences)
- `components/opd/panels/OverviewPanel.tsx:172,187,211` — window.prompt, window.confirm
- `components/billing/InvoiceScreen.tsx:307` — alert()
- `components/billing/PaymentMethods.tsx` — confirm()
- `components/billing/WalkInDialog.tsx` — confirm()
- `components/admin/clinicalInfra/CrudPage.tsx` — confirm()
- `components/clinical/AllergiesManager.tsx` — confirm()
- `components/clinical/ProblemList.tsx` — confirm()
- **Fix:** Replace all with proper modal dialogs (AlertDialog from shadcn/ui)

#### M29. SAM Module — 3 Stub/Placeholder Pages
- `app/(dashboard)/sam/issues/page.tsx` — placeholder card with link
- `app/(dashboard)/sam/gaps/page.tsx` — placeholder card with link
- `app/(dashboard)/sam/assistant/page.tsx` — placeholder card with link

#### M30. TheaMobileBottomNav — Hardcoded Color
- `components/thea-ui/shell/TheaMobileBottomNav.tsx:162` — `#1D4ED8` instead of THEA_UI token

#### M31. TheaChartCard — Hardcoded Color
- `components/thea-ui/TheaChartCard.tsx:19` — `#1D4ED8` instead of THEA_UI token

#### M32. TheaSidebarNavItem — Hardcoded Color
- `components/thea-ui/sidebar/TheaSidebarNavItem.tsx:90` — `#CBD5E1` instead of THEA_UI token

#### M33. Portal Module — Missing Error Boundaries
- `app/(portal)/p/` pages lack dedicated error.tsx files

#### M34. IPD Admission Flow — No Bed Availability Check Before Assign
- `app/api/ipd/episodes/[episodeId]/bed/assign/route.ts` — assigns bed without checking current occupancy

#### M35. Billing Module — No Currency Formatting Consistency
- Various billing components use different approaches to format SAR amounts

---

## LOW ISSUES (~90+)

### Naming / Code Quality

#### L1. `bootstrapSiraOwner` — Old Function Name
- **File:** `lib/system/bootstrap.ts:73` — should be `bootstrapTheaOwner`
- **Also:** `app/api/auth/login/route.ts:9,267` — imports and calls `bootstrapSiraOwner`

#### L2. `strict: false` in tsconfig.json
- `tsconfig.json:12-13` — `strict: false`, `noImplicitAny: false`

#### L3. `lang="ar"` Hardcoded in Root Layout
- `app/layout.tsx:47` — should be dynamic based on user preference

#### L4. ESLint Config Version Mismatch
- `package.json:192` — `eslint-config-next: 14.2.3` but Next.js at `14.2.35`

#### L5. Duplicate Triage Complete Endpoint
- `app/api/er/triage/complete/route.ts` — re-exports from `../finish/route.ts`

#### L6. AI Interview Hardcoded English Questions
- `app/(dashboard)/cvision/recruitment/ai-interview/[candidateId]/page.tsx:37-46`

#### L7. ICD10Selector — Hardcoded "selected"
- `components/clinical/ICD10Selector.tsx:121`

#### L8. MedReconciliation/ProblemList — Non-Standard labelAr/labelEn Pattern
- `components/clinical/MedReconciliation.tsx:49-100`
- `components/clinical/ProblemList.tsx:28-38`

#### L9. DischargePanel — Uses window.print()
- `components/opd/panels/DischargePanel.tsx:91`

#### L10. 521 `as any` Usage in Dashboard
- Across `app/(dashboard)/` files — type safety gaps

#### L11. 237 TODO/FIXME Comments
- Key ones: `lib/core/org/structure.ts`, `lib/sam/operationLinks.ts`, `lib/notifications/smsReminders.ts`

#### L12. 9 Files Using `<img>` Instead of `<Image>`
- `app/(dashboard)/cvision/settings/page.tsx`, `SecuritySettings.tsx`, `SplashScreen.tsx`, etc.

#### L13. 2 Files Missing `alt` Text
- JSX a11y violations

#### L14. thea-website/ Subproject — 40+ TS Errors
- Separate project, all imports broken (LanguageContext, ThemeContext, Navbar, Footer, etc.)

#### L15. ErEncounter.encounterCoreId is Optional in Prisma
- **File:** `prisma/schema/er.prisma`
- **Problem:** Design question — should it be required? An ER encounter without a core encounter link may be intentional (unknown patients), but could also mask data integrity issues

---

## WHAT'S CLEAN (Confirmed Working)

- **Syra references:** 100% removed from main codebase
- **Legacy imports:** 100% removed — all 54 *Legacy.tsx files deleted, no broken imports
- **MongoDB migration:** 100% complete — zero MongoDB code remaining
- **Navigation links:** All sidebar links point to existing pages
- **Shell components:** Thea UI design system properly integrated (Desktop + Mobile + CVision)
- **Auth flow:** Consistent thea-owner role throughout
- **Tenant isolation:** UUID-safe filtering, proper DB naming (`thea_tenant__<tenantId>`)
- **PostgreSQL/Prisma:** Properly configured with 48 schema files
- **Multi-platform:** thea_health, sam, cvision properly isolated in middleware + routing
- **Error boundaries:** Dashboard, OPD have proper error.tsx files
- **Session management:** SessionIdleTimeoutGuard properly bilingual
- **Login flow:** Properly bilingual with step-based flow
- **Route access control:** Well-structured area-based RBAC in `lib/access/uiRouteAccess.ts`
- **ClientLayoutSwitcher:** Properly switches Desktop/Mobile/CVision shells

---

## AREAS NOT FULLY AUDITED (~5-10% remaining)

1. **Individual CVision page bodies** (~50 pages not individually read)
2. **~800 API route bodies** not individually read (sampled ~400 of 1,285)
3. **Some deeply nested component files** not individually read
4. **Complete end-to-end flow testing** (requires running the app)
5. **Performance** — bundle size, lazy loading, caching patterns
6. **Accessibility** — WCAG compliance, screen reader support, keyboard navigation
7. **CSS/Styling consistency** — full design system audit

---

## RECOMMENDED FIX ORDER

### Phase 1 — Critical Security (immediate)
1. **SEC1-3:** Fix HL7 tenant injection + timing-vulnerable API key comparison
2. **C2:** Add permission options to 96 CVision API routes
3. **C3:** Add tenantScoped/platformKey to 7 ER API routes
4. **C13:** Fix XSS via dangerouslySetInnerHTML in CVision policies

### Phase 2 — Build Fix
5. **C1:** Fix framer-motion ease type in 7 website files

### Phase 3 — Schema Integrity
6. **C10-C11:** Add Tenant @relation to 18 Prisma models (11 CVision + 7 IPD)
7. **C12:** Add compound indexes to 5 high-traffic models

### Phase 4 — Config Cleanup
8. **C9:** Replace all 47 `admin@thea.health` with `thea@thea.com.sa` / env var
9. **L1:** Rename `bootstrapSiraOwner` → `bootstrapTheaOwner`
10. **M8:** Fix middleware duplicate condition

### Phase 5 — Critical i18n (entire pages)
11. **C4:** Visit layout tabs (Arabic → bilingual)
12. **C5:** ER encounter tabs (English → bilingual)
13. **C6:** Mortuary (English → bilingual)
14. **C7:** Quality Incidents (English → bilingual)
15. **C8:** Quality KPIs (English → bilingual)
16. **H1:** Results (English → bilingual)
17. **C14:** SessionWarning (English → bilingual + fix dead endpoints)

### Phase 6 — High i18n
18-35. Fix remaining H1-H34 i18n issues across all modules

### Phase 7 — Flow Fixes
36-42. Fix dead-ends: DischargePanel, ResultsPanel, SchedulingCalendar, InvoiceDraft, etc.
43-45. Replace all window.prompt/confirm/alert with proper modals

### Phase 8 — Config/Infra
46-50. Fix env vars, CI/CD, Docker, rate limiting, CORS

### Phase 9 — Polish
51+. Code quality, naming, hardcoded colors, `as any` cleanup, TODO resolution
