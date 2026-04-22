# AUDIT PHASE 1 -- Project Understanding Document

**Project:** Thea Platform
**Date:** 2026-04-01
**Auditor:** Claude (AI-assisted QA)
**Framework:** Next.js 14 (App Router)
**Database:** PostgreSQL (Prisma ORM) + MongoDB (CVision collections)
**Cache:** Redis (ioredis)

---

## 1. Platform Overview

Thea is a **multi-platform healthcare and enterprise SaaS** application served from a single Next.js 14 monolith. It contains **4 distinct platforms** isolated by middleware-enforced routing and entitlement checks:

| # | Platform | Internal Name | Description |
|---|----------|---------------|-------------|
| 1 | **Thea Health** | `health` | Full EHR -- OPD, ER, IPD, ICU, OR, Pharmacy, Lab, Radiology, Billing, etc. |
| 2 | **C-Vision** | `cvision` | HR Operating System -- employees, payroll, attendance, recruitment, compliance |
| 3 | **SAM** | `sam` | Governance, Audit & Document Intelligence -- policy management, integrity checks |
| 4 | **Imdad** | `imdad` | Supply Chain Management -- procurement, inventory, warehousing, vendor management |

Platform isolation is enforced in `middleware.ts` via route prefix matching. Each user has JWT `entitlements` (`{ sam, health, cvision, imdad }`) checked at the middleware layer. A cookie `active_platform` tracks the current platform context.

---

## 2. Folder Structure

### Top-Level Directories

| Directory | Purpose |
|-----------|---------|
| `app/` | Next.js App Router -- pages, API routes, layouts |
| `app/(dashboard)/` | Main authenticated pages (EHR, CVision, Imdad, SAM dashboard modules) |
| `app/(portal)/` | Patient portal (19 pages) |
| `app/(website)/` | Public marketing website (6 pages) |
| `app/api/` | All API route handlers |
| `app/sam/` | SAM-specific top-level pages |
| `app/imdad/` | Imdad landing page |
| `app/owner/` | Thea Owner console (super-admin) |
| `components/` | React components organized by module |
| `core/` | Core domain logic (RBAC, ImdadBrain AI) |
| `lib/` | Shared libraries, services, integrations, business logic |
| `prisma/schema/` | Prisma schema files (49 .prisma files) |
| `types/` | TypeScript type definitions |
| `hooks/` | React hooks |
| `contexts/` | React context providers |
| `public/` | Static assets |
| `Thea-engine/` | Python-based AI/OCR engine (separate service) |
| `scripts/` | Build/deploy scripts |
| `__tests__/`, `tests/` | Test suites |

### app/(dashboard)/ Breakdown (EHR Modules)

The dashboard route group contains **56 subdirectories** covering:

| Category | Modules |
|----------|---------|
| **Core Clinical** | `opd/`, `er/`, `ipd/`, `icu/`, `or/`, `nursing/` |
| **Registration** | `registration/`, `patient/`, `patients/`, `search/` |
| **Clinical Services** | `consults/`, `physiotherapy/`, `nutrition/`, `social-work/`, `patient-education/`, `wound-care/` |
| **Diagnostics** | `lab/`, `radiology/`, `pathology/`, `blood-bank/` |
| **Pharmacy** | `pharmacy/` |
| **Specialty** | `dental/`, `obgyn/`, `oncology/`, `psychiatry/`, `transplant/`, `telemedicine/` |
| **Finance** | `billing/` |
| **Operations** | `cssd/`, `equipment-mgmt/`, `infection-control/`, `transport/`, `mortuary/` |
| **Scheduling** | `scheduling/` |
| **Orders & Results** | `orders/`, `results/`, `tasks/`, `handover/`, `handoff/` |
| **Quality** | `quality/` |
| **Admin** | `admin/`, `departments/`, `settings/`, `notifications/` |
| **Analytics** | `analytics/` |
| **AI/Governance** | `ai/`, `alignment/`, `integrity/`, `risk-detector/` |
| **HR (CVision)** | `cvision/` (132 pages) |
| **Supply Chain (Imdad)** | `imdad/` (95 pages) |
| **SAM** | `sam/` (10 pages) |

---

## 3. Counts Summary

| Metric | Total | EHR | CVision | Imdad | SAM | Shared/Other |
|--------|-------|-----|---------|-------|-----|-------------|
| **Frontend Pages** (page.tsx) | **574** | 286 | 132 | 95 | 10 | 51 (portal, website, admin, login, etc.) |
| **API Routes** (route.ts) | **1,485** | ~884 | 232 | 168 | 43 | ~158 (auth, admin, shared) |
| **Prisma Models** | **532** | 397 | 121 | ~79* | 14 | (overlap in core/shared) |
| **Prisma Enums** | **49** | -- | -- | -- | -- | Shared across platforms |
| **EHR Permissions** | **325** | 325 | -- | -- | -- | Across 31 categories |

*Imdad has ~79 Prisma models referenced in API code (e.g., `prisma.imdadVendor`, `prisma.imdadPurchaseOrder`) but no dedicated `.prisma` schema file was found in `prisma/schema/`. These models may be defined in migrations directly, in a generated schema, or in a location not yet committed.

---

## 4. User Roles

### 4.1 Global / Platform Roles (Prisma `UserRole` enum)

| Role | Description |
|------|-------------|
| `THEA_OWNER` | Platform super-admin (Thea corporate) |
| `ADMIN` | Tenant admin |
| `GROUP_ADMIN` | Hospital group admin |
| `HOSPITAL_ADMIN` | Single hospital admin |
| `SUPERVISOR` | Department supervisor |
| `STAFF` | General staff |
| `VIEWER` | Read-only access |

These are stored in `User.role` and normalized to lowercase-hyphenated format (`thea-owner`, `group-admin`, etc.) via `lib/auth/normalizeRole.ts`.

### 4.2 EHR Tenant Roles (`TenantUser.roles[]`)

EHR uses a **flexible role + area system** via `TenantUser`:
- `roles[]`: string array (e.g., `["admin"]`, `["doctor"]`, `["nurse"]`)
- `areas[]`: string array (e.g., `["OPD"]`, `["ER"]`, `["BILLING"]`)
- `departments[]`: string array

UI access is enforced in middleware via `/api/access/tenant-user` lookups. Admin/dev roles bypass area restrictions.

The EHR permission system defines **325 granular permissions** across **31 categories** in `lib/permissions/definitions.ts`. Permission categories include: Dashboard, Hospital Core, OPD, ER, IPD, ICU, OR, Lab, Pharmacy, Radiology, Billing, Scheduling, Clinical Services, Specialty Modules, Admin, and more.

### 4.3 CVision Roles (`lib/cvision/roles.ts`)

| Role | Hierarchy Level | Description |
|------|----------------|-------------|
| `thea-owner` | 300 | Platform superuser |
| `owner` | 200 | Tenant super-admin |
| `cvision_admin` | 100 | Full CVision module admin |
| `hr_admin` | 80 | HR department admin |
| `hr_manager` | 60 | Day-to-day HR operations |
| `auditor` | 40 | Read-only auditor |
| `manager` | 30 | Line manager (sees direct reports) |
| `employee` | 20 | Self-service only |
| `candidate` | 5 | Job applicant (limited access) |

### 4.4 Imdad Roles (`core/rbac/roles.ts`)

| Role | Tier | Scope |
|------|------|-------|
| `BOARD_MEMBER` | 0 | View-only, all domains |
| `CEO` | 0 | Full override, all domains |
| `CFO_GROUP` | 1 | Financial oversight |
| `COO_GROUP` | 1 | Operations oversight |
| `CMO_GROUP` | 1 | Medical oversight |
| `THEA_SOLUTIONS_CEO` | 1 | IT/Office subsidiary |
| `THEA_MEDICAL_CEO` | 1 | Medical devices subsidiary |
| `THEA_LAB_CEO` | 1 | Lab consumables subsidiary |
| `THEA_PHARMACY_CEO` | 1 | Pharmacy supplies subsidiary |
| `DAHNAA_DENTAL_CEO` | 1 | Dental subsidiary |
| `VP_SUPPLY_CHAIN` | 1 | All supply domains |
| `GENERAL_DIRECTOR` | 2 | Hospital-scoped |
| `MEDICAL_DIRECTOR` | 2 | Hospital-scoped |
| `EXECUTIVE_DIRECTOR` | 2 | Hospital-scoped |
| `NURSING_DIRECTOR` | 2 | Hospital-scoped |
| `CFO` | 2 | Hospital-scoped |
| `IT_DIRECTOR` | 2 | Hospital-scoped |
| `DENTAL_DIRECTOR` | 2 | Hospital-scoped |
| `SUPPLY_CHAIN_MANAGER` | 3 | Operational |
| `HEAD_OF_DEPARTMENT` | 3 | Departmental |
| `SUPERVISOR` | 3 | Departmental |
| `HEAD_NURSE` | 3 | Departmental |

Imdad roles include **8 supply domains** (Medical Consumables, Medical Devices, Non-Medical Consumables, Non-Medical Devices, Furniture, Office Equipment, IT Systems, Dental) and **6 subsidiaries**.

### 4.5 SAM Roles

SAM uses the global platform roles (admin, staff, viewer) and does not define a separate role hierarchy. Access is controlled via entitlements.

### 4.6 Owner Role & 2FA

- Owner users (`thea-owner`, `THEA_OWNER`) are blocked from accessing tenant data by default
- Approved access requires a validated `approved_access_token` cookie checked against the database
- 2FA is enforced in production for: `admin`, `group-admin`, `hospital-admin`, `thea-owner`

---

## 5. Database Models by Platform

### 5.1 EHR Models (397 models across ~35 schema files)

| Schema File | Models | Coverage |
|-------------|--------|----------|
| `clinical.prisma` | 44 | Vitals, assessments, notes, allergies, medications, procedures |
| `billing.prisma` | 31 | Invoices, payments, insurance, claims, packages |
| `core.prisma` | 30 | Users, tenants, sessions, tenant_users, hospitals, groups |
| `misc.prisma` | 26 | Org nodes, identity lookups, dental charts, OB/GYN, patient experience |
| `er.prisma` | 22 | ER visits, triage, beds, tracking, dispositions |
| `ipd.prisma` | 25 | Admissions, beds, wards, transfers, nursing notes |
| `or.prisma` | 16 | Surgical cases, anesthesia, checklists, equipment |
| `quality.prisma` | 16 | Incident reports, audits, accreditation, indicators |
| `orders.prisma` | 15 | Order sets, order items, order tracking |
| `clinical_infra.prisma` | 13 | ICD codes, CPT codes, drug catalogs, supply catalogs |
| `psychiatry.prisma` | 12 | Mental health assessments, treatment plans |
| `analytics.prisma` | 11 | Dashboard configs, report definitions, snapshots |
| `opd.prisma` | 11 | OPD visits, queues, doctor schedules |
| `lab.prisma` | 9 | Lab orders, results, panels, analyzers |
| `oncology.prisma` | 9 | Tumor boards, chemotherapy protocols, staging |
| `telemedicine.prisma` | 7 | Video sessions, waiting rooms |
| `integration.prisma` | 7 | Integration configs, message queues, mappings |
| `scheduling.prisma` | 7 | Appointments, availability, booking rules |
| `patient.prisma` | 6 | Patient master, demographics, insurance |
| `taxonomy.prisma` | 6 | Specialties, departments, service types |
| `admission.prisma` | 5 | Admission requests, bed assignments |
| `consumables.prisma` | 5 | Nursing charge capture, store items, stock movements |
| `pharmacy.prisma` | 5 | Pharmacy orders, inventory, dispensing |
| `workflow.prisma` | 5 | Workflow definitions, steps, executions |
| `care_path.prisma` | 4 | Clinical pathways, milestones |
| `blood_bank.prisma` | 4 | Blood inventory, transfusions, donors |
| `cssd.prisma` | 4 | Sterilization loads, instrument tracking |
| `discharge.prisma` | 4 | Discharge summaries, planning |
| `transplant.prisma` | 4 | Organ registries, matching |
| `physiotherapy.prisma` | 3 | Rehab plans, sessions |
| `equipment.prisma` | 3 | Equipment registry, maintenance |
| `ai.prisma` | 3 | AI interactions, embeddings |
| `ehr_admin.prisma` | 8 | Role definitions, staff credentials |
| `portal.prisma` | 8 | Patient portal users, invitations |
| `care_gaps.prisma` | 2 | Preventive care gap detection |
| `referrals.prisma` | 2 | Referral requests, tracking |
| `reminders.prisma` | 2 | Appointment/medication reminders |
| `pathology.prisma` | 2 | Pathology specimens, reports |
| `encounter.prisma` | 1 | Core encounter model |

### 5.2 CVision Models (121 models across 7 schema files)

| Schema File | Models | Coverage |
|-------------|--------|----------|
| `cvision-admin.prisma` | 38 | Requests, notifications, workflows, policies, surveys, org design |
| `cvision-operations.prisma` | 16 | Insurance, travel, assets, transport, safety, grievances |
| `cvision-performance.prisma` | 16 | Reviews, OKRs, KPIs, training, succession, onboarding |
| `cvision-payroll.prisma` | 15 | Payroll runs, payslips, loans, compensation, budgets |
| `cvision-recruitment.prisma` | 14 | Job postings, candidates, interviews, CV parsing |
| `cvision-core.prisma` | 11 | Departments, employees, contracts, positions, documents |
| `cvision-attendance.prisma` | 11 | Shifts, attendance, biometric logs, schedules, geofences |

CVision also uses **MongoDB collections** (via `CVISION_COLLECTIONS`) for some data -- approximately 60+ named collections for employees, payroll, recruitment, etc.

### 5.3 SAM Models (14 models in `sam.prisma`)

| Model | Purpose |
|-------|---------|
| `PolicyDocument` | Uploaded policy/governance documents |
| `PolicyChunk` | Chunked text for AI embeddings |
| `PolicyAlert` | Policy-related alerts |
| `Practice` | Governance practices |
| `RiskRun` | Risk assessment runs |
| `Policy` | Policy definitions |
| `IntegrityFinding` | Integrity audit findings |
| `IntegrityRun` | Integrity check runs |
| `IntegrityRuleset` | Integrity rule definitions |
| `DocumentTask` | Document processing tasks |
| `DraftDocument` | Draft governance documents |
| `PolicyLifecycleEvent` | Policy version tracking |
| `OperationLink` | Cross-module operation references |
| `IntegrityActivity` | Activity logs for integrity checks |

### 5.4 Imdad Models (~79 models, no dedicated schema file found)

Models are referenced in API routes (e.g., `prisma.imdadVendor`, `prisma.imdadPurchaseOrder`) but no `.prisma` file exists under `prisma/schema/`. Key referenced models include:

| Category | Models (sample) |
|----------|----------------|
| **Procurement** | `imdadVendor`, `imdadPurchaseOrder`, `imdadPurchaseRequisition`, `imdadContract` |
| **Inventory** | `imdadItemMaster`, `imdadItemLocation`, `imdadBatchLot`, `imdadInventoryTransaction`, `imdadInventoryAdjustment`, `imdadInventoryLocation` |
| **Warehouse** | `imdadWarehouse`, `imdadWarehouseZone`, `imdadBin`, `imdadPickList`, `imdadPutAwayTask` |
| **Finance** | `imdadBudget`, `imdadInvoice`, `imdadPaymentBatch`, `imdadChargeCapture`, `imdadCostCenter` |
| **Assets** | `imdadAsset`, `imdadAssetDisposal`, `imdadAssetTransfer`, `imdadMaintenanceOrder` |
| **Quality** | `imdadQualityInspection`, `imdadNonConformanceReport`, `imdadRecall`, `imdadComplianceCertificate` |
| **Governance** | `imdadApprovalRequest`, `imdadApprovalWorkflowRule`, `imdadDecision`, `imdadAuditLog` |
| **Operations** | `imdadSupplyRequest`, `imdadDispenseRequest`, `imdadTransferRequest`, `imdadGoodsReceivingNote` |
| **Config** | `imdadSystemConfig`, `imdadRoleDefinition`, `imdadDashboardConfig`, `imdadReorderRule` |
| **Integration** | `imdadSfdaIntegrationLog`, `imdadWebhook`, `imdadWebhookDelivery`, `imdadEventBusMessage` |

**FINDING:** Imdad models are used in API routes but have no `.prisma` schema definition file. This is a potential issue -- either the schema is generated elsewhere, or a file is missing from the repository.

---

## 6. API Route Mapping (app/api/)

### 6.1 Shared/Common APIs (~158 routes)

| API Prefix | Purpose |
|------------|---------|
| `/api/auth/` | Authentication (login, logout, 2FA, sessions, me) |
| `/api/admin/` | Tenant admin operations (users, roles, settings) |
| `/api/dashboard/` | Dashboard widgets and stats |
| `/api/platform/` | Platform switching, entitlements |
| `/api/init/` | Tenant initialization |
| `/api/health/` | Health check |
| `/api/notifications/` | Notification CRUD |
| `/api/owner/` | Thea Owner management console |
| `/api/approved-access/` | Owner approved-access token management |
| `/api/access/` | Tenant user access checks |
| `/api/identity/` | National ID verification |
| `/api/tenant/` | Tenant management |
| `/api/shell/` | Platform shell config |
| `/api/cron/` | Scheduled tasks |
| `/api/events/` | Event bus |

### 6.2 EHR APIs (~884 routes)

| API Prefix | Purpose | Key Operations |
|------------|---------|----------------|
| `/api/opd/` | Outpatient | Visits, queues, nurse/doctor stations, analytics |
| `/api/er/` | Emergency | Registration, triage, tracking board, beds |
| `/api/ipd/` | Inpatient | Admissions, beds, wards, transfers, discharge |
| `/api/icu/` | Intensive Care | Monitoring, ventilators, protocols |
| `/api/or/` | Operating Room | Surgical scheduling, anesthesia, checklists |
| `/api/nursing/` | Nursing | Assessments, care plans, medication admin |
| `/api/lab/` | Laboratory | Orders, results, panels, QC |
| `/api/radiology/` | Radiology | Orders, DICOM, reports |
| `/api/pharmacy/` | Pharmacy | Orders, dispensing, inventory, formulary |
| `/api/billing/` | Billing | Invoices, payments, insurance, packages |
| `/api/patients/` | Patient Master | Demographics, search, merge |
| `/api/encounters/` | Encounters | Create, close, timeline |
| `/api/orders/` | Orders | Lab, radiology, pharmacy orders |
| `/api/clinical/` | Clinical Data | Vitals, allergies, medications, assessments |
| `/api/clinical-notes/` | Clinical Notes | SOAP notes, progress notes |
| `/api/clinical-infra/` | Clinical Infra | ICD codes, CPT, drug catalogs |
| `/api/scheduling/` | Scheduling | Appointments, availability, slots |
| `/api/blood-bank/` | Blood Bank | Inventory, transfusions, compatibility |
| `/api/dental/` | Dental | Charts, procedures, ortho |
| `/api/obgyn/` | OB/GYN | Prenatal, labor, newborn |
| `/api/oncology/` | Oncology | Staging, chemo protocols, tumor boards |
| `/api/psychiatry/` | Psychiatry | Assessments, treatment plans |
| `/api/transplant/` | Transplant | Organ registry, matching |
| `/api/telemedicine/` | Telemedicine | Video sessions, scheduling |
| `/api/physiotherapy/` | Physiotherapy | Rehab plans, sessions |
| `/api/nutrition/` | Nutrition | Diet plans, assessments |
| `/api/cssd/` | CSSD | Sterilization, instrument tracking |
| `/api/infection-control/` | Infection Control | Surveillance, outbreaks |
| `/api/equipment-mgmt/` | Equipment | Maintenance, tracking |
| `/api/quality/` | Quality | Incidents, audits, indicators |
| `/api/referrals/` | Referrals | Internal/external referrals |
| `/api/handover/` | Handover | Shift handover, clinical handoff |
| `/api/fhir/` | FHIR | FHIR R4 API endpoints |
| `/api/dicomweb/` | DICOMweb | WADO-RS, STOW-RS proxy |
| `/api/integration/` | Integrations | HL7, LIS, instrument interfaces |
| `/api/compliance/` | Compliance | Regulatory compliance checks |
| `/api/credentialing/` | Credentialing | Staff credential management |
| `/api/care-gaps/` | Care Gaps | Preventive care gap detection |
| `/api/transport/` | Transport | Patient transport management |
| `/api/analytics/` | Analytics | Reports, dashboards, KPIs |
| `/api/ai/` | AI Features | Clinical decision support |
| `/api/search/` | Search | Global patient/record search |
| `/api/discharge/` | Discharge | Discharge summaries, planning |
| `/api/admission/` | Admission | Admission requests, processing |
| `/api/mortuary/` | Mortuary | Deceased patient management |
| `/api/death/` | Death | Death certificate processing |

### 6.3 CVision APIs (232 routes)

| API Prefix | Purpose |
|------------|---------|
| `/api/cvision/employees/` | Employee CRUD, profiles, documents |
| `/api/cvision/payroll/` | Payroll runs, payslips, profiles |
| `/api/cvision/attendance/` | Clock in/out, schedules, biometrics |
| `/api/cvision/recruitment/` | Job postings, candidates, interviews |
| `/api/cvision/leaves/` | Leave requests, balances, policies |
| `/api/cvision/performance/` | Reviews, OKRs, KPIs |
| `/api/cvision/training/` | Courses, enrollment, budgets |
| `/api/cvision/onboarding/` | Employee onboarding workflows |
| `/api/cvision/insurance/` | Insurance policies, claims |
| `/api/cvision/compliance/` | Labor law compliance |
| `/api/cvision/compensation/` | Salary structures, components |
| `/api/cvision/succession/` | Succession planning |
| `/api/cvision/surveys/` | Employee surveys |
| `/api/cvision/announcements/` | Company announcements |
| `/api/cvision/letters/` | Employment letters |
| `/api/cvision/workflows/` | Approval workflows |
| `/api/cvision/analytics/` | HR analytics, BI dashboards |
| `/api/cvision/gosi/` | GOSI integration |
| `/api/cvision/muqeem/` | Muqeem immigration integration |
| `/api/cvision/absher/` | Absher lookup |
| `/api/cvision/org/` | Organization structure |
| `/api/cvision/org-design/` | Org design scenarios |
| `/api/cvision/transport/` | Employee transport |
| `/api/cvision/safety/` | Workplace safety |
| `/api/cvision/whatif/` | What-if scenario modeling |
| `/api/cvision/integrations/` | Third-party integration hub |

### 6.4 SAM APIs (43 routes)

| API Prefix | Purpose |
|------------|---------|
| `/api/sam/documents/` | Policy document upload/management |
| `/api/sam/drafts/` | Draft document creation |
| `/api/sam/integrity/` | Integrity check runs and findings |
| `/api/sam/library/` | Document library and search |
| `/api/sam/operational/` | Operational links |
| `/api/sam/operations/` | Operations management |
| `/api/sam/org-profile/` | Organization profile |
| `/api/sam/queues/` | Document processing queues |
| `/api/sam/thea-engine/` | AI engine interface |

### 6.5 Imdad APIs (168 routes)

| API Prefix | Purpose |
|------------|---------|
| `/api/imdad/procurement/` | Vendors, purchase orders, requisitions, contracts |
| `/api/imdad/inventory/` | Items, stock levels, transactions, batch/lot tracking |
| `/api/imdad/warehouse/` | Locations, zones, bins, pick lists |
| `/api/imdad/assets/` | Asset registry, maintenance, disposals |
| `/api/imdad/financial/` | Budgets, invoices, payments, charges |
| `/api/imdad/quality/` | Inspections, non-conformance, recalls |
| `/api/imdad/approval/` | Approval workflows, delegation |
| `/api/imdad/analytics/` | Supply chain analytics, KPI snapshots |
| `/api/imdad/bulk/` | Batch operations (import, approve, adjust) |
| `/api/imdad/clinical/` | Clinical supply requests, dispensing |
| `/api/imdad/integrations/` | SFDA integration, webhooks |
| `/api/imdad/simulation/` | Supply chain simulation engine |
| `/api/imdad/notifications/` | SCM-specific notifications |
| `/api/imdad/decisions/` | Governance decisions |
| `/api/imdad/budget-governance/` | Budget governance rules |
| `/api/imdad/platform/` | Platform configuration |
| `/api/imdad/admin/` | Imdad admin settings |

---

## 7. Third-Party Integrations

### 7.1 EHR Integrations

| Integration | Location | Purpose |
|-------------|----------|---------|
| **NPHIES** | `lib/integrations/nphies/` | Saudi insurance eligibility, prior auth, claims (10+ files) |
| **HL7 v2** | `lib/integration/hl7/` | ADT messages, parser, builder (7 files) |
| **FHIR R4** | `app/api/fhir/`, `lib/fhir/` | Interoperability standard |
| **PACS** | `lib/integrations/pacs/` | Radiology image server (DICOMweb) |
| **LIS** | `lib/integrations/lis/` | Lab instrument interfaces |
| **DICOM** | `lib/dicomweb/` | Medical imaging (cornerstone.js) |
| **Absher** | `lib/integrations/absher/` | Saudi citizen identity verification |
| **Nafis** | `lib/integrations/nafis/` | Saudi nationals employment platform |
| **OpenAI** | `lib/ai/providers/openai.ts` | AI-assisted clinical decision support, translation |
| **Twilio** | via `twilio` package | SMS notifications, reminders |
| **SFDA** | Referenced in formulary data | Saudi drug/medical device registry |

### 7.2 CVision (HR) Integrations

| Integration | Location | Purpose |
|-------------|----------|---------|
| **GOSI** | `lib/cvision/integrations/gosi/` | Saudi social insurance |
| **Muqeem** | `lib/cvision/integrations/muqeem/` | Immigration/visa management |
| **Absher** | `lib/cvision/integrations/absher/` | Identity verification |
| **Mudad** | `lib/cvision/integrations/mudad/` | Wage protection system |
| **Qiwa** | `lib/cvision/integrations/qiwa/` | Ministry of Labor platform |
| **Nafath** | `lib/cvision/integrations/nafath/` | National single sign-on |
| **Wathq** | `lib/cvision/integrations/wathq/` | Commercial registration |
| **Yaqeen** | `lib/cvision/integrations/yaqeen/` | Identity verification (Elm) |
| **ZATCA** | `lib/cvision/integrations/zatca/` | Tax authority e-invoicing |
| **Banks** | `lib/cvision/integrations/banks/` | Bank salary file integration |
| **SendGrid** | `lib/cvision/email/providers/sendgrid.ts` | Email delivery |
| **SMTP** | `lib/cvision/email/providers/smtp.ts` | Email delivery (fallback) |

### 7.3 Imdad (Supply Chain) Integrations

| Integration | Location | Purpose |
|-------------|----------|---------|
| **SFDA** | `lib/imdad/integrations/sfda` | Drug/device recall monitoring |
| **Webhooks** | `lib/imdad/integrations/webhooks` | Outbound event notifications |

### 7.4 Infrastructure Services

| Service | Usage |
|---------|-------|
| **PostgreSQL** | Primary database (Prisma ORM with `@prisma/adapter-pg`) |
| **MongoDB** | CVision collections (employees, payroll, etc.) |
| **Redis** | Caching layer (`ioredis`) -- cross-instance consistency |
| **OpenAI API** | AI features across platforms |
| **FullCalendar** | Appointment scheduling UI |
| **Cornerstone.js** | DICOM image rendering |
| **fhir-kit-client** | FHIR R4 client library |
| **dicom-parser** | DICOM file parsing |
| **TanStack Query** | Client-side data fetching/caching |
| **TanStack Table** | Data grid rendering |
| **Radix UI** | UI component primitives (30+ packages) |
| **react-hook-form** | Form management |
| **Zod** | Schema validation (used extensively in API routes) |

---

## 8. Security Architecture

| Feature | Implementation |
|---------|---------------|
| **Authentication** | JWT tokens in `auth-token` cookie, verified in middleware (Edge Runtime) |
| **Session Management** | Active session tracking, single-session enforcement |
| **CSRF Protection** | Token in cookie + X-CSRF-Token header validation |
| **2FA** | Enforced in production for admin roles |
| **Platform Isolation** | Middleware route matching + entitlement checks |
| **Owner Access** | Requires `approved_access_token` validated against DB |
| **Request Size Limit** | 10MB max body size |
| **Security Headers** | X-Frame-Options, CSP, HSTS, X-Content-Type-Options, etc. |
| **HTTPS Enforcement** | Production-only, with x-forwarded-proto check |
| **RBAC** | Per-platform role systems (EHR: permissions-based, CVision: hierarchical, Imdad: domain-scoped) |

---

## 9. Key Findings & Risks

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| 1 | **Missing Imdad Prisma schema** | HIGH | ~79 Prisma models are referenced in Imdad API routes (`prisma.imdadVendor`, etc.) but no `.prisma` schema file exists in `prisma/schema/`. This means the schema may be out of sync or the file is missing from version control. |
| 2 | **Dual database architecture** | MEDIUM | CVision uses both PostgreSQL (Prisma) and MongoDB (collections). This creates complexity for migrations, backups, and consistency. |
| 3 | **Massive codebase scale** | INFO | 574 pages, 1,485 API routes, 532+ DB models across 4 platforms in a single Next.js monolith. This requires careful modular testing. |
| 4 | **Owner bypass in dev mode** | LOW | Owner role can bypass platform isolation when `THEA_TEST_MODE=true` and `NODE_ENV !== 'production'`. This is expected for development. |
| 5 | **Missing `lib/imdad/` directory** | HIGH | Imdad API routes import from `@/lib/imdad/` (audit, metrics, roles, etc.) but the directory does not exist on disk. This would cause build failures. |
| 6 | **No Imdad Prisma migrations found** | MEDIUM | No migration files reference Imdad table creation. The ~79 models may exist only in a generated client or external schema source. |

---

## 10. Platform-to-Component Mapping

### Component Directories (`components/`)

| Directory | Platform |
|-----------|----------|
| `components/opd/` | EHR |
| `components/er/` | EHR |
| `components/ipd/` | EHR |
| `components/icu/` | EHR |
| `components/or/` | EHR |
| `components/nursing/` | EHR |
| `components/billing/` | EHR |
| `components/clinical/` | EHR |
| `components/admission/` | EHR |
| `components/orders/` | EHR |
| `components/radiology/` | EHR |
| `components/scheduling/` | EHR |
| `components/obgyn/` | EHR |
| `components/infection-control/` | EHR |
| `components/handover/` | EHR |
| `components/tasks/` | EHR |
| `components/consent/` | EHR |
| `components/prescription/` | EHR |
| `components/ai/` | EHR |
| `components/portal/` | EHR (Patient Portal) |
| `components/reception/` | EHR |
| `components/cvision/` | CVision |
| `components/imdad/` | Imdad |
| `components/sam/` | SAM |
| `components/admin/` | Shared |
| `components/shell/` | Shared (app shell) |
| `components/ui/` | Shared (design system) |
| `components/shared/` | Shared |
| `components/charts/` | Shared |
| `components/tenant/` | Shared |
| `components/policies/` | SAM |
| `components/privacy/` | Shared |
| `components/demo/` | Demo mode |
| `components/website/` | Public website |

### Library Directories (`lib/`)

| Directory | Platform |
|-----------|----------|
| `lib/opd/` | EHR |
| `lib/er/` | EHR |
| `lib/ipd/` | EHR |
| `lib/or/` | EHR |
| `lib/lab/` | EHR |
| `lib/pharmacy/` | EHR |
| `lib/billing/` | EHR |
| `lib/clinical/` | EHR |
| `lib/clinicalInfra/` | EHR |
| `lib/admission/` | EHR |
| `lib/radiology/` | EHR |
| `lib/scheduling/` | EHR |
| `lib/oncology/` | EHR |
| `lib/psychiatry/` | EHR |
| `lib/transplant/` | EHR |
| `lib/nutrition/` | EHR |
| `lib/orders/` | EHR |
| `lib/quality/` | EHR |
| `lib/transport/` | EHR |
| `lib/consumables/` | EHR |
| `lib/fhir/` | EHR |
| `lib/dicomweb/` | EHR |
| `lib/integration/` | EHR (HL7) |
| `lib/integrations/` | EHR (NPHIES, PACS, LIS, Absher, Nafis) |
| `lib/patient-experience/` | EHR |
| `lib/portal/` | EHR (Patient Portal) |
| `lib/credentialing/` | EHR |
| `lib/compliance/` | EHR |
| `lib/cvision/` | CVision |
| `lib/sam/` | SAM |
| `lib/auth/` | Shared |
| `lib/db/` | Shared |
| `lib/cache/` | Shared |
| `lib/ai/` | Shared |
| `lib/core/` | Shared |
| `lib/permissions/` | EHR |
| `lib/security/` | Shared |
| `lib/tenant/` | Shared |
| `lib/notifications/` | Shared |
| `lib/workflow/` | Shared |
| `lib/analytics/` | Shared |
| `lib/pdf/` | Shared |
| `lib/i18n/` | Shared |
| `lib/ui/` | Shared |
| `lib/utils/` | Shared |
| `lib/seed/` | Shared |

---

## 11. Summary Statistics

| Metric | Value |
|--------|-------|
| Total frontend pages | **574** |
| Total API route handlers | **1,485** |
| Total Prisma models (in schema files) | **532** |
| Total Prisma enums | **49** |
| Total Prisma schema files | **49** |
| EHR permission keys | **325** |
| EHR permission categories | **31** |
| CVision MongoDB collections | **60+** |
| Imdad referenced models (no schema) | **~79** |
| Third-party integrations (EHR) | **11** |
| Third-party integrations (CVision) | **12** |
| Third-party integrations (Imdad) | **2** |
| Global user roles | **7** |
| CVision-specific roles | **9** |
| Imdad-specific roles | **22** |
| Dependencies in package.json | **93** |

---

*End of Phase 1 Audit -- Project Understanding Document*
