# PHASE 3: Flow Testing Audit Report

**Date:** 2026-04-01
**Auditor:** Claude Opus 4.6 (Senior QA Engineer)
**Scope:** End-to-end flow tracing for Thea Health (EHR) and CVision (HR)
**Method:** Direct code reading of route.ts files, frontend page.tsx files, and supporting lib modules

---

## EXECUTIVE SUMMARY

| Platform | Flows Tested | Complete | Partial | Broken/Missing |
|----------|-------------|----------|---------|----------------|
| **Thea Health (EHR)** | 7 | 4 | 3 | 0 |
| **CVision (HR)** | 5 | 3 | 2 | 0 |
| **Total** | **12** | **7** | **5** | **0** |

**Overall Assessment:** The core flows are substantially complete with well-structured API routes. The major gaps are in cross-module integration (e.g., prescription-to-pharmacy handoff in OPD, standalone nursing station OPD worklist lacking medication admin routes) and the CVision platform's mixed MongoDB/Prisma architecture creating potential data consistency issues.

---

## EHR PLATFORM (Thea Health) FLOW ANALYSIS

---

### FLOW 1: Patient Registration --> Appointment --> Consultation --> Prescription --> Billing --> Discharge

**Verdict: PARTIAL (95% complete)**

#### Step-by-step trace:

| Step | Route | Exists | HTTP Methods | Auth Guard | Validated |
|------|-------|--------|-------------|------------|-----------|
| 1. Register Patient | `/api/patients` POST | YES | POST | `withAuthTenant` | Zod (`createPatientSchema`) |
| 2. Create Booking | `/api/opd/booking/create` POST | YES | POST | `withAuthTenant` + rate limiting (10/min) | Zod (`createBookingSchema`) |
| 3. Check-In | `/api/opd/booking/check-in` POST | YES | POST | `withAuthTenant` | Zod (`checkInBookingSchema`) |
| 4. Encounter Created | Automatically via check-in | YES | -- | -- | -- |
| 5. Visit Notes (SOAP) | `/api/opd/encounters/[id]/visit-notes` GET/POST | YES | GET, POST | `withAuthTenant` + doctor role check | Zod (`visitNotesSchema`) |
| 6. Orders | `/api/opd/encounters/[id]/orders` GET/POST | YES | GET, POST | `withAuthTenant` | Zod (`opdOrderSchema`) |
| 7. Disposition | `/api/opd/encounters/[id]/disposition` POST | YES | POST | `withAuthTenant` | Zod (`opdDispositionSchema`) |
| 8. Billing Lock | `/api/billing/lock/lock` POST | YES | POST | `canAccessBilling` + role check | Zod (`billingLockSchema`) |
| 9. Billing Post | `/api/billing/posting/post` POST | YES | POST | `canAccessBilling` + requires lock | Zod (`postingSchema`) |
| 10. Record Payment | `/api/billing/payments/record` POST | YES | POST | `canAccessBilling` + requires lock + posting | Zod (`recordPaymentSchema`) |
| 11. Status Close | `/api/opd/encounters/[id]/status` POST | YES | POST | `withAuthTenant` | Zod (`opdEncounterStatusSchema`) |
| 12. Discharge Finalize | `/api/discharge/finalize` POST | YES | POST | `withAuthTenant` | Zod |

#### Data Flow Verification:
- **Booking --> Encounter:** Check-in creates `encounterCore` + `opdEncounter` and links back to booking via `encounterCoreId`. Transaction-wrapped. CORRECT.
- **Encounter --> Orders:** Orders reference `encounterCoreId` via `ordersHub`. Dual-source pattern (ordersHub + legacy opdOrders fallback). CORRECT but complex.
- **Orders --> Billing:** Charge events reference `encounterCoreId` + source order ID. Billing gate checks payment before lab collection (`checkOrderPayment`). CORRECT.
- **Billing Chain:** Lock --> Post --> Pay is strictly enforced (post requires lock, payment requires lock + posting). CORRECT.

#### Issues Found:
1. **[P3-EHR-001] MEDIUM: Disposition does not auto-trigger encounter status change.** The disposition route (`POST .../disposition`) only sets `dispositionType` and `dispositionNote` on the OPD encounter but does NOT close the encounter or update `encounterCore.status`. Closing requires a separate call to `.../status`. This is likely intentional (billing happens between disposition and close), but there is no guard preventing a user from closing an encounter without setting a disposition first.

2. **[P3-EHR-002] LOW: Discharge finalize route uses IPD permission key.** The `GET` handler for `/api/discharge/finalize` uses `permissionKey: 'ipd.live-beds.edit'` which is an IPD permission, but it operates on `encounterCoreId` which could be OPD. OPD users may be blocked from viewing discharge summaries.

3. **[P3-EHR-003] LOW: Hardcoded Arabic in OPD status route.** The version conflict error message in `/api/opd/encounters/[id]/status` is hardcoded Arabic (`'تم تحديث السجل من شخص آخر. الرجاء إعادة تحميل الصفحة.'`). Same issue in disposition route. Should use bilingual error codes per CLAUDE.md i18n rules.

#### Frontend Coverage:
- Registration: `/opd/registration/page.tsx` -- EXISTS
- Appointments: `/opd/appointments/page.tsx`, `/opd/appointments/new/page.tsx` -- EXISTS
- Visit pages: Full suite at `/opd/visit/[visitId]/` including overview, diagnosis, orders, prescription, billing, discharge, results, SOAP, physical-exam, tasks, history, handover -- COMPLETE
- Billing: `/billing/cashier/`, `/billing/payments/`, `/billing/charge-events/` etc. -- COMPLETE

---

### FLOW 2: Lab Order --> Sample Collection --> Results --> Doctor Review

**Verdict: COMPLETE**

| Step | Route | Exists | Auth Guard | Validated |
|------|-------|--------|------------|-----------|
| 1. Lab Order Created | `/api/lab/orders` POST | YES | `withAuthTenant` + `lab.orders.view` | Zod |
| 2. Lab Worklist | `/api/lab/worklist` GET | YES | `withAuthTenant` | -- |
| 3. Specimen Collect | `/api/lab/specimens/collect` POST | YES | `withAuthTenant` + payment gate | Zod |
| 4. Specimen Receive | `/api/lab/specimens/receive` POST | YES | `withAuthTenant` | -- |
| 5. Save Results | `/api/lab/results/save` POST | YES | `withAuthTenant` | Zod |
| 6. Auto-Validate | `/api/lab/auto-validate` POST | YES | `withAuthTenant` | -- |
| 7. Critical Check | `/api/lab/critical-check` POST | YES | `withAuthTenant` | -- |
| 8. Results List | `/api/lab/results` GET | YES | `withAuthTenant` + `lab.results.view` | -- |
| 9. Doctor Results Inbox | `/api/results/inbox` GET | YES | `withAuthTenant` | -- |
| 10. Doctor Ack | `/api/results/[orderResultId]/ack` POST | YES | `withAuthTenant` | -- |
| 11. Amend Results | `/api/lab/results/amend` POST | YES | `withAuthTenant` | -- |

#### Data Flow Verification:
- **Order --> Specimen:** Specimen collection checks `ordersHub.status === 'ORDERED'` and runs `checkOrderPayment` (billing gate). Updates order status to `COLLECTED`. CORRECT.
- **Specimen --> Results:** Results saved via `labResult` table, linked by `orderId`. Order status updated to `RESULT_READY`. CORRECT.
- **Results --> Doctor:** Results inbox queries `orderResult` table with scope/unacked filters. Ack endpoint marks results as acknowledged. CORRECT.
- **Critical Value Alerting:** `checkCriticalValue` runs during result save, creates `labCriticalAlert` records. CORRECT.

#### Frontend Coverage:
- Lab dashboard, collection, reception, results, blood-gas, microbiology, QC, TAT, critical-alerts, LIS dashboard, patient-lookup -- ALL EXIST

---

### FLOW 3: Nurse Station Workflow (vitals, medications, notes)

**Verdict: PARTIAL (75% complete)**

| Step | Route | Exists | Auth Guard |
|------|-------|--------|------------|
| 1. Nursing Worklist | `/api/opd/nursing/worklist` GET | YES | `withAuthTenant` |
| 2. Nursing Assessment | `/api/nursing/assessments` POST | YES | `withAuthTenant` |
| 3. Procedure Queue | `/api/opd/nursing/procedure-queue` GET | YES | `withAuthTenant` |
| 4. Encounter Nursing Data | `/api/opd/encounters/[id]/nursing` GET/POST | YES | `withAuthTenant` |
| 5. Nursing Operations | `/api/nursing/operations` | YES | `withAuthTenant` |
| 6. Nursing Scheduling | `/api/nursing/scheduling` | YES | `withAuthTenant` |
| 7. Code Blue | `/api/nursing/scheduling/codeblue` | YES | `withAuthTenant` |
| 8. Medication Administration | -- | **MISSING** | -- |

#### Issues Found:
4. **[P3-EHR-004] HIGH: No standalone medication administration (MAR) route for OPD nursing.** While pharmacy has dispensing routes and the ER nursing module has full medication task tracking, there is no dedicated OPD medication administration record (MAR) API route. Nurses can view the encounter nursing data but cannot record medication administration through a dedicated workflow. The pharmacy `prescriptions/[id]/administer` route exists but it is not well-integrated with the OPD nursing worklist.

5. **[P3-EHR-005] MEDIUM: Nursing worklist lacks vitals recording sub-route.** The worklist returns patient data but vital signs must be recorded through the generic `nursing/assessments` endpoint. There is no direct link from the worklist to vitals entry -- the worklist page must construct the correct payloads manually.

#### Frontend Coverage:
- OPD Nurse Station: `/opd/nurse-station/page.tsx` -- EXISTS
- ER Nursing: `/er/nursing/page.tsx` -- EXISTS
- No standalone nursing vitals page outside ER context

---

### FLOW 4: Doctor Workflow (diagnosis, orders, notes, referrals)

**Verdict: COMPLETE**

| Step | Route | Exists | Auth Guard |
|------|-------|--------|------------|
| 1. Doctor Worklist/Queue | `/api/opd/queue` GET | YES | `withAuthTenant` |
| 2. Encounter Detail | `/api/opd/encounters/[id]` GET | YES | `withAuthTenant` |
| 3. Physical Exam | `/api/opd/encounters/[id]/physical-exam` GET/POST | YES | `withAuthTenant` |
| 4. Visit Notes (SOAP) | `/api/opd/encounters/[id]/visit-notes` GET/POST | YES | Doctor role check |
| 5. Diagnoses | `/api/clinical/diagnoses` GET/POST | YES | `withAuthTenant` |
| 6. Orders (lab/rad/proc) | `/api/opd/encounters/[id]/orders` GET/POST | YES | `withAuthTenant` |
| 7. Referrals | `/api/referrals` GET/POST | YES | `withAuthTenant` |
| 8. Referral Accept/Reject | `/api/referrals/[id]/accept`, `/api/referrals/[id]/reject` POST | YES | `withAuthTenant` |
| 9. Results Review | `/api/results/inbox` GET, `/api/results/[id]/ack` POST | YES | `withAuthTenant` |
| 10. Disposition | `/api/opd/encounters/[id]/disposition` POST | YES | `withAuthTenant` |
| 11. ICD-10 Search | `/api/clinical/icd10/search` GET | YES | `withAuthTenant` |
| 12. Drug Interactions | `/api/clinical/drug-interactions/check` POST | YES | `withAuthTenant` |
| 13. CDS Evaluate | `/api/clinical/cds/evaluate` POST | YES | `withAuthTenant` |

#### Data Flow Verification:
- **Visit Notes:** Doctor role restricted with exact match check (`ALLOWED_DOCTOR_ROLES`). Guards prevent writing to completed encounters (`assertEncounterNotCompleted`). CORRECT.
- **Orders:** Create orders in `ordersHub` with source system `OPD`. Status maps properly between hub and OPD frontend. CORRECT.
- **Referrals:** Full lifecycle with accept/reject and smart-recommend. CORRECT.

#### Frontend Coverage:
- Doctor station: `/opd/doctor-station/page.tsx` -- EXISTS
- Doctor worklist: `/opd/doctor-worklist/page.tsx` -- EXISTS
- Visit sub-pages: diagnosis, orders, prescription, results, SOAP, physical-exam -- ALL EXIST

---

### FLOW 5: Admin Workflow (reports, settings, user management)

**Verdict: COMPLETE**

| Step | Route | Exists | Auth Guard |
|------|-------|--------|------------|
| 1. User Management | `/api/admin/users` GET/POST | YES | `requireAuth` + `requireRole(['admin'])` |
| 2. User Detail/Update | `/api/admin/users/[id]` GET/PATCH/DELETE | YES | Admin role |
| 3. Role Management | `/api/admin/roles` GET/POST | YES | Admin role |
| 4. Role Update | `/api/admin/roles/[roleKey]` PATCH/DELETE | YES | Admin role |
| 5. Dashboard Stats | `/api/admin/dashboard/stats` GET | YES | `withAuthTenant` |
| 6. Audit Logs | `/api/admin/audit` GET | YES | `withAuthTenant` |
| 7. Data Import/Export | `/api/admin/data-import`, `/api/admin/data-export` | YES | `withAuthTenant` |
| 8. Clinical Infra | `/api/clinical-infra/*` (beds, rooms, floors, clinics, etc.) | YES | `withAuthTenant` |
| 9. Organization Profile | `/api/admin/organization-profile/*` | YES | `withAuthTenant` |
| 10. Compliance (CBAHI) | `/api/admin/compliance/cbahi` | YES | `withAuthTenant` |

#### Issues Found:
6. **[P3-EHR-006] LOW: Admin user creation uses older auth pattern.** The `/api/admin/users` route uses `requireAuth`/`requireRole` (manual pattern from `lib/security/auth`) instead of `withAuthTenant` guard used everywhere else. This is functionally correct but inconsistent. The older pattern does not go through the standard tenant resolution flow, which could cause issues in multi-tenant environments.

#### Frontend Coverage:
- Full admin dashboard at `/admin/` with sub-pages for users, clinical-infra (beds, clinics, floors, rooms, units, specialties, providers), compliance, settings, quotas, doctors onboard, etc. -- COMPLETE

---

### FLOW 6: ER Flow (Registration --> Triage --> Treatment --> Disposition)

**Verdict: COMPLETE**

| Step | Route | Exists | Auth Guard |
|------|-------|--------|------------|
| 1. Register Known Patient | `/api/er/encounters/known` POST | YES | `withAuthTenant` |
| 2. Register Unknown Patient | `/api/er/encounters/unknown` POST | YES | `withAuthTenant` |
| 3. Triage Save | `/api/er/triage/save` POST | YES | `withAuthTenant` + death guard + final status guard |
| 4. Triage Complete | `/api/er/triage/complete` POST | YES | `withAuthTenant` |
| 5. Triage Finish | `/api/er/triage/finish` POST | YES | `withAuthTenant` |
| 6. Triage Score | `/api/er/triage-score/[encounterId]` GET | YES | `withAuthTenant` |
| 7. Bed Assignment | `/api/er/beds/assign` POST | YES | `withAuthTenant` |
| 8. Doctor Notes | `/api/er/doctor/notes` POST | YES | `withAuthTenant` |
| 9. Orders | `/api/er/encounters/[id]/orders` GET/POST | YES | `withAuthTenant` |
| 10. Results | `/api/er/encounters/[id]/results` GET | YES | `withAuthTenant` |
| 11. Disposition | `/api/er/encounters/[id]/disposition` GET/POST | YES | `withAuthTenant` |
| 12. Nursing Assessment | `/api/er/nursing/assessment` POST | YES | `withAuthTenant` |
| 13. Nursing Observations | `/api/er/nursing/observations` POST | YES | `withAuthTenant` |
| 14. Handovers | `/api/er/nursing/handovers` POST | YES | `withAuthTenant` |
| 15. Transfer Requests | `/api/er/nursing/transfer-requests` POST | YES | `withAuthTenant` |
| 16. MCI (Mass Casualty) | `/api/er/mci` CRUD | YES | `withAuthTenant` |
| 17. Staff Assignment | `/api/er/staff/assign` POST | YES | `withAuthTenant` |

#### Data Flow Verification:
- **Unknown Patient:** Creates temporary patient master with auto-generated MRN (`UN-XXXXX`). Full retry logic for duplicate keys. CORRECT.
- **Triage:** Calculates triage level from vitals using `calculateTriageLevel`. State machine enforced via `canTransitionStatus`. CORRECT.
- **Disposition:** Supports DISCHARGE, ADMIT, TRANSFER, LAMA, DEATH types with appropriate sub-fields. Draft saves allowed; hard transitions enforced in status machine. CORRECT.

#### Frontend Coverage:
- ER register, board, triage, doctor, nursing, beds, command center, MCI, metrics, notifications, respiratory-screen, results-console -- ALL EXIST

---

### FLOW 7: Pharmacy/Medication Flow

**Verdict: PARTIAL (85% complete)**

| Step | Route | Exists | Auth Guard |
|------|-------|--------|------------|
| 1. Prescriptions List | `/api/pharmacy/prescriptions` GET | YES | `permissionKey: 'pharmacy.dispense.view'` + access audit |
| 2. Create Prescription | `/api/pharmacy/prescriptions` POST | YES | `withAuthTenant` |
| 3. Verify Prescription | `/api/pharmacy/verify` POST | YES | `withAuthTenant` |
| 4. Dispense (state machine) | `/api/pharmacy/dispense` POST | YES | `withAuthTenant` |
| 5. Dispense (per-prescription) | `/api/pharmacy/prescriptions/[id]/dispense` POST | YES | `withAuthTenant` |
| 6. Administer | `/api/pharmacy/prescriptions/[id]/administer` POST | YES | `withAuthTenant` |
| 7. Drug Interactions | `/api/pharmacy/drug-interactions` POST | YES | `withAuthTenant` |
| 8. Inventory | `/api/pharmacy/inventory` GET/POST | YES | `withAuthTenant` |
| 9. Controlled Substances | `/api/pharmacy/controlled-substances` | YES | `withAuthTenant` |
| 10. ADC (Automated Dispensing) | `/api/pharmacy/adc/*` | YES | `withAuthTenant` |
| 11. IV Admixture | `/api/pharmacy/iv-admixture/*` | YES | `withAuthTenant` |
| 12. Unit Dose | `/api/pharmacy/unit-dose` | YES | `withAuthTenant` |

#### Data Flow Verification:
- **Dispense State Machine:** `PENDING --> VERIFIED --> DISPENSED --> PICKED_UP`. Valid transitions enforced. `syncDispenseStatusToOrder` bridges back to ordersHub. CORRECT.
- **Per-prescription Dispense:** Accepts `PENDING`, `VERIFIED`, or `ACTIVE` prescriptions. CORRECT.
- **Billing Hook:** `/api/pharmacy/billing-hook` exists for cross-module billing integration. CORRECT.

#### Issues Found:
7. **[P3-EHR-007] MEDIUM: Two dispense paths with inconsistent status handling.** There are TWO routes for dispensing: `/api/pharmacy/dispense` (state-machine with verify/dispense/pickup/cancel actions) and `/api/pharmacy/prescriptions/[id]/dispense` (direct dispense). The first uses `VALID_TRANSITIONS` state machine, the second accepts broader status set (`PENDING`, `VERIFIED`, `ACTIVE`). These could produce inconsistent states if both are used.

8. **[P3-EHR-008] LOW: Inventory deduction not linked to dispensing.** The dispense routes update prescription status but do not automatically deduct from pharmacy inventory (`/api/pharmacy/inventory`). Inventory adjustments appear to be a separate manual process.

#### Frontend Coverage:
- Pharmacy main, dispensing, verification, inventory, ADC, IV admixture, unit dose, controlled substances, patient lookup, reception, reports -- ALL EXIST

---

## CVision (HR) PLATFORM FLOW ANALYSIS

**Critical Architectural Note:** CVision uses MongoDB (`getCVisionDb`/`getCVisionCollection`) while the EHR platform uses PostgreSQL (Prisma). This is a deliberate separation, but some newer CVision routes (employee status transition) reference Prisma-style patterns while still using MongoDB underneath, creating maintenance complexity.

---

### FLOW 1: Employee Onboarding --> Profile Setup --> Department Assignment

**Verdict: COMPLETE**

| Step | Route | Exists | Auth Guard |
|------|-------|--------|------------|
| 1. Create Employee | `/api/cvision/employees` POST | YES | `requireCtx` + `canWriteEmployee` |
| 2. Employee Profile | `/api/cvision/employees/[id]/profile` GET/POST | YES | `requireCtx` |
| 3. Profile Sections | `/api/cvision/employees/[id]/profile/[sectionKey]` GET/PATCH | YES | `requireCtx` |
| 4. Department CRUD | `/api/cvision/departments` GET/POST | YES | `withAuthTenant` |
| 5. Department Detail | `/api/cvision/departments/[id]` GET/PATCH/DELETE | YES | `withAuthTenant` |
| 6. Onboarding Workflow | `/api/cvision/onboarding` GET/POST | YES | `requireCtx` |
| 7. Position Assignment | `/api/cvision/positions` GET/POST | YES | `withAuthTenant` |
| 8. Status Transition | `/api/cvision/employees/[id]/status/transition` POST | YES | `requireCtx` + `canWriteEmployee` |
| 9. Employee Lifecycle | `/api/cvision/employees/lifecycle` GET | YES | `withAuthTenant` |
| 10. Contracts | `/api/cvision/contracts` GET/POST | YES | `withAuthTenant` |

#### Data Flow Verification:
- **Onboarding Tasks:** Pre-defined 24-task onboarding checklist + 18-task offboarding checklist auto-seeded. Tasks span HR, IT, Facilities, Department, Training. CORRECT.
- **Employee Creation:** Generates employee number via `generateSequenceNumber`. Links to department, position, grade. `onEmployeeCreated` lifecycle hook fires for side effects. CORRECT.
- **Status Machine:** Full state machine with `validateTransition`, end-of-service calculation, and audit trail. CORRECT.

#### Frontend Coverage:
- Employees list and detail, onboarding page, lifecycle page, org structure, departments, positions -- ALL EXIST

---

### FLOW 2: Attendance --> Leave Requests --> Approvals

**Verdict: COMPLETE**

| Step | Route | Exists | Auth Guard |
|------|-------|--------|------------|
| 1. Record Attendance | `/api/cvision/attendance` POST | YES | `withAuthTenant` |
| 2. Biometric Processing | `/api/cvision/attendance/biometric` POST | YES | `withAuthTenant` |
| 3. Attendance Summary | `/api/cvision/attendance` GET (action=summary) | YES | `withAuthTenant` |
| 4. Create Leave Request | `/api/cvision/leaves` POST | YES | `withAuthTenant` |
| 5. Leave Balance | `/api/cvision/leaves` GET (action=balance) | YES | `withAuthTenant` |
| 6. Approve/Reject Leave | `/api/cvision/leaves/[id]` PATCH | YES | `withAuthTenant` + admin/manager check |
| 7. Carry-Over | `/api/cvision/leaves/carry-over` POST | YES | `withAuthTenant` |
| 8. Blackout Periods | `/api/cvision/leaves/blackout` GET/POST | YES | `withAuthTenant` |

#### Data Flow Verification:
- **Attendance Calculations:** Uses Saudi labor law rules (`SAUDI_WORK_RULES`): lateness, early leave, overtime, deductions. CORRECT.
- **Leave Validation:** `validateLeaveRequest` checks balance, overlap, blackout periods. Saudi entitlements (`SAUDI_LEAVE_ENTITLEMENTS`) for 13+ leave types. CORRECT.
- **Leave Approval:** Manager check uses unit/department hierarchy. Admin roles bypass with `isAdminOrHR`. CORRECT.

#### Issues Found:
9. **[P3-HR-001] MEDIUM: Leave approval manager check has weak fallback.** In `leaves/[id]/route.ts`, the `isManagerForEmployee` function returns `true` if the employee's unit is not found (`if (!unit) return true`). This means if org data is incomplete, ANY authenticated user could approve leaves.

#### Frontend Coverage:
- Attendance page, devices, scan, leaves page, self-service leaves -- ALL EXIST

---

### FLOW 3: Payroll Processing --> Salary Calculation --> Payment

**Verdict: COMPLETE**

| Step | Route | Exists | Auth Guard |
|------|-------|--------|------------|
| 1. Create Payroll Run | `/api/cvision/payroll/runs` POST | YES | `requireCtx` + `canAccessPayroll` (HR_ADMIN/CVISION_ADMIN) |
| 2. Dry Run (Calculate) | `/api/cvision/payroll/runs/[id]/dry-run` POST | YES | `withAuthTenant` |
| 3. Calculate Individual | `/api/cvision/payroll/calculate` POST | YES | `requireSessionAndTenant` |
| 4. Generate Payslips | `/api/cvision/payroll/runs/[id]/payslips` GET | YES | `withAuthTenant` |
| 5. Approve Run | `/api/cvision/payroll/runs/[id]/approve` POST | YES | `withAuthTenant` (requires DRY_RUN status) |
| 6. Mark Paid | `/api/cvision/payroll/runs/[id]/mark-paid` POST | YES | `withAuthTenant` (requires APPROVED status) |
| 7. Export WPS | `/api/cvision/payroll/runs/[id]/export-wps` POST | YES | `withAuthTenant` |
| 8. Payroll Profiles | `/api/cvision/payroll/profiles` GET/POST | YES | `withAuthTenant` |
| 9. Loans | `/api/cvision/payroll/loans` GET/POST | YES | `withAuthTenant` |
| 10. Payslips | `/api/cvision/payroll/payslips` GET | YES | `withAuthTenant` |

#### Data Flow Verification:
- **Payroll State Machine:** `DRAFT --> DRY_RUN --> APPROVED --> PAID`. Approve requires DRY_RUN status, mark-paid requires APPROVED. CORRECT.
- **Calculation:** Gathers employee data, attendance, leaves, violations, loans. Uses GOSI rules. `calculateFullPayroll` produces full breakdown. CORRECT.
- **WPS Export:** Generates Saudi Wage Protection System file for bank transfer. CORRECT.

#### Frontend Coverage:
- Payroll main, runs, payslips, profiles, loans, advanced, end-of-service -- ALL EXIST

---

### FLOW 4: Recruitment --> Applications --> Interview --> Hiring

**Verdict: PARTIAL (90% complete)**

| Step | Route | Exists | Auth Guard |
|------|-------|--------|------------|
| 1. Create Requisition | `/api/cvision/recruitment/requisitions` POST | YES | `requireCtx` + `canListRequisitions` |
| 2. Create Candidate | `/api/cvision/recruitment/candidates` POST | YES | `withAuthTenant` |
| 3. CV Parsing | `/api/cvision/recruitment/analyze-cv` POST | YES | `withAuthTenant` |
| 4. CV Inbox (Batch) | `/api/cvision/recruitment/cv-inbox/batches/*` | YES | `withAuthTenant` |
| 5. Screen Candidate | `/api/cvision/recruitment/candidates/[id]/screen` POST | YES | `withAuthTenant` |
| 6. Schedule Interview | `/api/cvision/recruitment/candidates/[id]/interviews` POST | YES | `withAuthTenant` |
| 7. AI Interview | `/api/cvision/recruitment/ai-interview/process` POST | YES | `withAuthTenant` |
| 8. Send Offer | `/api/cvision/recruitment/candidates/[id]/offer` POST | YES | `withAuthTenant` |
| 9. Offer Portal | `/api/cvision/offer-portal/[token]` GET/POST | YES | Public (token-based) |
| 10. Hire Candidate | `/api/cvision/recruitment/candidates/[id]/hire` POST | YES | `requireCtx` + `canWriteEmployee` |
| 11. Quick Hire | `/api/cvision/recruitment/candidates/[id]/quick-hire` POST | YES | `withAuthTenant` |
| 12. Pipeline View | `/api/cvision/recruitment/pipeline` GET | YES | `withAuthTenant` |
| 13. Public Job Portal | `/api/cvision/public/jobs` GET | YES | Public |
| 14. Public Apply | `/api/cvision/public/apply` POST | YES | Public |

#### Data Flow Verification:
- **Hire Flow:** Converts candidate to employee, assigns position slot (budgeted positions PR-B pattern), creates contract. `onEmployeeCreated` lifecycle fires. CORRECT.
- **Offer Flow:** Generates signed token for candidate portal, sends email with offer details. Supports accept/reject/negotiate actions. CORRECT.

#### Issues Found:
10. **[P3-HR-002] LOW: Requisition-to-candidate linking is manual.** While the `requisitions/[id]/candidates` route exists for listing candidates per requisition, there is no automatic candidate-to-requisition assignment during public apply. The `public/apply` route creates a candidate but may not link to a specific requisition unless explicitly provided.

#### Frontend Coverage:
- Recruitment main, requisitions, candidates (list + detail), CV inbox, AI interview, pipeline -- ALL EXIST

---

### FLOW 5: Employee Offboarding --> Clearance --> Exit

**Verdict: PARTIAL (70% complete)**

| Step | Route | Exists | Auth Guard |
|------|-------|--------|------------|
| 1. Status Transition (RESIGNED/TERMINATED) | `/api/cvision/employees/[id]/status/transition` POST | YES | `requireCtx` + `canWriteEmployee` |
| 2. Offboarding Checklist | `/api/cvision/onboarding` (contains OFFBOARDING_TASKS) | YES | `requireCtx` |
| 3. End of Service Calc | Embedded in status-engine (`calculateEndOfService`) | YES | -- |
| 4. Final Settlement | -- | **NO DEDICATED ROUTE** | -- |
| 5. Exit Interview | -- | **NO DEDICATED ROUTE** | -- |
| 6. Clearance Tracking | -- | **NO DEDICATED ROUTE** | -- |
| 7. Experience Certificate | -- | **NO DEDICATED ROUTE** | -- |

#### Data Flow Verification:
- **Status Transition:** The status machine handles ACTIVE --> RESIGNED/TERMINATED/RETIRED/DECEASED transitions. Calculates end-of-service benefits per Saudi labor law. Side effects fire (payroll deactivation, etc.). CORRECT.
- **Offboarding Tasks:** 18 predefined offboarding tasks exist in the onboarding module covering HR, IT, Facilities, Finance, Department. CORRECT.

#### Issues Found:
11. **[P3-HR-003] HIGH: No dedicated offboarding API routes.** While the status transition and task list exist, there are no dedicated routes for:
    - Final settlement processing (beyond EOS calculation)
    - Exit interview recording
    - Clearance form/workflow
    - Experience certificate generation
    These are all listed as tasks in the offboarding checklist but have no corresponding API endpoints. The onboarding module handles task tracking but the actual business operations behind those tasks have no API support.

12. **[P3-HR-004] MEDIUM: No offboarding frontend page.** There is no `/cvision/offboarding/` page. The onboarding page handles both flows, but users may not discover offboarding tasks through the onboarding UI.

---

## CROSS-CUTTING ISSUES

### 13. [P3-CROSS-001] MEDIUM: CVision uses MongoDB while EHR uses PostgreSQL
CVision routes use `getCVisionDb(tenantId)` returning MongoDB collections, while EHR routes use `prisma` (PostgreSQL). The employee module specifically has some references that look Prisma-compatible but operate on MongoDB. This creates:
- No referential integrity between CVision and EHR data
- No shared transaction support
- Potential for data drift if an employee is also a patient

### 14. [P3-CROSS-002] LOW: Inconsistent auth patterns across CVision
CVision uses three different auth patterns:
- `withAuthTenant` from `@/lib/cvision/infra` (most routes)
- `requireCtx` + `enforce` from `@/lib/cvision/authz/enforce` (newer RBAC routes)
- `requireSessionAndTenant` from `@/lib/cvision/middleware` (payroll calculate)

While all are functional, the inconsistency makes it harder to audit permissions uniformly.

### 15. [P3-CROSS-003] LOW: No OPD prescription-to-pharmacy auto-push
When a doctor creates a prescription via visit notes or orders, there is no automatic push to the pharmacy queue. The pharmacy module queries its own `pharmacyPrescription` table. The bridge (`syncDispenseStatusToOrder` in pharmacy dispense) only syncs status BACK to orders, not forward. This means prescriptions must be manually created in the pharmacy module or there is an implicit sync mechanism not visible in the route layer.

---

## SUMMARY OF ALL ISSUES

| ID | Severity | Flow | Description |
|----|----------|------|-------------|
| P3-EHR-001 | MEDIUM | OPD | Disposition does not guard against closing without disposition |
| P3-EHR-002 | LOW | OPD/Discharge | Discharge finalize uses IPD permission key for cross-module route |
| P3-EHR-003 | LOW | OPD | Hardcoded Arabic in version conflict errors (status, disposition routes) |
| P3-EHR-004 | HIGH | Nursing | No dedicated OPD medication administration record (MAR) route |
| P3-EHR-005 | MEDIUM | Nursing | Nursing worklist lacks integrated vitals recording sub-route |
| P3-EHR-006 | LOW | Admin | Admin user routes use older auth pattern (requireAuth/requireRole) |
| P3-EHR-007 | MEDIUM | Pharmacy | Two dispense paths with inconsistent status handling |
| P3-EHR-008 | LOW | Pharmacy | Inventory deduction not linked to dispensing |
| P3-HR-001 | MEDIUM | Leave | Leave approval manager check has weak fallback (returns true if unit not found) |
| P3-HR-002 | LOW | Recruitment | Public apply does not auto-link candidate to requisition |
| P3-HR-003 | HIGH | Offboarding | No dedicated offboarding API routes (settlement, clearance, certificates) |
| P3-HR-004 | MEDIUM | Offboarding | No dedicated offboarding frontend page |
| P3-CROSS-001 | MEDIUM | Cross-platform | CVision MongoDB vs EHR PostgreSQL with no referential integrity |
| P3-CROSS-002 | LOW | CVision | Inconsistent auth patterns across CVision routes |
| P3-CROSS-003 | LOW | Cross-platform | No OPD prescription-to-pharmacy auto-push |

**HIGH:** 2 | **MEDIUM:** 6 | **LOW:** 7 | **Total:** 15

---

## POSITIVE FINDINGS

1. **Comprehensive input validation:** Nearly every POST/PATCH route uses Zod schemas with `validateBody`. This is excellent.
2. **Consistent audit logging:** Both platforms create audit logs for all state-changing operations.
3. **Death guards:** EHR routes consistently check `ensureNotDeceasedFinalized` before allowing writes.
4. **Encounter completion guards:** OPD routes check `assertEncounterNotCompleted` before writes.
5. **Billing integrity chain:** The Lock --> Post --> Pay chain is strictly enforced with proper status checks at each step.
6. **ER state machine:** Full state machine with `canTransitionStatus` and `getFinalStatusBlock` guards.
7. **Saudi labor law compliance:** CVision payroll and leave calculations use proper Saudi labor law rules (GOSI, leave entitlements, work hours).
8. **Optimistic locking:** OPD encounter updates use version-based optimistic locking to prevent concurrent modification.
9. **Rate limiting:** Booking creation has a 10/minute rate limit per user.
10. **Payment gate:** Lab specimen collection requires payment verification before proceeding.
