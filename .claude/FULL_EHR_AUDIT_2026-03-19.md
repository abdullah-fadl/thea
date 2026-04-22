# Thea EHR — Full System Audit Report
**Date:** 2026-03-19
**Coverage:** 21 parallel deep-audit agents (4 rounds) — every module, every flow, every route, every lib, every schema, every script, every config, every medium/large page file
**Total Issues Found:** ~520+ unique issues (excluding CVision HR platform)

---

## STATISTICS

| Category | Count |
|----------|-------|
| Ghost Endpoints (frontend → 404) | 17 |
| Dead API Routes (exist, never called) | 462 |
| Critical Security | 12 |
| High Security | 14 |
| Broken Flows (dead ends) | 30+ |
| Missing Clinical Steps | 15+ |
| Race Conditions | 4 |
| i18n Violations (entire pages) | 40+ pages |
| Dead Buttons / No-Op UI | 20+ |
| Silent Error Swallowing | 40+ locations |
| **Missing `credentials: 'include'`** | **~45 files (SYSTEMIC)** |
| Missing `useRoutePermission` | 8+ pages |
| Response Shape Mismatches | 5+ |
| Missing Error Boundaries | 350+ pages |
| Legacy MongoDB Scripts (will fail) | 8 |
| Hardcoded Credentials in Source | 8 |
| `isDevSuperAdmin` Bypass | 41 files |
| Undocumented Env Vars | 60+ |
| Dead Code (components/hooks) | 15+ files |
| Invalid Tailwind Classes | 6+ locations |

---

## PART 1: CRITICAL SECURITY (8 issues)

### SEC-01. Middleware `/p` Prefix Bypasses Auth for ALL `/p*` Routes
- **File:** `middleware.ts:282`
- **Problem:** `pathname.startsWith('/p')` matches `/patients`, `/pharmacy`, `/physiotherapy`, `/psychiatry` — ALL skip authentication
- **Fix:** Change to `pathname.startsWith('/p/')`
- **Impact:** Complete authentication bypass for dozens of clinical routes

### SEC-02. JWT 7-Day Cookie Overwrites 1-Hour Access Token
- **Files:** `app/api/auth/login/route.ts:344,359-362`, `lib/auth.ts:13`, `lib/security/config.ts:14`
- **Problem:** Login sets `auth-token` cookie twice — first 1-hour via `setAccessTokenCookie`, then 7-day via manual `Set-Cookie`. Second overwrites first. Session idle timeout (30min) and absolute max (24hr) are bypassed.
- **Impact:** Tokens live 7 days regardless of session controls

### SEC-03. Dual Session Validation — Single-Session Enforcement is Dead
- **Files:** `lib/auth/sessions.ts` (multi-session), `lib/security/sessions.ts` (single-session)
- **Problem:** `withAuthTenant` imports from `lib/auth/requireAuth.ts` which uses multi-session validation. The single-session enforcement in `lib/security/sessions.ts` is dead code for most routes.
- **Impact:** Forced logout / session revocation doesn't work

### SEC-04. CSRF Protection Applied to 1 of 1,285 Routes
- **File:** `lib/security/csrf.ts`
- **Problem:** `requireCSRF` function exists but only called in `app/api/admin/users/route.ts`. All other state-changing routes are unprotected.
- **Impact:** CSRF attacks possible on all POST/PUT/DELETE/PATCH routes

### SEC-05. `requireRole` Trusts Forgeable Request Headers
- **File:** `lib/auth/requireRole.ts:167`
- **Problem:** Reads `x-user-id` and `x-user-role` from request headers. Attacker can send forged headers.
- **Impact:** Potential privilege escalation to admin

### SEC-06. Session Revocation Non-Blocking
- **File:** `lib/auth/requireRole.ts:68-82`
- **Problem:** When session validation fails in `getAuthContext`, it logs warning but continues. Revoked sessions still work if JWT is valid.
- **Impact:** Cannot effectively revoke access (combined with 7-day JWT = 7-day window)

### SEC-07. No Password Reset Flow
- **Problem:** No `forgot-password`, `reset-password`, or `password-reset` API routes exist anywhere. Only `change-password` (requires current password).
- **Impact:** Users locked out permanently if they forget password

### SEC-08. Owner Access Token Cookie Not Validated in Middleware
- **File:** `middleware.ts:386-437`
- **Problem:** Checks presence of `approved_access_token` cookie but NOT its contents (expiry, signature, target tenant).
- **Impact:** Owner can access any tenant with arbitrary cookie value

---

## PART 2: HIGH SECURITY (10 issues)

### SEC-09. HL7 Tenant ID from Untrusted Header
- **Files:** `app/api/integrations/hl7/receive/route.ts:47`, `app/api/integrations/hl7/inbound/route.ts:119`
- **Problem:** `tenantId = req.headers.get('x-tenant-id') || 'default'` — cross-tenant data injection + dangerous default fallback

### SEC-10. HL7 Endpoints Have Zero Authentication
- **Files:** Both HL7 receive/inbound routes
- **Problem:** No auth middleware at all. Any caller can POST HL7 messages.

### SEC-11. HL7 API Key Timing Attack
- **Files:** Both HL7 routes
- **Problem:** API key compared with `===` instead of `crypto.timingSafeEqual()`

### SEC-12. XSS via dangerouslySetInnerHTML in CVision Policies
- **File:** `app/(dashboard)/cvision/policies/page.tsx:136`
- **Problem:** Policy content rendered without sanitization

### SEC-13. 96 CVision API Routes Missing Permission Checks
- **Files:** All routes in `app/api/cvision/` (~96 routes)
- **Problem:** `withAuthTenant()` called without `permissionKey` parameter

### SEC-14. 7 ER API Routes Missing tenantScoped/platformKey
- **Files:** `app/api/er/mci/route.ts`, `triage-score/route.ts`, `triage/complete/route.ts`, etc.

### SEC-15. Identify Endpoint Leaks Account Status (User Enumeration)
- **File:** `app/api/auth/identify/route.ts:74-79`
- **Problem:** Returns different errors for non-existent vs inactive accounts

### SEC-16. No Rate Limiting on Identify Endpoint
- **File:** `app/api/auth/identify/route.ts`
- **Problem:** Unlimited email enumeration possible

### SEC-17. `uiRouteAccess.ts` Defaults to `public`
- **File:** `lib/access/uiRouteAccess.ts:115`
- **Problem:** New routes implicitly accessible to all authenticated users (fail-open)

### SEC-18. Backup Codes Use `Math.random()`
- **File:** `lib/auth/twoFactor.ts:71`
- **Problem:** Not cryptographically secure. Should use `crypto.getRandomValues()`

---

## PART 3: GHOST ENDPOINTS — Frontend Calls Non-Existent API (17)

| # | Frontend Calls | Actual Route | Module Impact |
|---|---------------|-------------|---------------|
| 1 | `/api/er/mci/incidents` (GET,POST) | `/api/er/mci` | **MCI completely broken** |
| 2 | `/api/er/mci/incidents/{id}/deactivate` | `/api/er/mci/{id}/deactivate` | MCI deactivation broken |
| 3 | `/api/er/mci/incidents/{id}/patients` | `/api/er/mci/{id}/patients` | MCI patients broken |
| 4 | `/api/er/triage/scores` | `/api/er/triage-score` | **Triage scoring broken** |
| 5 | `/api/portal/family-access` (GET,POST,revoke) | `/api/portal/proxy-access` | **Family access broken** |
| 6 | `/api/icu/brain-death` (GET,POST,advance) | `icu/episodes/[id]/brain-death` | **Brain death protocol broken** |
| 7 | `/api/auth/extend-session` | Does not exist | **Session extension broken** |
| 8 | `/api/dental/orthodontic` | `dental/orthodontic/cases` | Ortho listing broken |
| 9 | `/api/departments` | `departments/active` | Risk detector dropdown broken |
| 10 | `/api/lab/lis-connections` | `lab/lis-dashboard` | **LIS Dashboard broken** |
| 11 | `/api/lab/lis-connections/message-queue` | Does not exist | LIS message queue broken |
| 12 | `/api/ipd/results/{id}/acknowledge` | Does not exist | **ICU result acknowledgment broken** |
| 13 | `/api/icu/organ-donation/{id}/advance` | `organ-donation/[id]/status` | Organ donation workflow broken |
| 14 | `/api/scheduling/multi-resource/{id}/confirm` | Does not exist | Multi-resource booking confirm broken |
| 15 | `/api/telemedicine/rpm/readings/{id}/ack` | Does not exist | RPM acknowledgment broken |
| 16 | `/api/telemedicine/visits/{id}/status` | Does not exist | Tele-visit status broken |
| 17 | `/api/billing/nphies/eligibility` (from InsuranceVerify) | Wrong path | **Insurance verification broken** |

---

## PART 4: BROKEN FLOWS — Dead Ends & Missing Steps

### OPD Flow
| # | Issue | File | Severity |
|---|-------|------|----------|
| F-01 | **Discharge tab has no actual discharge action** — only shows med reconciliation, no status transition, no navigation | `DischargePanel.tsx:60-96` | CRITICAL |
| F-02 | **FollowUp PATCH → 405** — encounter route has no PATCH handler, follow-up data silently lost | `FollowUpScheduler.tsx:100-112` | CRITICAL |
| F-03 | **No diagnosis tab in visit layout** — required for completion but inaccessible from `/opd/visit/` | `visit/[visitId]/layout.tsx:12-24` | CRITICAL |
| F-04 | **SOAP auto-save creates duplicate notes** — POST every 30s with no upsert, dozens of copies per visit | `SoapPanel.tsx:140-197` | HIGH |
| F-05 | "View Images" button is dead (no onClick) | `ResultsPanel.tsx:152` | HIGH |
| F-06 | History tab saves at patient-level, not encounter-level — overwrites other visits | `visit/[visitId]/history/page.tsx` | HIGH |
| F-07 | Billing tab is read-only — no payment/invoice actions | `visit/[visitId]/billing/` | MEDIUM |
| F-08 | Consent form has no type selector — always `general_treatment` | `DoctorStation.tsx:70-71` | MEDIUM |
| F-09 | Permission mismatch: `opd.doctor.visit.view` vs `opd.doctor.encounter.view` | `OverviewPanel.tsx:32` | HIGH |
| F-10 | `slotIds` (array) vs `slotId` (string) between FollowUpScheduler and NewAppointmentPage | Multiple | MEDIUM |

### ER Flow
| # | Issue | File | Severity |
|---|-------|------|----------|
| F-11 | **`DEATH` status not in state machine** — death workflow in UI but transitions will reject | `constants.ts`, `erTransitions.ts` | CRITICAL |
| F-12 | **Disposition fields never persisted** — `admitWardUnit`, `handoffSbar`, `transferType` silently dropped | `disposition/route.ts:77-86` | HIGH |
| F-13 | Disposition validation fails on re-read — fields remapped to `notes`/`destination` | `disposition/route.ts:71-74` | HIGH |
| F-14 | No navigation after bed assignment — dead end | `ERBeds.tsx:454-478` | HIGH |
| F-15 | Wristband print uses wrong IDs before encounter creation | `ERRegister.tsx:331-352` | HIGH |
| F-16 | Board dispo filter includes statuses excluded by API query | `ERBoard.tsx:74-84` | MEDIUM |
| F-17 | ERDoctor duplicate visit number line (copy-paste bug) | `ERDoctor.tsx:177-178` | LOW |
| F-18 | `ARRIVED` status never set by any UI path — dead status | `constants.ts:26` | MEDIUM |

### IPD Flow
| # | Issue | File | Severity |
|---|-------|------|----------|
| F-19 | **Discharge blocked by handover with no guidance** — user gets toast but no path to create handover | `IPDEpisode.tsx:127-134` | CRITICAL |
| F-20 | **Handover blocks bed transfer** — logically inverted, transfers should happen before handover | `IPDEpisode.tsx:1853,1877` | HIGH |
| F-21 | **Ward Board cards not clickable** — no navigation to episode | `IPDWardBoard.tsx:309-426` | HIGH |
| F-22 | **Live Beds navigates to patient profile instead of episode** | `LiveBeds.tsx:200-204` | HIGH |
| F-23 | Discharge summary only shows occupied beds — misses already-discharged | `IPDDischargeSummary.tsx:112-116` | HIGH |
| F-24 | IntakeListing filters 200 results client-side — patients beyond 200 invisible | `IntakeListing.tsx:89,96-109` | MEDIUM |
| F-25 | IPD Episodes N+1 API calls — per-encounter fetch | `IPDEpisodes.tsx:47-61` | MEDIUM |

### Billing Flow
| # | Issue | File | Severity |
|---|-------|------|----------|
| F-26 | **Payment status mismatch** — InvoiceScreen creates `COMPLETED`, Payments page checks `RECORDED` — payments can never be voided | `InvoiceScreen.tsx:276` vs `Payments.tsx:188` | CRITICAL |
| F-27 | Claims "Mark Paid" only enabled for `RESUBMITTED`, blocks direct `SUBMITTED` remittance | `Claims.tsx:412` | HIGH |
| F-28 | Insurance payers/plans/rules — no DELETE operations | `Insurance.tsx` | MEDIUM |
| F-29 | Cashier "Today total" sums ALL recent invoices, not filtered to today | `Cashier.tsx:191` | MEDIUM |
| F-30 | `canRecord`/`canVoid` use identical permission path | `Payments.tsx:21-22` | MEDIUM |

### Scheduling Flow
| # | Issue | File | Severity |
|---|-------|------|----------|
| F-31 | **MultiResourceBooking reads `resources` but API returns `items`** — feature broken | `MultiResourceBooking.tsx:34` | CRITICAL |
| F-32 | Dead link to `/scheduling/availability` — page doesn't exist | `scheduling/page.tsx:11` | HIGH |
| F-33 | Resources access control uses hardcoded email check | `SchedulingResources.tsx:41` | HIGH |
| F-34 | Waitlist has no "Add to Waitlist" UI | `WaitlistManager.tsx` | MEDIUM |

### Lab Flow
| # | Issue | File | Severity |
|---|-------|------|----------|
| F-35 | **No specimen reception/accessioning step** (COLLECTED → RECEIVED gap) | Missing page | HIGH |
| F-36 | **No pathologist verification step** before result release | Missing workflow | HIGH |
| F-37 | **Critical alerts don't notify ordering physician** | `LabCriticalAlerts.tsx` | HIGH |
| F-38 | Lab results don't flow back to IPD/OPD automatically | Cross-module gap | HIGH |
| F-39 | Collection/Results use `alert()` instead of toast | `LabCollection.tsx:96`, `LabResults.tsx:221` | LOW |

### Radiology Flow
| # | Issue | File | Severity |
|---|-------|------|----------|
| F-40 | **Critical Findings KPI hardcoded to 0** — API exists but never called | `RadiologyWorklist.tsx:143` | HIGH |
| F-41 | **No technologist workflow** (prep → imaging → QA) | Missing pages | HIGH |
| F-42 | **No report verification/cosign** by supervising radiologist | Missing workflow | HIGH |
| F-43 | No study scheduling UI (ORDERED → SCHEDULED transition) | Missing page | MEDIUM |

### Pharmacy Flow
| # | Issue | File | Severity |
|---|-------|------|----------|
| F-44 | **IPD medication orders don't reach pharmacy queue** — no cross-module link | Cross-module gap | HIGH |
| F-45 | **Dispensing doesn't deduct from inventory** | Cross-module gap | HIGH |
| F-46 | **Controlled substances without dual-signature** | Missing workflow | HIGH |
| F-47 | No CANCELLED tab despite cancel logic existing | `PharmacyDispensing.tsx:58-62` | LOW |

### Clinical Components
| # | Issue | File | Severity |
|---|-------|------|----------|
| F-48 | **Allergy delete with no confirmation** — patient safety risk | `AllergiesManager.tsx:61-63` | CRITICAL |
| F-49 | ProblemList save failure is silent (console.error only) | `ProblemList.tsx:61-63,75-77` | HIGH |
| F-50 | AllergiesManager delete has no error handling | `AllergiesManager.tsx:61-63` | HIGH |

### Quality Module
| # | Issue | File | Severity |
|---|-------|------|----------|
| F-51 | Readmissions API exists but no UI page | Dead API | HIGH |
| F-52 | Incidents can't be edited/deleted after creation | `IncidentDetail.tsx` | MEDIUM |
| F-53 | RCA/FMEA/Sentinel events have no detail/edit pages | `RcaDashboard.tsx` | MEDIUM |

### Patient Portal
| # | Issue | File | Severity |
|---|-------|------|----------|
| F-54 | Reports page calls staff-auth API — portal patients get 401 | `reports/page.tsx:29` | CRITICAL |
| F-55 | Registration OTP flow incomplete — no verification step | `p/page.tsx` | HIGH |
| F-56 | Profile page is read-only — no edit capability | `p/profile/page.tsx` | MEDIUM |
| F-57 | 4 portal pages exist but missing from navigation | `p/layout.tsx` | MEDIUM |
| F-58 | Login page redirects to `/p` — potential redirect loop | `p/login/page.tsx` | LOW |

### Settings / Admin
| # | Issue | File | Severity |
|---|-------|------|----------|
| F-59 | **No password change for regular users** | Missing feature | HIGH |
| F-60 | No profile editing, notification prefs, language/theme settings | Missing features | MEDIUM |

### Dental / OB-GYN
| # | Issue | File | Severity |
|---|-------|------|----------|
| F-61 | Dental "Reports" card is dead (opacity-60, "Coming soon") | `dental/page.tsx:33` | LOW |
| F-62 | OB/GYN "Reports" and "Settings" cards — no onClick, dead divs | `obgyn/page.tsx:23-30` | LOW |

---

## PART 5: SHELL / NAVIGATION / LAYOUT

### Navigation Broken
| # | Issue | File | Severity |
|---|-------|------|----------|
| N-01 | **3 mobile nav links → 404** (`/nursing/operations`, `/patient-experience/dashboard`, `/library`) | `TheaMobileBottomNav.tsx:29-38` | CRITICAL |
| N-02 | **~40+ pages exist but have no sidebar entry** (oncology, psychiatry, telemedicine, transplant, scheduling sub-pages, admin sub-pages, etc.) | `useSidebarNav.ts` | HIGH |
| N-03 | Mobile nav completely different from desktop sidebar — inconsistent UX | `TheaMobileBottomNav.tsx` | HIGH |
| N-04 | Platform detection duplicated and drifted between sidebar and header | `useSidebarNav.ts` vs `TheaHeader.tsx` | MEDIUM |
| N-05 | Admin sidebar missing 17+ existing admin pages | `useSidebarNav.ts:206-222` | MEDIUM |

### Layout Issues
| # | Issue | File | Severity |
|---|-------|------|----------|
| L-01 | **Double ThemeProvider** — wraps children twice | `layout.tsx:71` + `providers.tsx:30` | MEDIUM |
| L-02 | **Double Toaster** — dashboard layout + shell components | `(dashboard)/layout.tsx:18` + shells | MEDIUM |
| L-03 | **SessionWarning conflicts with SessionIdleTimeoutGuard** — two competing systems | `(dashboard)/layout.tsx:15-17` | HIGH |
| L-04 | **SessionWarning redirects to `/logout` which doesn't exist** | `SessionWarning.tsx:66` | HIGH |
| L-05 | **No `app/not-found.tsx`** — default Next.js 404 page | Missing | MEDIUM |
| L-06 | **No `app/global-error.tsx`** — unhandled errors show raw Next.js error | Missing | MEDIUM |
| L-07 | **350+ sub-pages without error.tsx/loading.tsx** — error in deep route kills entire dashboard | Widespread | HIGH |
| L-08 | `admin/` routes outside dashboard group have no shell (no sidebar/header) | `app/admin/` | MEDIUM |
| L-09 | ClientLayoutSwitcher hydration mismatch on mobile (SSR=desktop, client=mobile) | `ClientLayoutSwitcher.tsx:20` | LOW |

### Design System
| # | Issue | File | Severity |
|---|-------|------|----------|
| D-01 | 7+ thea-ui components use hardcoded hex colors instead of tokens | Multiple | MEDIUM |
| D-02 | `THEA_UI_DARK` tokens exist but no helper function uses them — dark mode broken for inline styles | `tokens.ts` | HIGH |
| D-03 | Clinical components use raw Tailwind instead of thea-ui | `components/clinical/*` | LOW |
| D-04 | `SessionStateTracker` references non-existent platform `edrac` | `SessionStateTracker.tsx:35-36` | LOW |

### Dead Code
| # | Item | File |
|---|------|------|
| DC-01 | `useTranslation` hook — never imported | `hooks/useTranslation.ts` |
| DC-02 | `useRooms` hook — never imported | `hooks/queries/useRooms.ts` |
| DC-03 | `useDepartments` hook — never imported | `hooks/queries/useDepartments.ts` |
| DC-04 | `useFloors` hook — never imported | `hooks/queries/useFloors.ts` |
| DC-05 | `useUiPreviewRole` hook — never imported | `lib/hooks/useUiPreviewRole.ts` |
| DC-06 | `SplashScreen` component — only in worktrees | `components/SplashScreen.tsx` |
| DC-07 | `InlineEditField` component — only in worktrees | `components/InlineEditField.tsx` |
| DC-08 | `InlineToggle` component — only in worktrees | `components/InlineToggle.tsx` |
| DC-09 | `DoctorStationThea` — fallback never used | `DoctorStationThea.tsx` |
| DC-10 | 462 API routes never called from frontend | See Ghost Endpoints section |

---

## PART 6: PRISMA SCHEMA & DATA INTEGRITY

| # | Issue | Severity |
|---|-------|----------|
| S-01 | **250+ models have `tenantId` but no `@relation` to Tenant** — no FK enforcement, no cascade deletes | CRITICAL |
| S-02 | Portal models (8) missing Tenant relation | HIGH |
| S-03 | Integration models (7) missing Tenant relation | HIGH |
| S-04 | Missing compound indexes on high-traffic models (EncounterCore, OrdersHub, LabResult, Notification, AuditLog) | HIGH |
| S-05 | `reminderSentAt` column referenced in code but not in schema — raw SQL workaround | MEDIUM |
| S-06 | HL7 inbound uses `(prisma as any).ordersHub` — model may not be properly exported | MEDIUM |

---

## PART 7: INTEGRATIONS & NOTIFICATIONS

### Integrations
| # | Issue | Severity |
|---|-------|----------|
| I-01 | Duplicate HL7 receive endpoints (`receive` + `inbound`) — confusion about which to use | MEDIUM |
| I-02 | NPHIES claim status — no actual polling from NPHIES, only local DB lookup | HIGH |
| I-03 | Nafis disease report — manual ID generation, appears placeholder | MEDIUM |

### Notifications
| # | Issue | Severity |
|---|-------|----------|
| NT-01 | **No email notifications** — `emitNotification` only creates in-app records | HIGH |
| NT-02 | **No push notifications** — no Firebase, no web push, no APNs | HIGH |
| NT-03 | In-app notifications are not bilingual — single `title`/`message` fields | MEDIUM |
| NT-04 | SMS reminders incomplete — `reminderSentAt` column doesn't exist in schema | MEDIUM |

### SAM Module
| # | Issue | Severity |
|---|-------|----------|
| SAM-01 | 4 of 8 pages are stubs/placeholders (Assistant, Gaps, Issues, Drafts listing) | MEDIUM |

---

## PART 8: CROSS-CUTTING UX ISSUES

### Browser Dialogs (should be replaced with proper modals)
| File | API Used |
|------|----------|
| `OverviewPanel.tsx:187,211` | `confirm()`, `prompt()` |
| `DoctorStation.tsx:237,255` | `confirm()` |
| `NurseStation.tsx:2071` | `prompt()` |
| `PharmacyVerification.tsx:615` | `confirm()` |
| `Payments.tsx:87` | `prompt()` |
| `ConsentForm.tsx:87` | `alert()` |
| `LabCollection.tsx:96` | `alert()` |
| `LabResults.tsx:221` | `alert()` |
| `FollowUpScheduler.tsx:77` | `alert()` |
| `SecuritySettings.tsx:66` | `alert()` |
| `InvoiceScreen.tsx:307` | `alert()` |
| `SchedulingTemplates.tsx:198,231` | `confirm()` |
| `LibraryMetadataDrawer.tsx:227` | `confirm()` |

### Hardcoded `admin@thea.health` (47 occurrences in 43 files)
- Should be `thea@thea.com.sa` or env var `THEA_OWNER_EMAIL`

### `bootstrapSiraOwner` Legacy Name
- **Files:** `lib/system/bootstrap.ts:73`, `app/api/auth/login/route.ts:9,267`
- Should be `bootstrapTheaOwner`

### VAT Hardcoded at 15%
- **File:** `InvoiceScreen.tsx:93`
- Not configurable per tenant or region

---

## RECOMMENDED FIX ORDER

### Phase 1 — Security (Immediate)
1. SEC-01: Fix `/p` → `/p/` in middleware (1 character fix, massive impact)
2. SEC-02 + SEC-06: Fix JWT/cookie/session lifetime mismatch
3. SEC-04: Apply CSRF middleware globally
4. SEC-05: Remove header-based auth in `requireRole`
5. SEC-03: Unify session validation to single-session
6. SEC-07: Implement password reset flow
7. SEC-09/10/11: Fix HL7 authentication + tenant isolation

### Phase 2 — Ghost Endpoints (Quick wins)
8. Fix all 17 ghost endpoint paths (URL corrections)
9. Fix response shape mismatches (key name corrections)

### Phase 3 — Critical Flow Fixes
10. F-01: Implement actual discharge workflow
11. F-02: Add PATCH handler for encounter updates
12. F-03: Add diagnosis tab to visit layout
13. F-11: Add DEATH to ER state machine
14. F-19: Fix IPD discharge/handover dependency
15. F-26: Fix payment status mismatch
16. F-31: Fix MultiResourceBooking response key
17. F-48: Add confirmation dialog to allergy deletion

### Phase 4 — Navigation & Layout
18. N-01: Fix 3 dead mobile nav links
19. L-03/L-04: Remove SessionWarning, keep SessionIdleTimeoutGuard
20. L-01/L-02: Remove duplicate ThemeProvider and Toaster
21. N-02: Add sidebar entries for 40+ orphan pages
22. L-07: Add error boundaries to critical sub-pages

### Phase 5 — Missing Clinical Steps
23. F-35: Lab specimen reception page
24. F-36: Lab pathologist verification
25. F-40-42: Radiology technologist + verification workflow
26. F-44-46: Pharmacy-IPD integration + inventory deduction + controlled substance dual-sign
27. F-37: Critical alert physician notification

### Phase 6 — Schema Integrity
28. S-01: Add Tenant @relation to 250+ models
29. S-04: Add compound indexes to high-traffic models

### Phase 7 — Notifications
30. NT-01/02: Implement email and push notification channels
31. NT-03: Make notifications bilingual

### Phase 8 — Portal
32. F-54: Fix portal reports to use portal-auth API
33. F-55: Complete OTP verification flow
34. F-57: Add missing pages to portal navigation

### Phase 9 — UX Polish
35. Replace all window.prompt/confirm/alert with proper modals
36. Fix all i18n violations (20+ entire pages)
37. Replace hardcoded `admin@thea.health` (47 occurrences)
38. Clean up dead code (10+ files)
39. Remove 462 dead API routes or wire them up

---

## PART 9: ROUND 2 FINDINGS — DEEP DIVE

### 9A. MIDDLEWARE LINE-BY-LINE (33 issues)

| # | Severity | Issue | Line |
|---|----------|-------|------|
| MW-01 | CRITICAL | `/p` prefix bypasses auth for ALL `/p*` routes | 282 |
| MW-02 | CRITICAL | API routes skip ALL auth checks (defense-in-depth gap) | 248-262 |
| MW-03 | CRITICAL | `approved_access_token` cookie never validated (truthy check only) | 386,494 |
| MW-04 | HIGH | 2FA NOT required for `thea-owner` — most privileged accounts exempt | 345 |
| MW-05 | HIGH | Duplicate condition: `pathname.startsWith('/platforms/thea-health')` x2 | 450 |
| MW-06 | HIGH | Cookies set without `secure` flag — transmitted over HTTP | 443,451,453,455 |
| MW-07 | HIGH | `edrac` entitlement granted but platform never checked | 498 |
| MW-08 | HIGH | `isDevSuperAdmin` hardcoded `admin@thea.health` + `tenantId === '1'` backdoor | 592-593 |
| MW-09 | HIGH | RBAC enforcement only for `health` platform — SAM/CVision have zero RBAC | 580 |
| MW-10 | HIGH | Security headers only applied to API routes, NOT page responses | 248-262 vs 677 |
| MW-11 | MEDIUM | Admin route block `if (pathname.startsWith('/admin'))` does NOTHING | 478-483 |
| MW-12 | MEDIUM | Area-based access logic flaw — admin can be denied BILLING area | 651-663 |
| MW-13 | MEDIUM | Content-Length bypass via chunked encoding | 238-244 |
| MW-14 | MEDIUM | `publicPaths` array + check = entirely dead code | 8, 294-297 |
| MW-15 | MEDIUM | Role variants `thea-owner` / `THEA_OWNER` — inconsistent naming | 365 |
| MW-16 | MEDIUM | `/portal` public bypass — all `/portal*` routes skip auth | 283 |
| MW-17 | LOW | No CSP header set anywhere in middleware | — |
| MW-18 | LOW | No rate limiting at middleware level | — |
| MW-19 | LOW | Missing `X-XSS-Protection` header | — |
| MW-20 | LOW | Font files (.woff, .woff2) not excluded from matcher — unnecessary execution | 682 |

### 9B. NURSE STATION + HANDOVER + TASKS + CONSENT + NOTIFICATIONS

#### Nurse Station (2736 lines)
| # | Issue | Severity |
|---|-------|----------|
| NS-01 | `completedSteps` overwritten immediately in `openPanel` — step indicators broken | HIGH |
| NS-02 | Consent save doesn't check response status — reports success on API error | HIGH |
| NS-03 | `startNursing` changes flow state before timestamps — no rollback if second call fails | HIGH |
| NS-04 | 40+ useState hooks in single component — fragile manual resets | MEDIUM |
| NS-05 | `window.prompt` for correction reason | MEDIUM |
| NS-06 | Priority badges Arabic-only in PatientCard | MEDIUM |
| NS-07 | `STATUS_CONFIG` labels Arabic-only | MEDIUM |
| NS-08 | `DAYS`/`MONTHS` arrays English-only | LOW |
| NS-09 | 3 dead code items: `KPICard`, `saveNursing`, `useValueFlash` hooks | LOW |
| NS-10 | "Correct" button visible on read-only records | LOW |

#### Waiting List (888 lines)
| # | Issue | Severity |
|---|-------|----------|
| WL-01 | Double polling — SWR + manual interval both fetch every 15s | MEDIUM |
| WL-02 | Rows not clickable — `useRouter` imported but never used | MEDIUM |
| WL-03 | No real-time event for `PAYMENT_CONFIRMED` | MEDIUM |
| WL-04 | Calendar day headers English-only | LOW |

#### Handover System
| # | Issue | Severity |
|---|-------|----------|
| HO-01 | **No SBAR structure** despite SBARForm component existing — plain text only | HIGH |
| HO-02 | No shift-based handover — encounter-scoped only | HIGH |
| HO-03 | `toUserId` is raw text input — nurse types user ID manually | HIGH |
| HO-04 | No acknowledgment flow — receiving nurse can't confirm receipt | HIGH |
| HO-05 | Create + Finalize use `handover.view` permission for write ops | MEDIUM |
| HO-06 | Notification titles English-only | LOW |

#### Tasks System
| # | Issue | Severity |
|---|-------|----------|
| TK-01 | **No task creation UI** — only API | HIGH |
| TK-02 | No notification on task assignment | HIGH |
| TK-03 | Overdue tasks never detected/escalated — `dueAt` stored but unchecked | HIGH |
| TK-04 | All buttons shown for all statuses (Claim/Start/Done on completed tasks) | MEDIUM |
| TK-05 | All task write ops use `tasks.queue.view` permission | MEDIUM |

#### Consent System
| # | Issue | Severity |
|---|-------|----------|
| CN-01 | **No witness signature** — field exists but UI never collects it | HIGH |
| CN-02 | **No consent revocation** — once signed, cannot be withdrawn | HIGH |
| CN-03 | **No audit log** for consent creation | HIGH |
| CN-04 | `deliveryMethod` collected in UI but not saved by API | MEDIUM |
| CN-05 | Signature stored as base64 in DB — large storage overhead | LOW |

#### Notifications
| # | Issue | Severity |
|---|-------|----------|
| NF-01 | **Status mismatch**: API sets `READ`/`CLOSED`, UI filters `ACKED`/`DISMISSED` — notifications vanish after ack | CRITICAL |
| NF-02 | Two competing notification schemas in same table | HIGH |
| NF-03 | No real-time delivery (WebSocket/SSE) | MEDIUM |
| NF-04 | No pagination past 50 items | MEDIUM |
| NF-05 | "Mark All Read" API exists but UI never calls it | LOW |

### 9C. PATIENT REGISTRATION + SEARCH + MERGE

| # | Issue | Severity |
|---|-------|----------|
| P-01 | **Patient merge only cascades to `encounterCore`** — orders, billing, labs, pharmacy, allergies, insurance all orphaned | CRITICAL |
| P-02 | **Search on encrypted fields uses `contains`** — broken when encryption enabled | CRITICAL |
| P-03 | **Status filter presets (ACTIVE/ADMITTED/DISCHARGED) don't match schema enum (KNOWN/UNKNOWN/MERGED)** — filters return zero results | HIGH |
| P-04 | No DB indexes on iqama, passport, mobile, mrn — full table scans | HIGH |
| P-05 | No unique constraint on iqama/passport — duplicate identifiers possible | HIGH |
| P-06 | Insurance not collected during registration — placeholder only | HIGH |
| P-07 | `link-er-unknown` queries JSON column but creation uses flat columns — mismatch | HIGH |
| P-08 | OPD Registration can't create new patients — must use separate page | MEDIUM |
| P-09 | middleName not collected at creation despite schema having it | MEDIUM |
| P-10 | Duplicate detection ignores phone + doesn't block creation | MEDIUM |
| P-11 | MRN has no @@unique constraint — race condition risk | MEDIUM |
| P-12 | Patient 360, Journey, PatientFile — hardcoded English | MEDIUM |
| P-13 | Patient Stats counts from loaded set only (max 50), not DB totals | MEDIUM |
| P-14 | Portal user `patientMasterId` nullable with no FK | MEDIUM |

### 9D. LIB/ CORE UTILITIES

| # | Issue | Severity |
|---|-------|----------|
| LIB-01 | **CSP `connect-src` written 3 times — only last applies, `'self'` lost** — app can't make same-origin XHR | CRITICAL |
| LIB-02 | **`DATABASE_URL` is optional** — app starts without database | HIGH |
| LIB-03 | **`CANCELLED` not in `FINAL_ER_STATUSES`** — writes to cancelled encounters not blocked | HIGH |
| LIB-04 | **No DB connection retry/backoff** — outage = cascading failure | HIGH |
| LIB-05 | **Missing tenantId returns HTTP 200** instead of 403 — masks auth problems | HIGH |
| LIB-06 | **`isTakTheaTenant` cache never evicts** — unbounded memory leak | HIGH |
| LIB-07 | **Floating-point money arithmetic** — `0.1 * 0.2` precision errors | HIGH |
| LIB-08 | **Hardcoded consultation prices** (200/100 SAR) when catalog empty | HIGH |
| LIB-09 | TAK_Thea bypass skips permission + platform checks | MEDIUM |
| LIB-10 | `deriveErRole` defaults to `admin` (most privileged) | MEDIUM |
| LIB-11 | `ensureDoctorAssignedToEncounter` guard always allows access | MEDIUM |
| LIB-12 | PlatformKey: `thea-health` vs `thea_health` inconsistency between files | MEDIUM |
| LIB-13 | 4 separate audit systems writing to same table with different schemas | MEDIUM |
| LIB-14 | ER notifications dedup query missing tenantId — cross-tenant dedup | MEDIUM |
| LIB-15 | 6 `$queryRawUnsafe` calls in billing | MEDIUM |
| LIB-16 | Charge event duplicate check has race condition | MEDIUM |
| LIB-17 | Field encryption key no length validation | MEDIUM |
| LIB-18 | Production config validation silences all exceptions | MEDIUM |
| LIB-19 | Discharge guards use `(prisma as any).dischargeSummary` — model may not exist | MEDIUM |

### 9E. SPECIALTY MODULES (ICU, OR, Psychiatry, Oncology, Telemedicine, etc.)

| # | Issue | Module | Severity |
|---|-------|--------|----------|
| SP-01 | Brain Death: 4 API calls to non-existent routes | ICU | CRITICAL |
| SP-02 | Organ Donation: `/advance` route missing | ICU | HIGH |
| SP-03 | OR Post-Op: `/bulk-post-op-status` route missing | OR | HIGH |
| SP-04 | ICU bed capacity hardcoded to 20 | ICU | MEDIUM |
| SP-05 | ICU Bundles: manual episode ID text input | ICU | MEDIUM |
| SP-06 | Oncology: "+ New Patient" button dead (no onClick) | Oncology | HIGH |
| SP-07 | Oncology: patient table rows look clickable but aren't | Oncology | MEDIUM |
| SP-08 | Psychiatry: assessment rows same dead-click issue | Psychiatry | MEDIUM |
| SP-09 | PsychScales: `useState` misused as side effect | Psychiatry | MEDIUM |
| SP-10 | OR Surgeon: `useMemo` used for side effects | OR | LOW |
| SP-11 | OR Surgeon: Preferences tab is stub/placeholder | OR | LOW |
| SP-12 | Telemedicine: status badges raw English strings | Telemedicine | LOW |
| SP-13 | Physiotherapy: specialty dropdown raw snake_case English | Physiotherapy | LOW |

### Modules confirmed clean:
- **Blood Bank** — APIs match, bilingual, no critical issues
- **Infection Control** — 6 tab components all exist, APIs match
- **Transport** — APIs match, functional
- **Transplant** — APIs match, functional
- **Downtime Pack** — Read-only, properly guarded

### 9F. PRISMA SCHEMA EXHAUSTIVE AUDIT (534 models across 49 files)

#### Missing Tenant Relation (~300+ models) — CRITICAL
The vast majority of models have `tenantId String @db.Uuid` but **no `@relation` to Tenant**. Only ~40 models (in core, opd, er, orders, clinical_infra, scheduling, care_gaps) have proper relations. ALL other models (~300+) across billing, ipd, or, discharge, pharmacy, lab, portal, integration, analytics, misc, telemedicine, transplant, psychiatry, oncology, quality, sam, workflow, consumables, blood_bank, cssd, equipment, pathology, physiotherapy, referrals, taxonomy, ehr_admin, admission, ai are missing the relation.

**Impact:** No FK enforcement, no cascade deletes, no referential integrity at DB level for tenant isolation.

#### Missing FK Relations (~200+ bare string FKs) — HIGH
Most FK references across all domain models use bare `String @db.Uuid` instead of `@relation`. Examples:
- **IPD**: `episodeId`, `patientMasterId`, `bedId` — all bare strings, no FK constraint
- **OR**: `orderId`, `encounterCoreId`, `patientMasterId` — bare strings
- **Billing**: all FKs — bare strings
- **Discharge**: `encounterCoreId` — bare string
- **Telemedicine, Transplant, Pharmacy, Lab**: all FKs — bare strings

**Impact:** Orphaned records when parent entities are deleted. No referential integrity.

#### Missing Cascade Rules — HIGH
Only **13 relations** in the entire schema specify `onDelete`. All other ~100+ relations default to `Restrict`. Deleting an ER encounter will fail because all child records (triage, bed assignment, staff, notes, etc.) block it — but no cascades are defined to auto-clean children.

#### Missing Indexes — HIGH
| Model | Missing Index |
|-------|--------------|
| `PatientMaster` | `@@index([tenantId, mrn])`, `@@index([tenantId, mobile])` |
| `ErEncounter` | Indexes on `patientId` and `status` lack tenantId prefix |
| `SchedulingSlot` | `@@index([tenantId, date])` for date-range queries |
| All ER child models | No `@@index([tenantId])` — rely only on encounterId lookups |
| All IPD child models | Only compound `[tenantId, episodeId]` — no standalone tenantId |

#### Missing @@unique Constraints — MEDIUM-HIGH
| Model | Missing Constraint |
|-------|--------------------|
| `PatientMaster` | `@@unique([tenantId, mrn])` — duplicate MRNs possible |
| `PatientPortalUser` | `@@unique([tenantId, mobile])` — duplicate portal users |
| `IpdEpisode` | `@@unique([tenantId, encounterId])` — multiple episodes per encounter |
| `ErEncounter` | `@@unique([tenantId, visitNumber])` — duplicate visit numbers |
| `SchedulingReservation` | `@@unique([tenantId, slotId, patientId])` — double-booking |
| `LabTestCatalog` | `@@unique([tenantId, code])` — duplicate test codes |
| `BloodUnit` | `@@unique` on unit number per tenant |
| `BillingPayment` | `@@unique` on transaction reference per tenant |

#### Optional Fields That Should Be Required — HIGH
| Field | Issue |
|-------|-------|
| `PatientPortalRateLimit.tenantId` | `String?` — tenantId should never be optional |
| `User.tenantId` | `String?` — should be explicit platform-level vs tenant-level |
| `Notification.tenantId` | `String?` |
| `ErPatient.status` | `String?` — should be non-nullable |
| `IpdAdmission.episodeId` | `String?` — admission must have episode |
| `IpdAdmission.patientMasterId` | `String?` — admission must have patient |

#### Enum Completeness — MEDIUM
~100+ string fields across billing, IPD, OR, discharge, telemedicine, transplant, pharmacy, misc, workflow use `String` with comment-documented values instead of Prisma enums. The database cannot enforce valid values.

Missing enum values:
- `EncounterType`: missing OR, TELEMEDICINE, DAY_SURGERY
- `EncounterSourceSystem`: missing OR, TELEMEDICINE, PORTAL
- `ErArrivalMethod`: missing REFERRAL, POLICE, AIR_AMBULANCE

#### Date Field Issues — MEDIUM
- ~20 mutable models missing `updatedAt` (DischargeSummary, DischargePrescription, ErNote, ErDoctorNote, IpdVitals, IpdAdmission, etc.)
- `MortuaryCase.updatedAt` is `DateTime?` (nullable, manually set) instead of `@updatedAt` (auto-managed)

#### Positive: ID Generation — Consistent
All 534 models use `@default(dbgenerated("gen_random_uuid()")) @db.Uuid`. No inconsistencies.

#### Positive: Migration Complete
All 22 MongoDB collections listed in CLAUDE.md have Prisma model equivalents. Zero missing models.

---

## PART 10: ROUND 3 FINDINGS — FINAL SWEEP

### 10A. SCRIPTS & LEGACY MONGODB CODE

#### Hardcoded Credentials in Scripts (CRITICAL)
| # | File | Line | Issue |
|---|------|------|-------|
| SC-01 | `scripts/create-owner.ts` | 30-31 | Hardcoded `OWNER_PASSWORD = 'Thea@Owner2025!'` in source code |
| SC-02 | `scripts/create-owner-pg.ts` | 20 | Hardcoded `password = 'Owner@123'` in source code |
| SC-03 | `scripts/bootstrapOwner.ts` | 57 | Hardcoded `temporaryPassword = 'Owner@123'` in source code |
| SC-04 | `scripts/grant-all-permissions-to-admin.js` | 38 | Hardcoded `ADMIN_EMAIL = 'admin@hospital.com'` — outdated |
| SC-05 | `scripts/grant-all-permissions-to-admin.ts` | 180 | Same hardcoded email |

#### Docker Hardcoded Credentials
| # | File | Line | Issue |
|---|------|------|-------|
| SC-06 | `docker-compose.yml` | 64 | Orthanc credentials: `{"thea": "thea-secure-key"}` |
| SC-07 | `docker-compose.yml` | 94 | Mirth DB password: `DATABASE_PASSWORD=mirth` |
| SC-08 | `docker-compose.yml` | 118 | Mirth DB password: `POSTGRES_PASSWORD=mirth` |

#### MongoDB Scripts Still Present (8 scripts will FAIL)
| # | File | Issue |
|---|------|-------|
| SC-09 | `scripts/ensure-cdo-indexes.js` | Uses MongoDB `MongoClient` — project migrated to PostgreSQL |
| SC-10 | `scripts/migrate-sessions.js` | MongoDB migration — incompatible with PostgreSQL |
| SC-11 | `scripts/upload-pdf-policies.js` | Uses MongoDB driver |
| SC-12 | `scripts/delete-all-policies.js` | MongoDB-based, no PostgreSQL equivalent |
| SC-13 | `scripts/grant-all-permissions-to-admin.js` | Uses MongoDB `MongoClient` |
| SC-14 | `scripts/check-policies-count.js` | MongoDB aggregation queries |
| SC-15 | `scripts/migrate-audit-logs.js` | Creates MongoDB TTL indexes |
| SC-16 | `scripts/migrations/014_migrate_users_to_tenant_db.ts` | MongoDB `MongoClient` |

#### Config File Issues
| # | File | Issue | Severity |
|---|------|-------|----------|
| SC-17 | `render.yaml:12,14-15` | Still expects `MONGO_URL` and `DB_NAME` — PostgreSQL migration incomplete | HIGH |
| SC-18 | `.env.example:24-29` | Legacy MongoDB vars (`MONGO_URL`, `MONGODB_URI`, `DB_NAME`, `MONGODB_DB`) still listed | MEDIUM |
| SC-19 | `package.json:66-68` | `migrate:tenant1`, `migrate:transfer-tenants` reference MongoDB | HIGH |
| SC-20 | `package.json:81` | `seed:icd10` may reference old DB | MEDIUM |

#### CRITICAL: Real Secrets on Disk
| # | File | Line | Secret |
|---|------|------|--------|
| SEC-19 | `.env.local` | 9 | Real JWT_SECRET exposed |
| SEC-20 | `.env.local` | 22 | Real OpenAI API key (`sk-proj-...`) |
| SEC-21 | `.env.local` | 31 | Real ADMIN_DELETE_CODE (`RN@fadl123456`) |
| SEC-22 | `.env.local` | 34 | Real MSEGAT API key |
| SEC-23 | `.env.local` | 38-39 | Real Twilio Account SID + Auth Token |
| SEC-24 | `.env.local` | 41-43 | Real Supabase DB credentials + password |
| SEC-25 | `.env.local` | 29 | Weak FIELD_ENCRYPTION_KEY (`dev-local-key-123...`) — not real AES-256 |
| SEC-26 | `Thea-engine/.env` | 3 | Same real OpenAI API key duplicated |
| SEC-27 | `.env.local` | 27 | `THEA_TEST_MODE=true` — bypasses security checks |

**Note:** `.env.local` is in `.gitignore` and NOT tracked by git, but secrets should still be rotated as a precaution.

#### Infrastructure Issues
| # | File | Issue | Severity |
|---|------|-------|----------|
| INF-01 | `Dockerfile:33,61-62` | Copies `.next/standalone` but `next.config.js` does NOT set `output: 'standalone'` — **Docker builds FAIL** | CRITICAL |
| INF-02 | `docker-compose.yml:42` | Redis port 6379 exposed to host with **no password** | HIGH |
| INF-03 | `docker-compose.yml:30` | Health check calls `/api/opd/health` — route doesn't exist | HIGH |
| INF-04 | `tsconfig.json:12-13` | `strict: false` + `noImplicitAny: false` — no type safety for EHR handling PHI | HIGH |
| INF-05 | `package.json:23` | `"lint": "next lint --max-warnings=0 \|\| true"` — lint NEVER fails (CI gate useless) | HIGH |
| INF-06 | `next.config.js:25` | Deprecated `experimental.serverComponentsExternalPackages` → should be `serverExternalPackages` | MEDIUM |
| INF-07 | `render.yaml:3,11,15` | Service name still `hospitalos`, references `MONGO_URL` + `DB_NAME: hospital_ops` | MEDIUM |
| INF-08 | `scripts/migrate-legacy-to-thea.ts:7-13` | No-op script — sets `role: 'thea-owner'` WHERE `role: 'thea-owner'` (same value) | MEDIUM |
| INF-09 | `.github/workflows/deploy.yml:97,149,181` | TODO placeholders instead of actual deploy commands — staging/prod deploys do nothing | MEDIUM |
| INF-10 | `.github/workflows/quality-gate.yml:91` | Quality check fallback `\|\| echo '{"passed":true}'` — silently passes on failure | MEDIUM |
| INF-11 | `package.json:179` | `xlsx@0.18.x` has known prototype pollution vulnerabilities | MEDIUM |
| INF-12 | `lib/env.ts` | 15+ security-critical env vars NOT validated: `CSRF_SECRET`, `COOKIE_DOMAIN`, `SESSION_*`, `ACCOUNT_LOCKOUT_*`, `TWILIO_*`, all CVision vars | MEDIUM |
| INF-13 | `.env.example:153` | `CORS_ORIGINS=*` — allows all origins | MEDIUM |
| INF-14 | `tsconfig.json:18` | `moduleResolution: "node"` instead of `"bundler"` (Next.js 14 recommendation) | LOW |
| INF-15 | `.gitignore:75-97` | References `policy-engine/` but actual directory is `Thea-engine/` — Python cache not covered | LOW |

#### 60+ Undocumented Environment Variables
Code references 60+ env vars NOT in `.env.example`: `APP_CODE`, `APP_NAME`, `DB_POOL_MAX`, `DB_POOL_MIN`, `EMAIL_FROM`, `EMAIL_PROVIDER`, `FEATURE_AI_MATCHING`, `FEATURE_DEMO_MODE`, `FEATURE_WHATSAPP_NOTIFICATIONS`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NPHIES_LICENSE_ID`, `NPHIES_PROVIDER_ID`, etc. Developers won't know these exist.

---

### 10B. HARDCODED `admin@thea.health` + `tenantId === '1'` BYPASS (41 files)

Full list of files using the `isDevSuperAdmin` pattern (`email === 'admin@thea.health' || tenantId === '1'`):

| # | File | Severity |
|---|------|----------|
| R3-01 | `app/api/auth/me/route.ts` | HIGH |
| R3-02 | `app/api/auth/login/route.ts` | HIGH |
| R3-03 | `app/api/results/[orderResultId]/ack/route.ts:19,26` | HIGH |
| R3-04 | `app/api/order-sets/route.ts:15,18` | HIGH |
| R3-05 | `app/api/order-sets/[id]/apply/route.ts:13-15` | HIGH |
| R3-06 | `app/api/order-sets/[id]/archive/route.ts` | HIGH |
| R3-07 | `app/api/order-sets/[id]/items/route.ts` | HIGH |
| R3-08 | `app/api/er/doctor/my-patients/route.ts:8-13` | HIGH |
| R3-09 | `app/api/er/doctor/decision-queue/route.ts` | HIGH |
| R3-10 | `app/api/er/doctor/results/route.ts:10-15` | HIGH |
| R3-11 | `app/api/er/doctor/results/ack/route.ts` | HIGH |
| R3-12 | `app/api/er/doctor/notes/route.ts` | HIGH |
| R3-13 | `app/api/er/doctor/encounters/[encounterId]/notes/route.ts` | HIGH |
| R3-14 | `app/api/er/nursing/escalations/route.ts` | HIGH |
| R3-15 | `app/api/er/nursing/tasks/status/route.ts` | HIGH |
| R3-16 | `app/api/er/nursing/tasks/route.ts:18-20` | HIGH |
| R3-17 | `app/api/er/nursing/handovers/route.ts:13-15` | HIGH |
| R3-18 | `app/api/er/nursing/assessment/route.ts` | HIGH |
| R3-19 | `app/api/er/nursing/my-patients/route.ts:13-15` | HIGH |
| R3-20 | `app/api/er/nursing/notes/route.ts:16-18` | HIGH |
| R3-21 | `app/api/er/nursing/transfer-requests/route.ts:13-15` | HIGH |
| R3-22 | `app/api/er/nursing/encounters/[encounterId]/*` (6 sub-routes) | HIGH |
| R3-23 | `app/api/notifications/inbox/route.ts` | HIGH |
| R3-24 | `app/api/notifications/emit/route.ts` | HIGH |
| R3-25 | `app/api/admin/roles/[roleKey]/route.ts` | HIGH |
| R3-26 | `app/(dashboard)/scheduling/resources/SchedulingResources.tsx` | HIGH |
| R3-27 | `app/(dashboard)/scheduling/templates/SchedulingTemplates.tsx` | HIGH |
| R3-28 | `app/(dashboard)/results/Results.tsx` | HIGH |
| R3-29 | `app/(dashboard)/ipd/episode/[episodeId]/IPDEpisode.tsx:50` | HIGH |
| R3-30 | `app/(dashboard)/er/nurse-station/ERNurseStation.tsx` | HIGH |
| R3-31 | `app/(dashboard)/er/doctor/ERDoctor.tsx` | HIGH |
| R3-32 | `app/(dashboard)/er/encounter/[encounterId]/EREncounter.tsx` | HIGH |
| R3-33 | `app/(dashboard)/er/nursing/ERNursing.tsx` | HIGH |

**Impact:** Any user with `tenantId === '1'` OR email `admin@thea.health` gets full admin access across 41+ routes.

---

### 10C. API ROUTE DEEP-READ FINDINGS

#### RACE-01. MRN Allocation Race Condition (CRITICAL)
- **File:** `app/api/patients/route.ts:108-113`
- **Problem:** `allocateShortCode()` called outside transaction. Two concurrent requests → same MRN for two patients.
- **Impact:** Duplicate patient identifiers — clinical safety risk

#### RACE-02. Payment Recording Race Condition (HIGH)
- **File:** `app/api/billing/payments/record/route.ts:94-132`
- **Problem:** Idempotency check + create not wrapped in transaction. Concurrent requests → duplicate payments.

#### RACE-03. Billing Posting Lock Race Condition (MEDIUM)
- **File:** `app/api/billing/posting/post/route.ts:88-101`
- **Problem:** Lock check → action not atomic. Another process can release lock between check and post.

#### VAL-01. ER Status Backward Transitions Allowed (CRITICAL)
- **File:** `app/api/er/encounters/status/route.ts:90-102`
- **Problem:** No forward-only enforcement. Patient can go `DISCHARGED → ACTIVE`. `statusRank()` function exists but unused.

#### VAL-02. Triage Score No Validation (CRITICAL)
- **File:** `app/api/er/triage-score/route.ts:32-39`
- **Problem:** POST accepts raw body with zero schema validation. Invalid triage scores (>5, <1), missing vitals allowed.
- **Code:** `(prisma as any).erTriageScore.create({ data: { tenantId, ...body } })`

#### VAL-03. Scheduling Slot Generation Missing Validation (MEDIUM)
- **File:** `app/api/scheduling/slots/generate/route.ts:92-97`
- **Problem:** Schema validated but validated output not used — raw body re-destructured.

#### RBAC-01. Billing Role Check Overly Permissive (MEDIUM)
- **File:** `app/api/billing/posting/post/route.ts:18-25`
- **Problem:** `roleLower.includes('staff')` matches any user with "staff" in role — too broad.

#### SQL-01. Dynamic SQL in Policy Search (MEDIUM)
- **File:** `app/api/er/policies/search/route.ts:63-96`
- **Problem:** Dynamic placeholder construction in `$queryRawUnsafe` — while parameterized, the index concatenation could be exploited.

#### DBOOK-01. Scheduling Double-Booking Check Incomplete (MEDIUM)
- **File:** `app/api/scheduling/reservations/create/route.ts:108-129`
- **Problem:** Transaction re-checks slot but gap between initial check and transaction start allows race.

#### TZ-01. Timezone Silently Converted UTC → Asia/Riyadh (MEDIUM)
- **File:** `app/api/scheduling/slots/generate/route.ts:52-63`
- **Problem:** `if (tz.toUpperCase() === 'UTC') return 'Asia/Riyadh'` — any template actually in UTC gets slots shifted by +3 hours.

#### RACE-04. Patient Creation Race Condition — Duplicate Identifiers (MEDIUM)
- **File:** `app/api/patients/route.ts:76-90`
- **Problem:** `findFirst()` check → create has gap allowing concurrent duplicates with same iqama/passport. No `@@unique` constraint at DB level.

#### API-01. ER Triage Score GET Has No Pagination Limit (MEDIUM)
- **File:** `app/api/er/triage-score/route.ts:18-22`
- **Problem:** No `take` parameter — returns unlimited rows. Memory bomb risk.

#### API-02. Walk-In Booking No Idempotency (MEDIUM)
- **File:** `app/api/opd/booking/walk-in/route.ts:78-99`
- **Problem:** No clientRequestId or idempotency key — double-click creates duplicate bookings.

#### API-03. Owner Users Endpoint Leaks Tenant UUID (LOW)
- **File:** `app/api/owner/users/route.ts:64`
- **Problem:** Returns raw tenantId to owner UI — information disclosure.

### 10C-Extended. API ROUTE DEEP-READ — DETAILED BUSINESS LOGIC FINDINGS

#### Billing — Invoice Marked PAID Without Amount Check (CRITICAL)
| # | Issue | File | Severity |
|---|-------|------|----------|
| PAY-01 | **Payment status is client-controlled** — client can send `status: 'COMPLETED'` to mark any invoice as paid without verification | `billing/payments/route.ts:61` | CRITICAL |
| PAY-02 | **Invoice marked PAID based on single payment regardless of amount** — 1 SAR payment on 10,000 SAR invoice → PAID | `billing/payments/route.ts:100-105` | CRITICAL |
| PAY-03 | No billing lock check on payments (unlike charge-events) | `billing/payments/route.ts` | HIGH |

#### IPD Bed Assignment — Race Conditions + Null Patient (CRITICAL)
| # | Issue | File | Severity |
|---|-------|------|----------|
| BED-01 | **Bed occupancy check + admission create NOT in transaction** — two concurrent assigns → double-booked bed | `ipd/episodes/[episodeId]/bed/assign/route.ts:53-72` | CRITICAL |
| BED-02 | **`patientMasterId` always null** — `(episode as any)?.patient?.id` but no `include: { patient }` in query → always undefined | `bed/assign/route.ts:67` | HIGH |
| XFER-01 | Same race condition on bed transfer | `bed/transfer/route.ts:66-91` | CRITICAL |
| XFER-02 | **Release old bed + create new NOT atomic** — if create fails, patient has NO bed | `bed/transfer/route.ts:74-91` | CRITICAL |
| XFER-03 | Same `patientMasterId` null bug | `bed/transfer/route.ts:84` | HIGH |

#### IPD Discharge Summary — No Validation, Wrong Permission, No Audit
| # | Issue | File | Severity |
|---|-------|------|----------|
| DISCH-01 | **POST accepts arbitrary JSON with ZERO validation** — any field can be set to any value | `discharge-summary/route.ts:37-94` | CRITICAL |
| DISCH-02 | **Write operation requires only `ipd.live-beds.view`** — anyone who can view beds can modify discharge summaries | `discharge-summary/route.ts:114` | HIGH |
| DISCH-03 | Uses `(prisma as any).enhancedDischargeSummary` — model may not exist in schema | `discharge-summary/route.ts:19,53,98` | HIGH |
| DISCH-04 | **No audit logging on create/update** — only write endpoint without audit trail | `discharge-summary/route.ts` | HIGH |
| DISCH-05 | No check for episode status — can edit finalized discharge summary | `discharge-summary/route.ts` | MEDIUM |

#### OPD Flow State — Multiple Non-Atomic Updates
| # | Issue | File | Severity |
|---|-------|------|----------|
| FLOW-01 | **`_version` optimistic locking is optional** — clients that omit it bypass race protection entirely | `flow-state/route.ts:54-138` | HIGH |
| FLOW-02 | **Up to 5 sequential updates to same row without transaction** — partial state on any failure | `flow-state/route.ts:135-282` | HIGH |
| FLOW-03 | Booking status updated outside transaction on visit completion | `flow-state/route.ts:224-234` | MEDIUM |

#### OPD Nursing — Zod Output Ignored + State Bypass
| # | Issue | File | Severity |
|---|-------|------|----------|
| NURS-01 | **Zod schema validates body but output discarded** — raw body used instead, bypassing transforms/defaults | `nursing/route.ts:122-335` | HIGH |
| NURS-02 | **Flow state check skipped when `opdFlowState` is null** — nursing entries created before patient enters flow | `nursing/route.ts:165-176` | MEDIUM |
| NURS-03 | Critical vitals flag `nursingEntryId` temporarily null between transaction and backfill | `nursing/route.ts:338-410` | MEDIUM |
| NURS-04 | **PATCH (correction) doesn't check if encounter is CLOSED** — corrections written to closed encounters | `nursing/route.ts:442-514` | HIGH |

#### OPD Orders — No Transaction on Bulk + Pharmacy Silent Failure
| # | Issue | File | Severity |
|---|-------|------|----------|
| ORD-01 | **Bulk order creation in loop without transaction** — if 3rd of 5 fails, first 2 are committed, no rollback | `orders/route.ts:180-255` | HIGH |
| ORD-02 | **OrdersHub sync failure silently swallowed** — order exists but worklist never sees it | `orders/route.ts:241-244` | HIGH |
| ORD-03 | **No death guard on POST** — orders can be created for deceased patients before encounter is formally closed | `orders/route.ts` | MEDIUM |
| ORDERS-02 | **Patient allergy query missing `tenantId`** — cross-tenant allergy data possible | `orders/route.ts:117-119` | HIGH |
| ORDERS-03 | **Pharmacy bridge failure `catch(() => {})`** — medications never reach pharmacy, zero notification | `orders/route.ts:308` | HIGH |
| ORDERS-04 | Patient lookup in pharmacy bridge missing `tenantId` | `orders/route.ts:294-297` | MEDIUM |

#### OPD Booking — Rate Limit Race + Walk-In No Transaction
| # | Issue | File | Severity |
|---|-------|------|----------|
| BOOK-01 | Rate limit via DB count query — 10 concurrent requests all see count=9 and proceed | `booking/create/route.ts:26-35` | MEDIUM |
| WALK-01 | **3 records created sequentially (encounter + OPD + booking) without transaction** — orphaned records on failure | `booking/walk-in/route.ts:37-99` | HIGH |

#### Visit Notes + Results — Wrong Permissions + Scope Not Enforced
| # | Issue | File | Severity |
|---|-------|------|----------|
| VN-01 | **Death guard on GET read** — doctors cannot view deceased patient's notes | `visit-notes/route.ts:32-34` | MEDIUM |
| VN-03 | **GET requires `opd.visit.edit` permission** — read requires edit perm | `visit-notes/route.ts:59` | HIGH |
| RES-04 | **`scope=mine` parameter accepted but NOT enforced** — user sees ALL results regardless | `results/inbox/route.ts:49` | HIGH |
| RES-01 | No pagination on results inbox — unlimited rows loaded to memory | `results/inbox/route.ts:78-101` | MEDIUM |

#### Billing Claims + Invoices
| # | Issue | File | Severity |
|---|-------|------|----------|
| CLAIM-01 | Claim number predictable + not unique (same encounter, same day → same number) | `claim-draft/route.ts:156` | MEDIUM |
| INV-01 | `limit` parameter unbounded — `limit=999999` loads all payments | `invoices/recent/route.ts:13` | MEDIUM |
| INV-02 | Endpoint named `/invoices/recent` but queries `billingPayment` — misleading | `invoices/recent/route.ts:18` | LOW |
| BILL-02 | **`overridePreauthCheck` not in Zod schema** — any client can bypass pre-auth enforcement | `charge-events/route.ts:148` | HIGH |

#### Zod Validation Pattern Bug (Systemic — 3+ routes)
Routes validate body with Zod but then extract fields from raw `body` instead of `v.data`:
- `nursing/route.ts:122-335` (NURS-01)
- `scheduling/reservations/create/route.ts:31-57` (SCHED-01)
- `orders/route.ts:50-77` (ORDERS-01)

**Impact:** All Zod transforms, defaults, and type coercions are bypassed. Unknown fields are not stripped.

---

### 10D. LARGE FILES DEEP-READ FINDINGS

#### CRITICAL: Structure Management Edit Is Completely Broken
| # | Issue | File | Severity |
|---|-------|------|----------|
| LF-01 | **"Update" button calls `handleCreate()`** — always POSTs, creates DUPLICATE nodes instead of updating. No PUT/PATCH anywhere in file. `editingNode` state is set but never used in API calls. **Data corruption.** | `admin/structure-management/StructureManagement.tsx:953,432` | CRITICAL |
| LF-02 | **Force delete button checks English names only** (`'emergency'`, `'quality'`, `'surgery'`) — Arabic-named departments (`طوارئ`) can never be force-deleted | `StructureManagement.tsx:619-626` | HIGH |
| LF-03 | **30+ English-only hardcoded strings** in admin structure UI — violates i18n rule | `StructureManagement.tsx:486-954` | MEDIUM |

#### Missing `credentials: 'include'` (API Calls Fail in Production)
| # | File | Lines | Impact |
|---|------|-------|--------|
| LF-04 | `quality/mortality-review/MortalityReview.tsx` | 17, 279 | All fetches + saves fail — no JWT cookie sent |
| LF-05 | `oncology/radiation-therapy/RadiationTherapy.tsx` | 103, 468 | All SWR + mutations fail |
| LF-06 | `scheduling/appointments/Appointments.tsx` | 23 | 1689-line file — all SWR calls broken |

#### Silent Error Swallowing
| # | File | Lines | Issue |
|---|------|-------|-------|
| LF-07 | `MortalityReview.tsx` | 279-305 | Save fails silently — dialog closes, user thinks it worked |
| LF-08 | `AdmissionOfficeDashboard.tsx` | 789-797 | Insurance verification `catch {}` — empty |
| LF-09 | `AdmissionOfficeDashboard.tsx` | 602-614 | `toggleChecklistItem` — no error check on PATCH response |
| LF-10 | `Registration.tsx` | 376-391 | `apply-to-patient` identity linkage `catch {}` — patient created without identity |

#### Logic/Data Issues
| # | File | Issue | Severity |
|---|------|-------|----------|
| LF-11 | `AdmissionOfficeDashboard.tsx:581` | `method: body ? 'POST' : 'POST'` — dead ternary, missing GET path | LOW |
| LF-12 | `sam/integrity/Integrity.tsx:458` | `updateFindingStatus` uses POST instead of PATCH/PUT — will 405 if endpoint expects PATCH | MEDIUM |
| LF-13 | `sam/conflicts/page.tsx:126-134` | `useEffect` calls `handleScan` with stale closure — missing dependency | MEDIUM |
| LF-14 | `sam/conflicts/page.tsx:182-228` | Rewritten policies stored in localStorage with no size limit — `QuotaExceededError` risk | LOW |
| LF-15 | `TransplantWaitlist.tsx:222-229` | URL params rebuilt on every render outside `useMemo` — unnecessary SWR refetches | LOW |
| LF-16 | `Registration.tsx:191-224` | Duplicate merge-clearing `useEffect` hooks — redundant toasts | LOW |

---

## FINAL STATISTICS

| Category | Count |
|----------|-------|
| **Total Unique Issues** | **~470+** |
| Critical Security | 20 |
| High Security | 32 |
| Ghost Endpoints (404) | 17 |
| Dead API Routes | 462 |
| Broken Flows / Dead Ends | 30+ |
| Missing Clinical Steps | 15+ |
| Schema: Missing Tenant Relation | ~300 models |
| Schema: Missing FK Relations | ~200 bare string FKs |
| Schema: Missing Indexes | ~30 models |
| Schema: Missing Unique Constraints | ~15 models |
| Schema: Missing Cascades | ~100 relations |
| i18n Violations (entire pages) | 40+ pages |
| Dead Buttons / No-Op UI | 20+ |
| Silent Error Swallowing | 40+ locations |
| **Missing `credentials: 'include'`** | **~45 files (SYSTEMIC)** |
| Missing `useRoutePermission` | 8+ pages |
| Invalid Tailwind Classes | 6+ locations |
| Structure Mgmt Edit Broken (creates dupes) | 1 critical |
| Dead Code | 15+ files/functions |
| Legacy MongoDB Scripts (will fail) | 8 scripts |
| Hardcoded Credentials in Scripts/Docker | 8 instances |
| `isDevSuperAdmin` Bypass | 41 files |
| Race Conditions (MRN, payments, locks, beds) | 4 |
| Missing Input Validation (API routes) | 5+ routes |
| Undocumented Env Vars | 60+ |
| Missing Error Boundaries | 350+ pages |
| Notification System | Status mismatch + 2 competing schemas |
| Handover System | No SBAR, no shift-based, no acknowledgment |
| Tasks System | No creation UI, no overdue detection |
| Consent System | No witness, no revocation, no audit log |
| Patient Merge | Only cascades to 1 of 10+ tables |
| Real Secrets on Disk (.env.local) | 9 secrets |
| Dockerfile Broken (standalone mismatch) | 1 critical |
| Infrastructure Issues (CI/CD, config) | 15 |

---

## 11. ROUND 4 — PAGE-BY-PAGE SWEEP (86 medium EHR pages, 200-500 lines each)

### 11A. SYSTEMIC: Missing `credentials: 'include'` (~45 files)

**THIS IS THE #1 SYSTEMIC BUG.** ~45 page files define their SWR fetcher as `fetch(url).then(r => r.json())` WITHOUT `credentials: 'include'`. Since the app uses HTTP-only cookies for auth, ALL data fetches and mutations in these files will return 401 in production. The pages appear to work in dev (if cookies are sent automatically) but BREAK completely in production.

**Complete list of affected files:**

| Module | File | Lines (fetcher + mutations) |
|--------|------|-----------------------------|
| **Lab** | LabCriticalAlerts.tsx | 27, 99 |
| **Lab** | LabCollection.tsx | 9, 76 |
| **Lab** | LabQC.tsx | 8, 60 |
| **Lab** | LabDashboard.tsx | 19 |
| **Pharmacy** | PharmacyReports.tsx | 8 |
| **Pharmacy** | PharmacyPatientLookup.tsx | 8 |
| **Pharmacy** | PharmacyDashboard.tsx | 9 |
| **Pharmacy** | AdcDashboard.tsx | 13 |
| **Pharmacy** | IvAdmixtureDashboard.tsx | 16, 52, 68, 87, 101 |
| **Radiology** | SpeechSettings.tsx | 15, 84 |
| **Infection Ctrl** | HandHygieneCompliance.tsx | 38, 135 |
| **Infection Ctrl** | AntibioticStewardship.tsx | 26 |
| **OBGYN** | LaborDoctorStation.tsx | 11, 56 |
| **Dental** | DentalTreatment.tsx | 8, 66, 268 |
| **Dental** | DentalChart.tsx | 8, 101 |
| **ICU** | ICUFlowsheet.tsx | 12 |
| **ICU** | ICUDashboard.tsx | 24 |
| **Nutrition** | KitchenDashboard.tsx | 13, 52, 68 |
| **Referrals** | Referrals.tsx | 23, 66, 73 |
| **Billing** | PricingPackages.tsx | 13, 100, 128, 149, 171, 199 |
| **Billing** | NPHIESDashboard.tsx | 19, 96 |
| **Billing** | Claims.tsx | 13, 57, 73, 84, 99, 110 |
| **Billing** | InvoiceDraft.tsx | 14, 64, 79, 98 |
| **Billing** | BillingRevenueCycle.tsx | 19 |
| **Billing** | Statement.tsx | 14, 71, 90 |
| **Billing** | Payments.tsx | 15, 58, 92 |
| **Billing** | PendingOrders.tsx | 20 |
| **ER** | ERDoctor.tsx | 25, 87 |
| **ER** | ERCharge.tsx | 44, 89, 113 |
| **ER** | ERTriage.tsx | 57, 110, 149 |
| **ER** | ERBoard.tsx | 37 |
| **ER** | ERCommand.tsx | 43 |
| **IPD** | IPDAudit.tsx | 54, 126 |
| **IPD** | Continuity.tsx | 77-89 |
| **OPD** | NewAppointmentPage.tsx | 8, 126 |
| **OPD** | OPDAnalyticsExtended.tsx | 20 |
| **OPD** | OPDAnalytics.tsx | 11 |
| **OPD** | OPDDashboard.tsx | 88-90 |
| **OPD** | CareGapsDashboard.tsx | 8 |
| **Scheduling** | SchedulingResources.tsx | 15, 109, 156, 196 |
| **Orders** | Orders.tsx | 11, 102, 129, 150 |
| **Orders** | OrderSets.tsx | 9, 119 |
| **Admin** | RoutingRules page.tsx | 11, 73, 78, 89 |
| **Admin** | ReminderSettings.tsx | 8, 55, 72, 84 |
| **Admin** | CbahiComplianceDashboard.tsx | 35 |
| **Admin** | BedsAdmin.tsx | 84 (POST only) |
| **Admin** | DataAdmin.tsx | 45, 68, 98 |
| **Admin** | Escalation page.tsx | 11, 73, 82, 93 |
| **Portal** | PortalBilling.tsx | 24, 98 |
| **Portal** | Portal p/page.tsx | 71, 78, 92, 111, 132 |

### 11B. Missing `useRoutePermission` (No Permission Gating)

These pages have NO permission check — any authenticated user can access them regardless of role:

| File | Risk |
|------|------|
| PendingOrders.tsx | Any user sees all pending billing orders |
| ERTriageQueue.tsx | Any user accesses triage queue |
| IPDWardBoard.tsx | Any user sees all ward patients |
| BedSetup.tsx | Any user can add/edit/deactivate beds |
| IPDDischargeSummary.tsx | Any user sees discharge summaries |
| IntakeListing.tsx | Any user sees intake data |
| AuditTrail.tsx | **Any user views all audit records** |
| DepartmentInput.tsx | Any user can enter/exit department tracking |

### 11C. Dead Buttons / Broken JSX

| File | Line | Issue |
|------|------|-------|
| **OrderSets.tsx** | 148-151 | "Add Set" button has NO onClick handler — dead button |
| **OrderSets.tsx** | 230-234 | Edit and Copy buttons have NO onClick handlers — dead buttons |
| **OrderSets.tsx** | 238-240 | Extra `</div>` causes broken DOM nesting — React hydration crash |
| **ERDoctor.tsx** | line 19 | `'notes'` tab defined in state but NO render block — selecting shows blank |
| **ERDoctor.tsx** | 177-178 | Same visit number line renders TWICE (duplicate JSX) |
| **AiSettingsManager.tsx** | 412 | Audit log tab fetches data but displays hardcoded dashes — never renders real data |

### 11D. Silent Error Swallowing (No User Feedback on Mutations)

| File | Operations Affected |
|------|-------------------|
| Claims.tsx | createClaimDraft, submitClaim, rejectClaim, resubmitClaim, remitClaim (5 actions!) |
| InvoiceDraft.tsx | postBilling, unpostBilling (catch { // ignore }) |
| Statement.tsx | postBilling, unpostBilling |
| Payments.tsx | recordPayment (comment says "read-only page" but it records payments!) |
| NPHIESDashboard.tsx | resubmit (catch {}) |
| HandHygieneCompliance.tsx | handleCreate (no res.ok check) |
| LaborDoctorStation.tsx | handleSave (silent failure) |
| DentalTreatment.tsx | updateStatus + AddTreatmentModal save |
| DentalChart.tsx | saveChart (shows false "Saved" on failure!) |
| LabQC.tsx | POST submit (zero indication of failure) |
| BedSetup.tsx | patch (no error handling) |
| DepartmentInput.tsx | enter, exit (no error handling) |
| RoutingRules page.tsx | delete, toggle, create (none check res.ok) |
| Escalation page.tsx | toggle, runCheck, acknowledge (none check res.ok) |
| AiSettingsManager.tsx | save shows "Saved" even when it fails |
| OrPreferenceCards.tsx | save, toggleStatus (no feedback) |

### 11E. Specific Page Bugs

#### LabCollection.tsx:313 — Accession Number Collision (CRITICAL)
`generateAccessionNumber(Math.floor(Math.random() * 9999) + 1)` — random 1-9999 for accession numbers. Multiple collectors working simultaneously WILL generate duplicates.

#### ICUDashboard.tsx:55 — Hardcoded 20-Bed ICU (HIGH)
`Math.round((census.total / 20) * 100)` — bed count hardcoded to 20. Shows wrong occupancy for any ICU with different bed count.

#### PricingPackages.tsx:122-127 — Admin Code Bypass on Update (HIGH)
`editAdminCode` state collected in UI but NEVER sent in update request body. Admin code validation bypassed on all package edits.

#### PricingPackages.tsx:20 — Wrong Permission Path (HIGH)
Checks `useRoutePermission('/billing/charge-catalog')` but page lives at `/billing/pricing-packages`. Wrong permission evaluated.

#### Payments.tsx:20-22 — Triple Duplicate Permission (MEDIUM)
Three separate `useRoutePermission('/billing/payments')` calls for `hasPermission`, `canRecord`, `canVoid` — all check SAME path. No actual distinction between record vs void permissions.

#### Payments.tsx:87 — `window.prompt()` for Void Reason (MEDIUM)
Blocking browser dialog. Will break in SSR context.

#### Portal p/page.tsx:71-83 — Auth Check Always Fails (CRITICAL)
`fetch('/api/portal/auth/me')` without credentials → always 401 → user can NEVER be auto-redirected even when already authenticated. Always shows login form.

#### OPDDashboard.tsx:49-50,115 — Infinite Re-render (HIGH)
`today` recomputed from `new Date()` every render → `useCallback` dependency changes → `useEffect` re-runs → interval recreated. Causes continuous API hammering and memory leaks.

#### ERTriage.tsx:104-143 — Save Timeout Not Cleaned on Unmount (MEDIUM)
`saveTimeout` ref never cleaned up. If user navigates away during debounce, React state updates fire on unmounted component.

#### PendingOrders.tsx:252 — Crash on null `orderedAt` (MEDIUM)
`new Date(undefined)` → "Invalid Date" display or throw.

#### Referrals.tsx:28 — Broken i18n Pattern (HIGH)
Uses `t('referrals.key', language)` key-based translation instead of inline `tr(ar, en)` pattern. If translation keys don't exist (likely — whole project uses inline), UI shows raw keys like `referrals.title`.

#### Referrals.tsx:81-83 — Triple API Load (MEDIUM)
Two extra SWR calls (`outData`, `inData`) re-fetch full referral lists just to count. 3x API load for stats that could come from primary fetch.

### 11F. Invalid Tailwind CSS Classes

| File | Line | Class | Issue |
|------|------|-------|-------|
| ERTriageQueue.tsx | 218 | `bg-muted/50/50` | Double opacity — invalid, silently ignored |
| ERTriageQueue.tsx | 238 | `bg-muted/50/30` | Same |
| BedSetup.tsx | 284, 329 | `bg-muted/50/30`, `bg-muted/50/50` | Same |
| IntakeListing.tsx | 232 | `bg-muted/50/50` | Same |
| DepartmentInput.tsx | 284 | `bg-muted/50/30` | Same |
| Claims.tsx | 320 | `text-sm text-xs` | Conflicting font sizes on same element |

### 11G. Missing RTL `dir` Attribute

| File | Line |
|------|------|
| LabCollection.tsx | 163 |
| LabQC.tsx | 85 |
| PharmacyReports.tsx | 62 |
| PharmacyPatientLookup.tsx | 74 |
| PharmacyDashboard.tsx | 94 |
| Referrals.tsx | root container |

### 11H. Hardcoded English/Arabic Strings (i18n Violations — additional ~30+ files)

| File | Lines | Strings |
|------|-------|---------|
| ERBoard.tsx | 40-46 | 'All', 'Waiting', 'In Bed', 'Seen', 'Pending Results', 'Dispo' |
| ERBoard.tsx | 265, 296 | 'Isolate', 'Precautions', 'Triage' |
| ERDoctor.tsx | 318, 332 | "Ack: ", "ACK" |
| ERCharge.tsx | 219, 222, 318 | "Unknown", "ER Visit: " |
| Claims.tsx | 135, 235 | "EncounterCoreId", "Active: ... Voided: ..." |
| InvoiceDraft.tsx | 126, 329 | "EncounterCoreId", "SAR " |
| Statement.tsx | 118 | "EncounterCoreId" |
| PendingOrders.tsx | 215, 250 | "ر.س" (Arabic-only currency) |
| IPDWardBoard.tsx | 104, 367 | 'en-GB' locale hardcoded, "LOS: " |
| Continuity.tsx | 337, 349 | "None", "BP", "HR", "RR", "Temp", "SpO2" |
| LabCollection.tsx | 224, 345 | "MRN:" |
| LabQC.tsx | 236 | Westgard violations shown English-only |
| SpeechSettings.tsx | 293-298 | Suggested terms English-only |
| KitchenDashboard.tsx | 142, 187 | Raw enum values shown (IN_PRODUCTION, BREAKFAST) |
| SchedulingResources.tsx | 335 | Full English sentence not wrapped in tr() |
| AuditTrail.tsx | CSV headers | English-only export headers |
| Multiple IPD files | fmtDate/fmtTime | Always 'en-GB' locale regardless of language |

### 11I. Misleading Loading States

| File | Lines | Issue |
|------|-------|-------|
| RoutingRules page.tsx | 325-330 | Shows spinner when rules array is empty (even when loaded — 0 rules) |
| Escalation page.tsx | 220-225 | Same — perpetual spinner for legitimately empty data |
