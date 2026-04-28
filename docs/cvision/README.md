# CVision (HR OS) - Implementation Notes

## Overview

CVision is a Human Resources Operating System module integrated into the HospitalOS2 platform. It provides comprehensive HR management capabilities including organization structure, employee lifecycle management, recruitment, and case management.

## Quick Start

### Routes

**UI Routes:**
- `/cvision` - Dashboard (main landing page)
- `/cvision/organization` - Organization structure management (departments, job titles, grades)
- `/cvision/employees` - Employee list and management
- `/cvision/requests` - HR request management
- `/cvision/recruitment` - Recruitment/ATS dashboard

**API Routes:**
- `GET /api/cvision/health` - Health check (returns `{ok: true, module: "cvision"}`)

### Conventions

1. **Tenant Isolation**: All CVision operations use `extractTenantId()` from `/lib/cvision/tenant.ts` - tenantId is ALWAYS extracted from session, never from request body/params.

2. **Authentication**: Use `withAuthTenant` wrapper from `/lib/cvision/auth.ts` which wraps existing session/auth primitives.

3. **Audit Logging**: Use `logCVisionAudit()` from `/lib/cvision/audit.ts` - this is a wrapper around existing audit system, no new audit infrastructure.

4. **Feature Flags**: All integrations are disabled by default in `/lib/cvision/featureFlags.ts` to maintain CVision isolation.

5. **Navigation**: CVision layout includes minimal navigation bar with links to Dashboard, Org, Employees, Recruitment, and Requests pages.
   - **CV Inbox**: The "CV Inbox" link under Recruitment is always visible in navigation (no role checks, no feature flags). However, page access is controlled by RBAC - users without proper permissions will receive a 403 error with a clear message.

## Architecture

### Multi-Tenancy
- Uses the existing tenant isolation pattern (database-per-tenant)
- All CVision collections are prefixed with `cvision_` and stored in tenant databases
- Tenant context is always extracted from the authenticated session

### Platform Isolation
- CVision is registered as a platform key: `cvision`
- Routes under `/api/cvision/*` auto-resolve platform context
- Platform access controlled via tenant subscriptions and user entitlements

## Route Map

### UI Routes
| Route | Description |
|-------|-------------|
| `/cvision` | CVision dashboard |
| `/cvision/organization` | Organization structure management |
| `/cvision/employees` | Employee list and management |
| `/cvision/employees/:id` | Employee profile (live file with sections) |
| `/cvision/requests` | HR request management |
| `/cvision/recruitment` | Recruitment/ATS dashboard |

### API Routes
| Route | Method | Description |
|-------|--------|-------------|
| `/api/cvision/health` | GET | Health check |
| `/api/cvision/departments` | GET/POST | List/create departments |
| `/api/cvision/employees` | GET/POST | List/create employees |
| `/api/cvision/employees/:id/profile` | GET | Get employee profile with all sections |
| `/api/cvision/employees/:id/profile/:sectionKey` | PATCH | Update a profile section |
| `/api/cvision/profile-schemas` | GET | List all profile schemas (HR_ADMIN+) |
| `/api/cvision/profile-schemas/:sectionKey/new-version` | POST | Create new schema version (HR_ADMIN+) |
| `/api/cvision/requests` | GET/POST | List/create requests |
| `/api/cvision/recruitment/requisitions` | GET/POST | List/create job requisitions |
| `/api/cvision/recruitment/candidates` | GET/POST | List/create candidates |

### Collections

| Collection | Description |
|------------|-------------|
| `cvision_departments` | HR departments within the organization |
| `cvision_units` | Sub-units within departments |
| `cvision_job_titles` | Job title definitions |
| `cvision_grades` | Salary/job grades |
| `cvision_employees` | Employee master records |
| `cvision_employee_status_history` | Employee status change audit trail |
| `cvision_profile_section_schemas` | Profile section schema definitions (versioned, section-based) |
| `cvision_employee_profile_sections` | Employee profile section data (current values) |
| `cvision_employee_profile_section_history` | Profile section change audit trail |
| `cvision_requests` | HR requests and case management (internal ticketing) |
| `cvision_request_events` | Request timeline events (comments, status changes, escalations) |
| `cvision_job_requisitions` | Recruitment job requisitions |
| `cvision_candidates` | Candidate records for recruitment |
| `cvision_audit_logs` | CVision-specific audit logs |
| `cvision_auth_events` | Login attempt logs with risk scoring |

## Schema Overview

### Prisma Models

CVision uses Prisma for schema definition and type safety. All models are tenant-scoped and support soft delete via `isArchived` and `deletedAt` fields.

**Core Organization Models:**
- `CvisionDepartment` - Departments (code unique per tenant)
- `CvisionUnit` - Units within departments (code unique per department)
- `CvisionJobTitle` - Job title definitions (code unique per tenant)
- `CvisionGrade` - Salary/job grades (code unique per tenant)

**Employee Models:**
- `CvisionEmployee` - Employee master records
  - `employeeNo` unique per tenant
  - `email` unique per tenant (sparse index)
  - Manager chain via `managerEmployeeId` (self-reference)

**Request Models:**
- `CvisionRequest` - HR requests and case management
  - Types: `LEAVE`, `COMPLAINT`, `TRANSFER`, `TRAINING`, `PAYROLL_ISSUE`, `OTHER`
  - Status: `OPEN`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `ESCALATED`, `CLOSED`
  - Confidentiality: `NORMAL`, `CONFIDENTIAL`, `ANONYMOUS`
  - SLA: `slaDueAt` auto-calculated on create based on type
  - Escalation: Automatic when overdue (manager -> hr -> compliance)
- `CvisionRequestEvent` - Request timeline events
  - Event types: `CREATED`, `COMMENT`, `STATUS_CHANGE`, `ESCALATED`, `ASSIGNED`, `ATTACHMENT_ADDED`
  - Links to department, unit, job title, grade
- `CvisionEmployeeStatusHistory` - Immutable status change audit trail

**Dynamic Profile Schema:**
- `CvisionProfileSchema` - Versioned JSON Schema definitions for employee profiles
  - `version` unique per tenant
  - `isActive` flag (only one active schema per tenant)
  - `jsonSchema` contains the JSON Schema definition
- `CvisionEmployeeProfileValue` - Employee profile data
  - Links to `CvisionEmployee` and `CvisionProfileSchema`
  - `dataJson` contains profile data conforming to the schema
  - Unique constraint on `(tenantId, employeeId, schemaVersion)`

**Audit & Security:**
- `CvisionAuditLog` - Standard mutation audit trail
- `CvisionAuthEvent` - Authentication events with risk scoring

**Request & Recruitment Models:**
- `CvisionRequest` - HR requests and case management
- `CvisionRequestEvent` - Request timeline events
- `CvisionJobRequisition` - Job requisitions
- `CvisionCandidate` - Candidate records
- `CvisionCandidateDocument` - Candidate documents

### Entity Relationship Diagram

```
┌─────────────────┐      ┌─────────────────┐
│  CvisionGrade   │      │CvisionDepartment│
│─────────────────│      │─────────────────│
│ id              │      │ id              │
│ tenantId        │      │ tenantId        │
│ code (unique)   │      │ code (unique)   │
│ name            │      │ name            │
│ level           │      │ parentId?       │◄─┐
│ minSalary?      │      │ isArchived      │  │ (self-reference)
│ maxSalary?      │      └────────┬────────┘──┘
│ isArchived      │               │
└────────┬────────┘               │1
         │                        │
         │                   ┌────┴────┐
         │                   │    *    │
         │           ┌───────┴─────────┴───────┐
         │           │      CvisionUnit        │
         │           │─────────────────────────│
         │           │ id                      │
         │           │ tenantId                │
         │           │ departmentId            │
         │           │ code (unique per dept)  │
         │           │ name                    │
         │           │ isArchived              │
         │           └───────────┬─────────────┘
         │                       │
         │    ┌──────────────────┼──────────────────┐
         │    │                  │                  │
         │    │           ┌──────┴──────┐           │
         │    │           │      *      │           │
┌────────┴────┴───────────┴─────────────┴───────────┴────────┐
│                    CvisionEmployee                          │
│─────────────────────────────────────────────────────────────│
│ id                    │ departmentId (required)             │
│ tenantId              │ unitId (optional)                   │
│ employeeNo (unique)   │ jobTitleId (required)               │
│ nationalId?           │ gradeId (optional)                  │
│ fullName              │ managerEmployeeId? ◄───┐            │
│ email?                │ status (enum)          │ (self-ref) │
│ phone?                │ statusEffectiveAt      │            │
│ hiredAt?              │ isArchived             │            │
│ terminatedAt?         └────────────────────────┴────────────┘
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    CvisionAuditLog                          │
│─────────────────────────────────────────────────────────────│
│ id              │ entityType                                │
│ tenantId        │ entityId                                  │
│ actorUserId     │ diffJson (before/after)                   │
│ action          │ createdAt                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                CvisionProfileSchema                         │
│─────────────────────────────────────────────────────────────│
│ id              │ tenantId                                  │
│ version (unique)│ jsonSchema (JSON Schema)                  │
│ isActive        │ isArchived                                │
│ description?   │ createdAt                                 │
└────────┬────────────────────────────────────────────────────┘
         │
         │1
         │
         │*
┌────────┴────────────────────────────────────────────────────┐
│            CvisionEmployeeProfileValue                       │
│─────────────────────────────────────────────────────────────│
│ id              │ employeeId                                │
│ tenantId        │ schemaId                                   │
│ schemaVersion   │ dataJson (profile data)                   │
│ createdAt       │ updatedAt                                 │
└─────────────────────────────────────────────────────────────┘
```

### Key Indexes

| Collection | Index | Type |
|------------|-------|------|
| `cvision_departments` | `(tenantId, code)` | Unique |
| `cvision_units` | `(tenantId, departmentId, code)` | Unique |
| `cvision_grades` | `(tenantId, code)` | Unique |
| `cvision_job_titles` | `(tenantId, code)` | Unique |
| `cvision_employees` | `(tenantId, employeeNo)` | Unique |
| `cvision_employees` | `(tenantId, email)` | Unique (sparse) |
| `cvision_employees` | `(tenantId, status)` | Regular |
| `cvision_employees` | `(departmentId)` | Regular |
| `cvision_employees` | `(managerEmployeeId)` | Regular |
| `cvision_profile_schemas` | `(tenantId, version)` | Unique |
| `cvision_profile_schemas` | `(tenantId, isActive)` | Regular |
| `cvision_employee_profile_values` | `(tenantId, employeeId, schemaVersion)` | Unique |
| `cvision_employee_profile_values` | `(tenantId, schemaId)` | Regular |
| `cvision_audit_logs` | `(tenantId, entityType, entityId)` | Regular |

### Employee Status Enum

```typescript
enum CvisionEmployeeStatus {
  ACTIVE      // Currently employed
  PROBATION   // In probation period
  ON_LEAVE    // On approved leave
  SUSPENDED   // Temporarily suspended
  TERMINATED  // Employment terminated
  RESIGNED    // Voluntarily resigned
  RETIRED     // Retired
}
```

### Soft Delete Pattern

All CVision models use `isArchived: boolean` and `deletedAt: DateTime?` for soft delete:

```typescript
// Archive (soft delete)
await collection.updateOne(
  { id, tenantId },
  { $set: { isArchived: true, deletedAt: new Date(), updatedAt: now } }
);

// Query active records only
await collection.find({ tenantId, isArchived: false, deletedAt: null });
```

### Employee Live Profile (Dynamic Employee File)

CVision supports a sectioned, versioned, and auditable employee profile system that extends beyond the basic employee record. This "live employee file" allows storing structured data in multiple sections with full audit trails.

#### Data Model

**1. Profile Section Schemas (`cvision_profile_section_schemas`)**
- Defines the structure for each profile section
- Sections: `PERSONAL`, `EMPLOYMENT`, `FINANCIAL`, `CONTRACT`
- Versioned: Each section can have multiple schema versions
- Only one active version per section per tenant
- Fields defined with type, label, validation rules

**2. Employee Profile Sections (`cvision_employee_profile_sections`)**
- Stores current data for each section per employee
- Unique constraint: `(tenantId, employeeId, sectionKey)`
- References active schema version at time of write
- Data stored as JSON (`dataJson`)

**3. Profile Section History (`cvision_employee_profile_section_history`)**
- Audit trail for all profile changes
- Stores `prevDataJson` and `nextDataJson` snapshots
- Includes `changedByUserId` and optional `changeReason`
- Automatically created on every section update

#### Default Schemas

On seed/bootstrap, 4 default schemas are created (version 1):

- **PERSONAL**: fullName, dob, nationalId, email, phone, address
- **EMPLOYMENT**: departmentId, unitId, jobTitleId, gradeId, managerEmployeeId, hiredAt
- **FINANCIAL**: baseSalary, bankIban, allowancesJson
- **CONTRACT**: contractType, startDate, endDate, probationEndDate

#### API Endpoints

**GET `/api/cvision/employees/:id/profile`**
- Returns employee with all profile sections
- Includes schema definitions and current data
- Includes last 10 history entries per section
- Enforces ABAC: EMPLOYEE can only access own profile

**PATCH `/api/cvision/employees/:id/profile/:sectionKey`**
- Updates a profile section
- Validates data against active schema
- Creates history entry automatically
- Enforces RBAC: EMPLOYEE can only edit PERSONAL section (and only self)

**GET `/api/cvision/profile-schemas`** (HR_ADMIN+)
- Lists all profile schemas

**POST `/api/cvision/profile-schemas/:sectionKey/new-version`** (HR_ADMIN+)
- Creates a new schema version
- Deactivates previous version
- New writes will use new version

#### RBAC/ABAC Rules

- **EMPLOYEE**: Can read own profile, can edit only PERSONAL section (and only self)
- **HR roles**: Can read/edit all sections for all employees
- **TERMINATED employees**: Blocked from profile endpoints (403)
- **RESIGNED employees**: Limited access per PR-A rules

#### Example Usage

```typescript
// Get employee profile
const res = await fetch('/api/cvision/employees/emp-123/profile');
const { employee, sections } = await res.json();

// Update PERSONAL section
await fetch('/api/cvision/employees/emp-123/profile/PERSONAL', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    dataJson: {
      fullName: 'Ahmed Ali',
      email: 'ahmed.ali@example.com',
      phone: '+966501234567',
    },
    changeReason: 'Updated contact information',
  }),
});
```

#### UI

- **Employee List**: "Open Profile" button navigates to `/cvision/employees/:id`
- **Profile Page**: Tabbed interface (Personal, Employment, Financial, Contract)
- Each tab shows fields based on schema, edit mode, save button, and history drawer

### Data Model Principles

1. **Soft Delete**: All records support soft delete via `deletedAt` timestamp
2. **Audit Trail**: Every mutation is logged with actor, timestamp, and change details
3. **Tenant Scoping**: Every record includes `tenantId` (enforced, never from request body)
4. **Deterministic IDs**: UUIDs generated server-side via `uuid.v4()`
5. **Timestamps**: All records have `createdAt`, `updatedAt`, `deletedAt` (nullable)

## API Design

### Conventions
- All routes under `/app/api/cvision/`
- Zod validation on all request bodies
- `withAuthTenant` wrapper for auth, tenant isolation, platform checks
- Audit logging on all mutations
- Deterministic responses (same input = same output structure)

### Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Zod validation failed - check `details` array |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 403 | `FORBIDDEN` | Authenticated but not authorized for this action |
| 404 | `NOT_FOUND` | Resource does not exist or not accessible |
| 409 | `CONFLICT` | Unique constraint violation (e.g., duplicate employeeNo) |
| 500 | `INTERNAL_ERROR` | Server error - check logs |

### Response Structure

**Success Response (List):**
```json
{
  "success": true,
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 20,
  "hasMore": true
}
```

**Success Response (Create/Update):**
```json
{
  "success": true,
  "employee": { ... }
}
```

**Error Response:**
```json
{
  "error": "Validation error",
  "details": [
    { "path": ["firstName"], "message": "Required" }
  ]
}
```

### Endpoints

#### Organization Structure
- `GET/POST /api/cvision/departments` - List/create departments
- `GET/PATCH/DELETE /api/cvision/departments/[id]` - Get/update/archive department
- `GET/POST /api/cvision/org/departments` - Alias for departments (cleaner API)
- `GET/PATCH/DELETE /api/cvision/org/departments/[id]` - Alias for department detail
- `GET/POST /api/cvision/units` - List/create units
- `GET/PUT/DELETE /api/cvision/units/[id]` - Get/update/archive unit

**Query Parameters for Lists:**
- `includeArchived=true` - Include archived/soft-deleted records
- `search=term` - Search by name/code
- `page=1&limit=20` - Pagination

#### Job Configuration
- `GET/POST /api/cvision/job-titles` - List/create job titles
- `GET/PUT/DELETE /api/cvision/job-titles/[id]` - Get/update/archive job title
- `GET/POST /api/cvision/grades` - List/create grades
- `GET/PUT/DELETE /api/cvision/grades/[id]` - Get/update/archive grade

#### Employee Management
- `GET/POST /api/cvision/employees` - List/create employees
- `GET/PUT/DELETE /api/cvision/employees/[id]` - Get/update/archive employee
- `POST /api/cvision/employees/[id]/status` - Change employee status
- `GET /api/cvision/employees/[id]/history` - Get status history

#### Case Management (Requests & Escalation)
- `GET /api/cvision/requests` - List requests (filters: type, status, departmentId, confidentiality)
- `POST /api/cvision/requests` - Create request (requester = current employee, SLA auto-calculated)
- `GET /api/cvision/requests/[id]` - Get request (includes timeline events)
- `POST /api/cvision/requests/[id]/comment` - Add comment to request
- `POST /api/cvision/requests/[id]/escalate` - Escalate request (rule-based: overdue => auto-escalate)
- `POST /api/cvision/requests/[id]/assign` - Assign request (HR roles only)
- `POST /api/cvision/requests/[id]/close` - Close request with resolution
- `GET /api/cron/cvision/requests/run-sla` - Cron endpoint for automatic SLA escalation (every 15 minutes)

#### Dashboard & Analytics
- `GET /api/cvision/dashboard/manpower?range=30|90` - Manpower dashboard metrics per department
  - Returns: budgetedHeadcount, activeHeadcount, exited (last 30/90 days), variance, utilizationPercent

#### Payroll Engine
- `POST /api/cvision/payroll/runs` - Create payroll run (period: YYYY-MM format)
- `POST /api/cvision/payroll/runs/:id/dry-run` - Generate payslips without locking (status: DRY_RUN)
- `POST /api/cvision/payroll/runs/:id/approve` - Approve payroll run and lock data snapshot (status: APPROVED)
- `GET /api/cvision/payroll/runs/:id/payslips` - Get payslips for a payroll run

**Calculation Formula:**
- `gross = baseSalary + sum(allowances)`
- `net = gross - sum(deductions) - loanDeduction`
- Only ACTIVE loans are deducted
- Deterministic: same inputs always produce same outputs

**Status Flow:**
- `DRAFT` → `DRY_RUN` (via dry-run endpoint) → `APPROVED` (via approve endpoint) → `PAID` (future)

**Request Types:**
- `leave` - Leave Request (SLA: 48h)
- `complaint` - Complaint (SLA: 72h, auto-routes to HR)
- `transfer` - Transfer Request (SLA: 120h)
- `training` - Training Request (SLA: 96h)
- `payroll_issue` - Payroll Issue (SLA: 24h, auto-routes to HR)
- `other` - Other (SLA: 72h)

**Confidentiality Levels:**
- `normal` - Starts with manager
- `confidential` - Starts with HR (bypasses manager)
- `anonymous` - Starts with HR (bypasses manager)

**Escalation Path:** manager → hr → compliance

#### Recruitment (ATS)
- `GET/POST /api/cvision/recruitment/requisitions` - List/create job requisitions
- `GET/PUT /api/cvision/recruitment/requisitions/[id]` - Get/update requisition
- `GET/POST /api/cvision/recruitment/candidates` - List/create candidates
- `GET /api/cvision/recruitment/candidates/[id]` - Get candidate (includes documents and parse jobs)
- `PUT /api/cvision/recruitment/candidates/[id]` - Update candidate or change status
- `POST /api/cvision/recruitment/candidates/[id]/cv` - Upload CV metadata and enqueue parse job
- `POST /api/cvision/recruitment/candidates/[id]/screen` - Submit screening result
- `POST /api/cvision/internal/cv-parse/[jobId]/run` - Run CV parsing job (dev-only)

## RBAC/ABAC Model (PR-A: Enforced)

CVision implements a hybrid Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC) system with **deterministic enforcement** on all APIs.

### OWNER Role (Tenant Super-Admin Override)

The **OWNER** role is a reserved, tenant-scoped super-admin role that bypasses all RBAC/ABAC restrictions within CVision. Key characteristics:

- **Reserved Role**: OWNER cannot be granted via any UI or API endpoint. It can only be assigned through seed scripts or direct database updates.
- **Tenant-Scoped**: OWNER has full access within the current tenant only (still requires valid session + tenantId).
- **Bypass Rules**: OWNER bypasses:
  - Department-based ABAC restrictions
  - Section-level edit restrictions (can edit FINANCIAL section)
  - Status transition restrictions
  - Employee list filtering
- **Full Permissions**: OWNER can:
  - List/read/write all employees
  - Edit all profile sections (including FINANCIAL)
  - Transition any employee status
  - Access CV Inbox
  - Access all recruitment endpoints
  - Access all payroll endpoints
- **Security**: No API endpoint exists to grant OWNER. Role management UI (if exists) must reject OWNER assignment with error code `OWNER_ROLE_RESERVED`.
- **Role Storage**: OWNER role is stored in `user.role` field as `'owner'` (lowercase). The authz context builder (`getAuthzContext`) automatically detects `user.role === 'owner'` and adds `CVISION_ROLES.OWNER` to the roles array.
- **Central Override**: OWNER override is implemented in `enforce()` function (`lib/cvision/authz/enforce.ts`). All policy checks go through `enforce()`, which checks for OWNER role first and bypasses all restrictions if present.

### Authorization Architecture

**Core Components:**
- `lib/cvision/authz/context.ts` - Builds authz context (tenantId, userId, roles, employeeId, departmentIds, employeeStatus)
- `lib/cvision/authz/policy.ts` - Policy functions (canListEmployees, canReadEmployee, canWriteEmployee, etc.)
- `lib/cvision/authz/enforce.ts` - Enforcement helpers (requireCtx, enforce, deny)

**Enforcement Pattern:**
Every CVision API route MUST:
1. Call `requireCtx(request)` to build authz context (returns 401 if no session, 403 if terminated)
2. Call policy function (e.g., `canListEmployees(ctx)`)
3. Call `enforce(policyResult, request, ctx)` to get standardized 403 response if denied
4. Apply department filters based on context

### Status-Based Access Control

**TERMINATED Employees:**
- **Blocked** from all CVision internal routes (403 with code `TERMINATED_ACCESS_BLOCKED`)
- Cannot access dashboard, employees, requisitions, candidates, requests
- Exception: Can view final payslip requests (handled separately)

**RESIGNED Employees:**
- **Read-only** access (403 on write endpoints with code `RESIGNED_READONLY`)
- Can read own data and department data
- Cannot create/update/delete

**PROBATION Employees:**
- Full access but with restricted privileges (configurable)
- Currently: Allowed with tagging for future restrictions

### Error Codes

All authorization denials return standardized 403 responses:

```json
{
  "error": "Access denied",
  "code": "TERMINATED_ACCESS_BLOCKED",
  "message": "Access denied: terminated employee"
}
```

**Common Codes:**
- `TERMINATED_ACCESS_BLOCKED` - Terminated user attempted access
- `RESIGNED_READONLY` - Resigned user attempted write
- `CANDIDATE_NO_INTERNAL_ACCESS` - Candidate attempted internal CVision access
- `DEPARTMENT_MISMATCH` - User's department doesn't match resource
- `SELF_ONLY` - Employee attempted to access other employee's data
- `INSUFFICIENT_PERMISSION` - Generic permission denied
- `PAYROLL_ADMIN_ONLY` - Payroll access requires HR_ADMIN/CVISION_ADMIN

### Audit Logging

All authorization denials are logged to `CvisionAuditLog` with:
- Action: `authz_deny`
- Entity Type: `authz`
- Reason code and details
- Endpoint URL
- User roles and employee status

### Diagnostics

The `/cvision/diagnostics` page (dev-only) shows:
- Resolved `tenantId`
- `userId` and `roles`
- `employeeId` (if user is linked to employee record)
- `departmentIds` (user's department scope)
- `employeeStatus` (terminated/resigned/probation/active)
- Database counts for all collections

This helps debug tenant mismatches and access issues.

### CVision Roles

| Role | Description | Scope |
|------|-------------|-------|
| `owner` | **Tenant super-admin override** - Reserved, not grantable via UI/API. Bypasses all ABAC/Department restrictions. Full access to all CVision features within tenant. | Tenant-wide (all departments) |
| `cvision_admin` | Full CVision module admin | Tenant-wide |
| `hr_admin` | HR department admin | Tenant-wide |
| `hr_manager` | Day-to-day HR operations + team management | Tenant-wide |
| `employee` | Regular employee | Department + Self |
| `candidate` | Job applicant | Own application only |
| `auditor` | Read-only auditor | Tenant-wide (read) |

### Role Capabilities Matrix

| Capability | OWNER | CVision Admin | HR Admin | HR Manager | Employee | Candidate | Auditor |
|------------|:-----:|:-------------:|:--------:|:----------:|:--------:|:---------:|:-------:|
| Read all employees | ✅ | ✅ | ✅ | ✅ | ❌* | ❌ | ✅ |
| Write employees | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Change employee status | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete employees | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Read all requests | ✅ | ✅ | ✅ | ✅ | ❌* | ❌ | ✅ |
| Write requests | ✅ | ✅ | ✅ | ✅ | ✅** | ❌ | ❌ |
| Approve requests | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Escalate requests | ✅ | ✅ | ✅ | ✅ | ✅*** | ❌ | ❌ |
| Manage recruitment | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View own application | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Manage org structure | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View audit logs | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Manage roles | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit FINANCIAL section | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Bypass department ABAC | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

\* Department-scoped (same department + self)  
\** Self-only  
\*** Only own rejected requests

### Department-Based Access (ABAC)

Certain roles have department-scoped access:

```
┌─────────────────────────────────────────────────────────────┐
│                    Tenant-Wide Access                        │
│       CVision Admin, HR Admin, HR Manager, Auditor (read)   │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │  Department A     │  │  Department B     │                │
│  │                   │  │                   │                │
│  │  ├─ Employee A1   │  │  ├─ Employee B1   │                │
│  │  └─ Employee A2   │  │  └─ Employee B2   │                │
│  └──────────────────┘  └──────────────────┘                 │
│                                                              │
│  ┌──────────────────┐                                        │
│  │  Candidates       │ (application-scoped)                  │
│  │  ├─ Candidate 1   │ → can only see own application        │
│  │  └─ Candidate 2   │                                       │
│  └──────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

- **Employee A1** can see other employees in Department A + their own data
- **Candidate** can only see their own application status
- **HR roles** see all departments and all candidates

### Confidentiality Rules

### Request SLA & Escalation

**SLA Configuration (per type, in hours):**
- `leave`: 48 hours (2 days)
- `complaint`: 72 hours (3 days)
- `transfer`: 120 hours (5 days)
- `training`: 96 hours (4 days)
- `payroll_issue`: 24 hours (1 day - urgent)
- `other`: 72 hours (3 days default)

**Escalation Rules:**
- **Automatic Escalation**: When `slaDueAt` is breached (overdue), request auto-escalates to next level
- **Escalation Path**: `manager` → `hr` → `compliance` (terminal)
- **Initial Owner**:
  - `normal` confidentiality → starts with `manager`
  - `confidential`/`anonymous` → starts with `hr` (bypasses manager)
  - `complaint`/`payroll_issue` types → always start with `hr`

**Cron Job:**
- Endpoint: `GET /api/cron/cvision/requests/run-sla`
- Schedule: Every 15 minutes (configured in `vercel.json`)
- Security: Protected by `CRON_SECRET` environment variable
- Action: Finds overdue requests and auto-escalates them

Requests have confidentiality levels that affect visibility:

| Confidentiality | Employee in Dept | HR Roles |
|-----------------|:----------------:|:--------:|
| `normal` | ✅ Can view | ✅ |
| `confidential` | ❌ Cannot view | ✅ |
| `anonymous` | ❌ Cannot view | ✅ (no requester name) |

### Policy Functions

Located in `lib/cvision/policy.ts`:

```typescript
// Employee policies
canReadEmployee(ctx, employee)      // Read access check
canWriteEmployee(ctx, employee)     // Write access check
canChangeEmployeeStatus(ctx, emp)   // Status change check
canDeleteEmployee(ctx, employee)    // Delete check

// Request policies
canReadRequest(ctx, request)        // Read access check (includes confidentiality)
canCreateRequest(ctx, request)      // Create check
canApproveRequest(ctx, request)     // Approval check
canEscalateRequest(ctx, request)    // Escalation check

// Candidate policies (NEW)
canReadCandidate(ctx, candidate)    // Read access check

// Recruitment policies
canManageRecruitment(ctx)           // Recruitment access
canReadRequisition(ctx, req)        // Requisition read

// Access Filters (NEW)
buildAccessFilter(ctx)              // General MongoDB filter
buildRequestAccessFilter(ctx)       // Request-specific filter (with confidentiality)
buildCandidateAccessFilter(ctx)     // Candidate-specific filter

// Query helpers
buildAccessFilter(ctx)              // MongoDB filter for scoped access
```

### Middleware Helpers

Located in `lib/cvision/middleware.ts`:

```typescript
// Session & Tenant
requireSession(request)             // Validate session, return context
requireTenant(ctx)                  // Verify tenant exists
requireSessionAndTenant(request)    // Combined check

// Role checks
requireRole(ctx, [roles])           // Require specific roles
requireMinimumRole(ctx, role)       // Require minimum role level

// Policy enforcement
enforcePolicy(policyResult, action) // Convert policy result to error
toPolicyContext(session)            // Convert session to policy context
```

### API Route Pattern

Every CVision API route must follow this pattern:

```typescript
export async function GET(request: NextRequest) {
  // 1. Require session + tenant
  const sessionResult = await requireSessionAndTenant(request);
  if (!sessionResult.success) {
    return middlewareError(sessionResult);
  }
  const ctx = sessionResult.data!;
  
  // 2. (Optional) Require specific role
  const roleCheck = requireRole(ctx, [CVISION_ROLES.HR_ADMIN]);
  if (!roleCheck.success) {
    return middlewareError(roleCheck);
  }
  
  // 3. Load resource
  const employee = await getEmployee(id);
  
  // 4. Enforce policy (ABAC)
  const policyCtx = toPolicyContext(ctx);
  const canRead = canReadEmployee(policyCtx, employee);
  const policyCheck = enforcePolicy(canRead, 'read this employee');
  if (!policyCheck.success) {
    return middlewareError(policyCheck);
  }
  
  // 5. Return data
  return NextResponse.json({ data: employee });
}
```

### Platform Role Mapping

Platform roles are automatically mapped to CVision roles:

| Platform Role | CVision Role |
|--------------|--------------|
| `thea-owner` | `cvision_admin` |
| `admin` | `cvision_admin` |
| `group-admin` | `hr_admin` |
| `hospital-admin` | `hr_admin` |
| `hr-manager` | `hr_admin` |
| `supervisor` | `manager` |
| `staff` | `employee` |
| `viewer` | `auditor` |

### Security Rules

1. **Tenant Isolation**: Every policy check verifies `ctx.tenantId === resource.tenantId`
2. **Self-Approval Prevention**: Users cannot approve their own requests
3. **Soft Delete Only**: Hard deletes are not allowed; use `deletedAt` timestamp
4. **Audit Trail**: All mutations must be logged via `logCVisionAudit()`
5. **Escalation Rules**: Employees can only escalate rejected requests

## Employee Status Engine

### Status Types
```typescript
type EmployeeStatus = 
  | 'active'           // Currently employed
  | 'probation'        // Probationary period
  | 'suspended'        // Temporarily suspended
  | 'on_leave'         // On approved leave
  | 'terminated'       // Employment ended
  | 'resigned'         // Voluntary resignation
  | 'retired';         // Retired
```

### Status Transitions
```
probation → active → on_leave → active
         ↘        ↘          ↘
          terminated  suspended  resigned/retired
```

All status changes are immutable and logged to `cvision_employee_status_history`.

## Request Types

```typescript
type RequestType =
  | 'leave'            // Leave request
  | 'document'         // Document request (letter, certificate)
  | 'grievance'        // Employee grievance
  | 'transfer'         // Transfer request
  | 'promotion'        // Promotion request
  | 'other';           // Other HR request
```

### Escalation Flow
```
submitted → under_review → approved/rejected
                        ↘
                         escalated → resolved
```

## Recruitment Pipeline

### Candidate Stages
```typescript
type CandidateStage =
  | 'applied'          // Initial application
  | 'screening'        // Under screening
  | 'shortlisted'      // Passed screening
  | 'interview'        // Interview stage
  | 'offer'            // Offer extended
  | 'hired'            // Accepted and hired
  | 'rejected';        // Rejected at any stage
```

## File Structure

```
lib/cvision/
├── index.ts           # Module re-exports
├── types.ts           # TypeScript interfaces
├── constants.ts       # Enums and constants
├── paths.ts           # Route path definitions
├── auth.ts            # Auth helpers (wraps existing)
├── tenant.ts          # Tenant helpers (wraps existing)
├── audit.ts           # Audit logging (wrapper; no new audit system)
├── db.ts              # Collection helpers
├── validation.ts      # Zod validation schemas
├── featureFlags.ts    # Integration feature flags (disabled by default)
├── roles.ts           # CVision role definitions
├── policy.ts          # ABAC policy functions
├── middleware.ts      # API middleware helpers
└── auth-risk.ts       # Suspicious login detection

app/api/cvision/
├── departments/
│   ├── route.ts
│   └── [id]/route.ts
├── units/
│   ├── route.ts
│   └── [id]/route.ts
├── job-titles/
│   ├── route.ts
│   └── [id]/route.ts
├── grades/
│   ├── route.ts
│   └── [id]/route.ts
├── employees/
│   ├── route.ts
│   └── [id]/
│       ├── route.ts
│       ├── status/route.ts
│       └── history/route.ts
├── requests/
│   ├── route.ts
│   └── [id]/
│       ├── route.ts
│       └── escalate/route.ts
└── recruitment/
    ├── requisitions/
    │   ├── route.ts
    │   └── [id]/route.ts
    └── candidates/
        ├── route.ts
        └── [id]/
            ├── route.ts
            └── screen/route.ts

app/(dashboard)/cvision/
├── layout.tsx         # CVision layout
├── page.tsx           # Dashboard
├── organization/
│   └── page.tsx       # Org structure management
├── employees/
│   ├── page.tsx       # Employee list
│   └── [id]/page.tsx  # Employee detail
├── requests/
│   └── page.tsx       # Request management
└── recruitment/
    └── page.tsx       # ATS dashboard

scripts/
└── seed-cvision.ts    # Demo data seeding
```

## Security Considerations

1. **No Hard Deletes**: Use `deletedAt` for soft delete
2. **Audit Everything**: All mutations logged
3. **Tenant Isolation**: tenantId from session only
4. **Input Validation**: Zod schemas on all inputs
5. **Permission Checks**: RBAC enforced at API layer
6. **Department Scoping**: Employees limited to their dept

## Auth Risk Scoring (MVP)

CVision includes a suspicious login detection system that scores authentication events without blocking logins.

### Overview

Located in `lib/cvision/auth-risk.ts`, the system:
- Logs each login attempt with IP, userAgent, country (if available), timestamp
- Calculates a risk score (0-100) based on multiple factors
- Flags suspicious logins without blocking them
- Stores events in `cvision_auth_events` collection

### Risk Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| `new_ip` | 25 | Login from IP not seen in 24h |
| `new_device` | 20 | Login from new browser/device |
| `failed_attempts` | 30 | 5+ failed attempts in 15 minutes |
| `rapid_attempts` | 35 | 3+ attempts in 1 minute |
| `unusual_time` | 15 | Login outside 6 AM - 10 PM |
| `unusual_country` | 40 | Login from unexpected country |
| `concurrent_sessions` | 10 | Multiple active sessions |
| `impossible_travel` | 50 | Geographic impossibility |

### Risk Thresholds

| Level | Score | Action |
|-------|-------|--------|
| Low | 0-19 | Normal login |
| Medium | 50-74 | Flagged as suspicious |
| High | 75-89 | Strongly suspicious |
| Critical | 90-100 | Very suspicious |

### CvisionAuthEvent Collection

```typescript
interface CvisionAuthEvent {
  id: string;
  tenantId: string;
  userId?: string;       // May be null for failed attempts
  email?: string;
  ip: string;
  userAgent: string;
  country?: string;
  success: boolean;
  riskScore: number;     // 0-100
  riskFactors: RiskFactor[];
  eventType: AuthEventType;
  metadata?: Record<string, any>;
  createdAt: Date;
}
```

### Usage

```typescript
import { logAuthEvent, isSuspiciousLogin } from '@/lib/cvision/auth-risk';

// Log a login attempt
const event = await logAuthEvent({
  db,
  tenantId,
  userId,
  email,
  ip: request.headers.get('x-forwarded-for') || 'unknown',
  userAgent: request.headers.get('user-agent') || 'unknown',
  success: true,
  eventType: 'login_success',
});

// Check if suspicious
if (isSuspiciousLogin(event.riskScore)) {
  // Log for security review (don't block)
  console.warn('[CVision Auth] Suspicious login detected', event);
}
```

### Important Notes

1. **No Blocking**: The system only scores and audits; it does NOT block logins
2. **Privacy**: IP addresses and user agents are stored for security purposes
3. **TTL**: Events are automatically deleted after 90 days (TTL index)
4. **Tenant-Scoped**: All events are isolated per tenant

## Feature Flags

CVision uses feature flags to control integration with other platforms (SAM, Thea Health). All integrations are **disabled by default** to maintain CVision isolation.

### Available Feature Flags

Located in `/lib/cvision/featureFlags.ts`:

| Flag | Default | Description |
|------|---------|-------------|
| `FEATURE_EMPLOYEE_SYNC` | `false` | Sync employee data with SAM/Thea Health |
| `FEATURE_AUTH_FEDERATION` | `false` | Federate authentication with SAM/Thea Health |
| `FEATURE_DATA_EXPORT` | `false` | Export CVision data to SAM/Thea Health formats |
| `FEATURE_CROSS_PLATFORM_REPORTING` | `false` | Generate reports combining data from multiple platforms |

### Usage

```typescript
import { isEmployeeSyncEnabled, requireFeature } from '@/lib/cvision/featureFlags';

// Check if feature is enabled
if (isEmployeeSyncEnabled()) {
  // Integration code here
}

// Guard function (throws if disabled)
requireFeature('employee_sync');
// Integration code here

// Conditional execution
const result = guardFeature('employee_sync', () => {
  // Integration code here
  return syncData();
});
```

### Enabling Integrations

To enable an integration:

1. Set the feature flag to `true` in `/lib/cvision/featureFlags.ts`
2. Implement the integration logic
3. Add tests
4. Document the integration in this README

**Important**: CVision is designed to be isolated. Only enable integrations when explicitly required.

## Database Setup

### Migration

Run the migration to create indexes:

```bash
dotenv -e .env.local -- tsx scripts/migrations/034_cvision_prisma_models.ts
```

Or for a specific tenant:

```bash
TENANT_ID=your-tenant-id dotenv -e .env.local -- tsx scripts/migrations/034_cvision_prisma_models.ts
```

### Seed Demo Data

Seed demo data for testing:

```bash
dotenv -e .env.local -- tsx scripts/seed/seed_cvision_demo.ts
```

This creates:
- 1 demo tenant (`demo-cvision-tenant`)
- 3 departments (HR, IT, Finance)
- 2 units (Recruitment, Development)
- 2 grades (G1, G2)
- 3 job titles (HR Manager, Recruiter, Software Engineer)
- 5 employees with manager chain

### Prisma Client Generation

After schema changes, generate Prisma client:

```bash
npx prisma generate
```

## CV Upload Flow

CVision supports CV document upload and parsing for candidates. The flow is as follows:

### 1. Upload CV Document

**Endpoint:** `POST /api/cvision/recruitment/candidates/:id/cv`

**Process:**
1. User selects a CV file (PDF, DOC, DOCX) from the candidate detail page
2. File metadata is sent to the endpoint: `fileName`, `storageKey` (placeholder), `mimeType`, `fileSize`
3. System creates a `CvisionCandidateDocument` record with `kind='CV'`
4. System creates a `CvisionCvParseJob` record with `status='QUEUED'`
5. All operations are audited

**Note:** For MVP, `storageKey` is a placeholder path. In production, this would be an S3 key or storage service URL.

### 2. Parse CV (Dev-Only)

**Endpoint:** `POST /api/cvision/internal/cv-parse/:jobId/run`

**Process:**
1. Dev-only endpoint (restricted to development environment)
2. Fetches the parse job and associated document
3. Runs parsing logic (MVP: stub implementation)
4. Extracts structured data: `name`, `email`, `phone`, `education[]`, `experience[]`, `skills[]`
5. Updates parse job status to `DONE` or `FAILED`
6. Stores `extractedJson` and `extractedText` in parse job
7. Updates document with `extractedText`

**MVP Implementation:**
- Currently uses stub implementation (no external services)
- Returns placeholder structure for manual extraction
- Ready for integration with local parsing libraries (pdf-parse, mammoth, etc.)

### 3. View Results

**Candidate Detail Page:** `/cvision/recruitment/candidates/[candidateId]`

**Displays:**
- Latest uploaded CV document (fileName, createdAt)
- Parse job status (QUEUED/DONE/FAILED)
- Extracted data preview (when status is DONE)
- "Run Parse (dev)" button for QUEUED jobs

### Data Models

**CvisionCandidateDocument:**
- `kind`: 'CV' | 'CERTIFICATE' | 'OTHER'
- `fileName`: Original filename
- `storageKey`: Storage location (placeholder for MVP)
- `extractedText`: Raw extracted text (populated after parsing)

**CvisionCvParseJob:**
- `status`: 'QUEUED' | 'DONE' | 'FAILED'
- `extractedJson`: Structured data (name, email, phone, education[], experience[], skills[])
- `extractedText`: Raw extracted text
- `errors`: Error messages if parsing failed
- `startedAt`, `completedAt`: Timestamps

### UI Routes

- `/cvision/recruitment/requisitions/[id]/candidates` - List candidates for a requisition
- `/cvision/recruitment/candidates/[candidateId]` - Candidate detail page with CV upload

### Constraints

- No external storage integration (local placeholder paths)
- Parse endpoint is dev-only (development environment restriction)
- All mutations are tenant-scoped and audited
- MVP parsing uses stub implementation (ready for library integration)

## Testing

Critical paths to test:
1. Tenant isolation (data cannot leak between tenants)
2. Employee status transitions (valid/invalid)
3. Request escalation flow
4. Recruitment pipeline transitions
5. RBAC permission enforcement
6. Audit log completeness
7. Dynamic profile schema versioning
8. Manager chain integrity

## Migration Notes

### Phase 0 (Foundation)
- [ ] Lib foundations (types, constants, audit)
- [ ] Platform key registration
- [ ] Basic API routes scaffold

### Phase 1 (Core HR)
- [ ] Organization structure APIs
- [ ] Employee master APIs
- [ ] Status engine
- [ ] Request management
- [ ] Basic recruitment ATS

### Phase 2+ (Future)
- Performance management
- Training & development
- Payroll integration hooks
- Advanced analytics
- Document management
