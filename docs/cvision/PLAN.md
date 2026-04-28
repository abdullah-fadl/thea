# CVision (HR OS) - Implementation Plan

> **PR-0: Planning Document**  
> This document outlines the implementation plan for CVision as an isolated platform within HospitalOS2.

---

## 1. Repository Analysis Summary

### 1.1 Authentication & Session

| Aspect | Pattern |
|--------|---------|
| **Token Type** | JWT stored in HTTP-only `auth-token` cookie |
| **Token Payload** | `{ userId, email, role, sessionId, activeTenantId, entitlements }` |
| **Session Storage** | Platform DB `sessions` collection with TTL |
| **Tenant Source** | **ONLY from `session.activeTenantId`** - single source of truth |
| **Auth Helper** | `requireAuth()` from `lib/auth/requireAuth.ts` |
| **API Wrapper** | `withAuthTenant()` from `lib/core/guards/withAuthTenant.ts` |

### 1.2 Tenant Model

| Aspect | Pattern |
|--------|---------|
| **Architecture** | Database-per-tenant |
| **DB Naming** | `thea_tenant__<tenantId>` |
| **Registry** | Platform DB `tenants` collection |
| **Isolation** | `TenantCollection` wrapper auto-injects `tenantId` |
| **Collection Prefix** | Platform-scoped: `cvision_*` (e.g., `cvision_employees`) |

### 1.3 Audit Logging

| Field | Required |
|-------|----------|
| `tenantId` | ✅ Always |
| `actorUserId` | ✅ Always |
| `actorRole` | ✅ Always |
| `action` | ✅ Enum value |
| `resourceType` | ✅ Enum value |
| `resourceId` | ✅ Target entity ID |
| `changes.before` | ✅ For updates |
| `changes.after` | ✅ For creates/updates |
| `ip`, `userAgent` | Optional |

### 1.4 Prisma Conventions

```prisma
model CvisionEntity {
  id          String   @id @default(uuid())
  tenantId    String                          // REQUIRED
  code        String                          // Business identifier
  // ... domain fields ...
  isArchived  Boolean  @default(false)        // Soft delete
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?
  createdBy   String
  updatedBy   String

  @@unique([tenantId, code])                  // Tenant-scoped uniqueness
  @@index([tenantId])                         // Isolation index
  @@index([tenantId, isArchived])             // Common query
  @@map("cvision_entities")                   // Snake_case collection
}
```

---

## 2. CVision Folder Layout

```
/app
├── (dashboard)
│   └── cvision/
│       ├── layout.tsx                 # CVision layout (uses main sidebar)
│       ├── page.tsx                   # Dashboard
│       ├── organization/
│       │   └── page.tsx               # Departments & Units
│       ├── employees/
│       │   ├── page.tsx               # Employee list
│       │   └── [id]/
│       │       └── page.tsx           # Employee detail
│       ├── requests/
│       │   ├── page.tsx               # Request list
│       │   ├── new/
│       │   │   └── page.tsx           # Create request
│       │   └── [id]/
│       │       └── page.tsx           # Request detail + timeline
│       └── recruitment/
│           ├── page.tsx               # Redirects to requisitions
│           ├── requisitions/
│           │   └── page.tsx           # Job requisitions
│           └── candidates/
│               └── page.tsx           # Candidates list
│
├── api/cvision/
│   ├── health/route.ts                # Health check
│   ├── departments/
│   │   ├── route.ts                   # GET list, POST create
│   │   └── [id]/route.ts              # GET, PATCH, DELETE
│   ├── units/
│   │   ├── route.ts
│   │   └── [id]/route.ts
│   ├── job-titles/
│   │   ├── route.ts
│   │   └── [id]/route.ts
│   ├── grades/
│   │   ├── route.ts
│   │   └── [id]/route.ts
│   ├── employees/
│   │   ├── route.ts                   # GET list, POST create
│   │   └── [id]/
│   │       ├── route.ts               # GET, PATCH, DELETE
│   │       ├── status/route.ts        # POST status change
│   │       └── history/route.ts       # GET status history
│   ├── requests/
│   │   ├── route.ts                   # GET list, POST create
│   │   └── [id]/
│   │       ├── route.ts               # GET, PUT
│   │       ├── comment/route.ts       # POST comment
│   │       ├── escalate/route.ts      # POST escalate
│   │       ├── assign/route.ts        # POST assign (HR only)
│   │       └── close/route.ts         # POST close
│   └── recruitment/
│       ├── requisitions/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       └── candidates/
│           ├── route.ts
│           └── [id]/
│               ├── route.ts
│               └── documents/route.ts  # Document metadata

/lib/cvision/
├── index.ts                           # Barrel export
├── types.ts                           # TypeScript interfaces
├── constants.ts                       # Enums, status labels, SLA config
├── validation.ts                      # Zod schemas
├── db.ts                              # DB helpers (getCVisionCollection, etc.)
├── audit.ts                           # CVision audit logging
├── auth.ts                            # Auth helpers (re-export + CVision perms)
├── tenant.ts                          # Tenant extraction helpers
├── roles.ts                           # CVision role definitions
├── policy.ts                          # ABAC policy functions
└── middleware.ts                      # API middleware helpers

/docs/cvision/
├── PLAN.md                            # This document
└── README.md                          # Implementation notes
```

---

## 3. PR Breakdown (Journey 1: Items 1→7)

### PR-1: CVision Skeleton ✅
**Scope:** Foundation without database operations

- [x] `/app/(dashboard)/cvision/layout.tsx` - Layout using main sidebar
- [x] `/app/(dashboard)/cvision/page.tsx` - Dashboard placeholder
- [x] `/app/api/cvision/health/route.ts` - Health check endpoint
- [x] `/lib/cvision/index.ts` - Barrel export
- [x] `/lib/cvision/paths.ts` - Route constants
- [x] `/lib/cvision/constants.ts` - Initial enums
- [x] `/lib/cvision/auth.ts` - Auth wrapper re-exports
- [x] `/lib/cvision/tenant.ts` - Tenant helpers
- [x] `/docs/cvision/README.md` - Module documentation

**Deliverables:** Build passes, `/api/cvision/health` returns `{ ok: true }`

---

### PR-2: Access Control Foundation ✅
**Scope:** RBAC + ABAC without database

- [x] `/lib/cvision/roles.ts` - Role definitions:
  - `cvision_admin` - Full module access
  - `hr_admin` - HR department admin
  - `hr_specialist` - Day-to-day HR ops
  - `manager` - Department-scoped
  - `employee` - Self-service only
  - `auditor` - Read-only
- [x] `/lib/cvision/policy.ts` - Policy functions:
  - `canReadEmployee(ctx, employee)` - Department-scoped for managers
  - `canWriteEmployee(ctx, employee)` - HR roles only
  - `canCreateRequest(ctx, request)` - All employees
  - `canEscalateRequest(ctx, request)` - Rule-based
  - `buildAccessFilter(ctx)` - Dynamic query filter
- [x] `/lib/cvision/middleware.ts` - API helpers:
  - `requireSession()`
  - `requireTenant()`
  - `requireRole(...)`
  - `enforcePolicy(...)`
- [x] `/__tests__/cvision/policy.test.ts` - 25+ test cases

**Deliverables:** Policy functions tested, middleware helpers ready

---

### PR-3: Database Schema + Seed ✅
**Scope:** Prisma models and demo data

- [x] `prisma/schema.prisma` additions:
  - `CvisionDepartment`
  - `CvisionUnit`
  - `CvisionJobTitle`
  - `CvisionGrade`
  - `CvisionEmployee`
  - `CvisionEmployeeStatusHistory`
  - `CvisionAuditLog`
- [x] `/scripts/seed-cvision.ts`:
  - 3 departments
  - 4 units
  - 2 grades
  - 7 job titles
  - 5 employees with manager chain

**Deliverables:** Schema validated, seed script runnable

---

### PR-4: Organization + Employee APIs ✅
**Scope:** CRUD with audit logging

- [x] Departments API (`GET`, `POST`, `PATCH`, `DELETE`)
- [x] Units API
- [x] Job Titles API
- [x] Grades API
- [x] Employees API with:
  - List with filters (department, status, search)
  - Create with employee number generation
  - Update (safe fields only)
  - Status transitions with validation
  - Status history tracking
- [x] All mutations write `CvisionAuditLog`
- [x] Error codes: 400 (validation), 401, 403, 404, 409 (conflict)

**Deliverables:** APIs functional, audit logs captured

---

### PR-5: Requests & Escalation ✅
**Scope:** HR case management

- [x] `CvisionRequest` model:
  - Types: `leave`, `complaint`, `transfer`, `training`, `payroll_issue`, `other`
  - Statuses: `open`, `in_review`, `approved`, `rejected`, `escalated`, `closed`
  - Confidentiality: `normal`, `confidential`, `anonymous`
  - Owner roles: `manager`, `hr`, `compliance`
- [x] `CvisionRequestEvent` model for timeline
- [x] APIs:
  - `GET /requests` - Filters: type, status, confidentiality, departmentId
  - `POST /requests` - Auto SLA calculation, initial owner routing
  - `POST /requests/:id/comment`
  - `POST /requests/:id/escalate` - Rule-based
  - `POST /requests/:id/assign` - HR only
  - `POST /requests/:id/close`
- [x] SLA configuration per request type
- [x] Escalation rules:
  - Overdue → auto-escalate
  - Confidential/anonymous → starts with HR
  - Path: manager → hr → compliance
- [x] UI: Request list + detail with timeline

**Deliverables:** Full request lifecycle, SLA tracking

---

### PR-6: Recruitment ATS ✅
**Scope:** Basic applicant tracking

- [x] `CvisionJobRequisition` model:
  - Reasons: `new_role`, `backfill`, `temp`, `other`
  - Statuses: `draft`, `pending_approval`, `approved`, `rejected`, `open`, `closed`
  - Approval chain (JSON)
- [x] `CvisionCandidate` model:
  - Sources: `portal`, `referral`, `agency`, `other`
  - Statuses: `applied`, `screened`, `shortlisted`, `interview`, `offer`, `hired`, `rejected`
  - Screening score
- [x] `CvisionCandidateDocument` model (metadata only)
- [x] APIs:
  - Requisition CRUD with approval actions
  - Candidate intake + status changes
  - Document metadata upload
- [x] UI: Requisitions list + Candidates list

**Deliverables:** Working recruitment pipeline

---

### PR-7: Integration Hooks (Not Started)
**Scope:** Feature flags for SAM/Thea integration

- [ ] `/lib/cvision/integration.ts`:
  - Feature flag checks: `isEmployeeSyncEnabled()`, `isAuthFederationEnabled()`
  - No actual integration code yet
- [ ] `/app/api/cvision/integrations/route.ts`:
  - `GET` - List available integrations and status
  - `POST` - Enable/disable integration (admin only)
- [ ] Integration points placeholder:
  - Employee sync webhook receiver
  - Auth federation callback

**Deliverables:** Integration points defined, flags functional

---

## 4. Database Schema Outline

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
│ minSalary?      │      │ isArchived      │  │ (self-ref)
│ maxSalary?      │      └────────┬────────┘──┘
│ isArchived      │               │
└────────┬────────┘               │1
         │                        │
         │                   ┌────┴────┐
         │                   │    *    │
         │           ┌───────┴─────────┴───────┐
         │           │      CvisionUnit        │
         │           │─────────────────────────│
         │           │ id, tenantId            │
         │           │ departmentId            │
         │           │ code, name              │
         │           └───────────┬─────────────┘
         │                       │
         │    ┌──────────────────┼──────────────────┐
         │    │                  │                  │
         │    │           ┌──────┴──────┐           │
         │    │           │      *      │           │
┌────────┴────┴───────────┴─────────────┴───────────┴───────┐
│                     CvisionEmployee                        │
│────────────────────────────────────────────────────────────│
│ id, tenantId, employeeNo (unique)                          │
│ fullName, email, phone                                     │
│ departmentId, unitId?, jobTitleId, gradeId?                │
│ managerId? (self-reference)                                │
│ status (ACTIVE|PROBATION|ON_LEAVE|SUSPENDED|TERMINATED|...) │
│ hireDate, statusChangedAt                                  │
│ isArchived, createdAt, updatedAt                           │
└────────────────────────────┬──────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
┌─────────────────┐  ┌─────────────┐  ┌──────────────────┐
│CvisionRequest   │  │StatusHistory│  │CvisionCandidate  │
│─────────────────│  │─────────────│  │──────────────────│
│ requesterEmpId  │  │ employeeId  │  │ requisitionId    │
│ type, title     │  │ fromStatus  │  │ fullName, email  │
│ status, SLA     │  │ toStatus    │  │ status, score    │
│ confidentiality │  │ effectiveAt │  │                  │
│ ownerRole       │  └─────────────┘  └────────┬─────────┘
└────────┬────────┘                            │
         │                                     │
         ▼                                     ▼
┌─────────────────┐                   ┌──────────────────┐
│RequestEvent     │                   │CandidateDocument │
│─────────────────│                   │──────────────────│
│ requestId       │                   │ candidateId      │
│ eventType       │                   │ kind, fileName   │
│ payloadJson     │                   │ storageKey       │
└─────────────────┘                   └──────────────────┘
```

### Collections Summary

| Collection | Tenant-Scoped | Soft Delete | Unique Constraint |
|------------|---------------|-------------|-------------------|
| `cvision_departments` | ✅ | ✅ `isArchived` | `(tenantId, code)` |
| `cvision_units` | ✅ | ✅ | `(tenantId, departmentId, code)` |
| `cvision_job_titles` | ✅ | ✅ | `(tenantId, code)` |
| `cvision_grades` | ✅ | ✅ | `(tenantId, code)` |
| `cvision_employees` | ✅ | ✅ | `(tenantId, employeeNo)` |
| `cvision_employee_status_history` | ✅ | ❌ | - |
| `cvision_requests` | ✅ | ✅ | `(tenantId, requestNumber)` |
| `cvision_request_events` | ✅ | ❌ | - |
| `cvision_job_requisitions` | ✅ | ✅ | `(tenantId, requisitionNumber)` |
| `cvision_candidates` | ✅ | ✅ | - |
| `cvision_candidate_documents` | ✅ | ❌ | - |
| `cvision_audit_logs` | ✅ | ❌ | - |

---

## 5. Access Control Model

### 5.1 CVision Roles

| Role | Scope | Capabilities |
|------|-------|--------------|
| `cvision_admin` | Tenant-wide | All CVision operations |
| `hr_admin` | Tenant-wide | Employee CRUD, request approval, recruitment |
| `hr_specialist` | Tenant-wide | Employee view, request processing |
| `manager` | Department | View department employees, approve requests |
| `employee` | Self | View own profile, submit requests |
| `auditor` | Tenant-wide | Read-only access to all data |

### 5.2 Platform Role Mapping

| Platform Role | CVision Role |
|---------------|--------------|
| `thea-owner` | `cvision_admin` |
| `admin` | `cvision_admin` |
| `group-admin` | `hr_admin` |
| `hospital-admin` | `hr_admin` |
| `supervisor` | `manager` |
| `staff` | `employee` |
| `viewer` | `auditor` |

### 5.3 Department-Based Access (ABAC)

```typescript
// Managers can only access their department
function canReadEmployee(ctx: PolicyContext, employee: EmployeeResource): PolicyResult {
  // HR roles: access all
  if (['cvision_admin', 'hr_admin', 'hr_specialist'].includes(ctx.role)) {
    return { allowed: true };
  }
  
  // Manager: same department only
  if (ctx.role === 'manager') {
    if (ctx.departmentId === employee.departmentId) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Can only access employees in your department' };
  }
  
  // Employee: self only
  if (ctx.role === 'employee') {
    if (ctx.userId === employee.userId) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Can only access your own record' };
  }
  
  return { allowed: false, reason: 'Insufficient permissions' };
}
```

### 5.4 Request Confidentiality Rules

| Confidentiality | Initial Owner | Manager Can See | HR Can See |
|-----------------|---------------|-----------------|------------|
| `normal` | Manager | ✅ | ✅ |
| `confidential` | HR | ❌ | ✅ |
| `anonymous` | HR | ❌ | ✅ (no requester name) |

### 5.5 Escalation Path

```
manager → hr → compliance (terminal)
```

**Auto-escalation triggers:**
1. SLA breached (overdue)
2. Confidentiality requires HR
3. Request type is `complaint` or `payroll_issue`

---

## 6. API Contract Summary

### Standard Response Formats

**Success (List):**
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

**Success (Single):**
```json
{
  "success": true,
  "employee": { ... }
}
```

**Error:**
```json
{
  "error": "Validation error",
  "message": "firstName is required",
  "details": [{ "path": ["firstName"], "message": "Required" }]
}
```

### Error Codes

| Status | Meaning |
|--------|---------|
| 400 | Validation error (Zod) |
| 401 | Unauthorized (no/invalid session) |
| 403 | Forbidden (no permission) |
| 404 | Resource not found |
| 409 | Conflict (unique constraint) |
| 500 | Internal server error |

---

## 7. Implementation Notes

### Non-Negotiables

1. **Tenant isolation**: Every query includes `tenantId` from session
2. **Audit trail**: Every mutation writes to `cvision_audit_logs`
3. **Soft delete**: No hard deletes, use `isArchived` flag
4. **Deterministic APIs**: Same input → same output structure
5. **No SAM/Thea coupling**: CVision is isolated unless integration enabled

### Tech Stack

- **Framework**: Next.js 14 App Router
- **Database**: MongoDB (via Prisma for types, direct MongoClient for queries)
- **Validation**: Zod
- **Auth**: JWT + session (existing patterns)
- **Testing**: Vitest

### File Ownership

All CVision code lives in:
- `/app/(dashboard)/cvision/**`
- `/app/api/cvision/**`
- `/lib/cvision/**`
- `/docs/cvision/**`
- `/__tests__/cvision/**`

**Never modify** SAM/Thea files unless explicitly required for shared primitives.

---

## 8. Next Steps

| Priority | PR | Description |
|----------|-----|-------------|
| 🟢 | PR-7 | Integration Hooks (feature flags) |
| 🟡 | PR-8 | Leave Management (balances, calendar) |
| 🟡 | PR-9 | Reporting APIs (headcount, turnover) |
| 🟠 | PR-10 | Payroll Integration (placeholder) |
| 🟠 | PR-11 | Document Management (file uploads) |

---

*Document Version: 1.0*  
*Last Updated: 2026-01-25*  
*Author: CVision Implementation Team*
