# AUDIT PHASE 5 -- Security & Edge Cases

**Auditor:** Claude Opus 4.6 (Senior QA)
**Date:** 2026-04-01
**Scope:** Thea full-stack -- EHR, CVision (HR), SAM (Governance), Imdad (Supply Chain)

---

## 5.1 Security Issues

### 5.1.1 Authentication Bypass -- API Routes Without Auth Guards

**Severity: CRITICAL**

156 API route files lack `withAuthTenant`, `requireAuth`, `requireOwner`, or equivalent auth guards. After excluding legitimate public routes (portal auth, health checks, init), the following **sensitive routes are unprotected**:

#### Imdad (Supply Chain) -- No Auth

| Route | Risk |
|-------|------|
| `app/api/imdad/admin/seed-accounts/route.ts` | **CRITICAL** -- Seeds user accounts with hardcoded password `123456`. No auth check. Anyone can create accounts in any tenant. |
| `app/api/imdad/metrics/route.ts` | MEDIUM -- Exposes internal metrics without auth |

#### Admin Routes -- No `withAuthTenant`

These routes use `requireAuth` or `requireRole` from `lib/security/auth.ts` instead of `withAuthTenant`. They may have auth but lack CSRF, tenant isolation, or platform entitlement checks:

| Route | Risk |
|-------|------|
| `app/api/admin/users/route.ts` | HIGH -- User management (create, list) uses custom auth, not `withAuthTenant` |
| `app/api/admin/users/find/route.ts` | HIGH -- User lookup |
| `app/api/admin/users/[id]/route.ts` | HIGH -- User update/delete |
| `app/api/admin/users/[id]/platform-access/route.ts` | HIGH -- Platform access management |
| `app/api/admin/roles/route.ts` | HIGH -- Role management |
| `app/api/admin/roles/[roleKey]/route.ts` | HIGH -- Role modification |
| `app/api/admin/integrations/route.ts` | MEDIUM -- Integration settings |
| `app/api/admin/structure/route.ts` | MEDIUM -- Org structure |

#### CDO (Clinical Decision) -- Uses `requireAuth` but no tenant scoping

| Route | Risk |
|-------|------|
| `app/api/cdo/metrics/route.ts` | MEDIUM -- Clinical metrics |
| `app/api/cdo/quality-indicators/route.ts` | MEDIUM |
| `app/api/cdo/flags/route.ts` | MEDIUM |
| `app/api/cdo/analysis/route.ts` | MEDIUM |
| `app/api/cdo/dashboard/route.ts` | MEDIUM |
| `app/api/cdo/outcomes/route.ts` | MEDIUM |
| `app/api/cdo/prompts/route.ts` | MEDIUM |

#### Integration Endpoints -- No Auth

| Route | Risk |
|-------|------|
| `app/api/integration/hl7/receive/route.ts` | **CRITICAL** -- HL7 message ingestion with no auth. Attackers could inject fake lab results, ADT events, or clinical data. |
| `app/api/integrations/hl7/receive/route.ts` | **CRITICAL** -- Duplicate HL7 endpoint, also unprotected |
| `app/api/integrations/hl7/inbound/route.ts` | **CRITICAL** -- Another unprotected HL7 ingestion point |

#### Other Unprotected Routes

| Route | Risk |
|-------|------|
| `app/api/dashboard/stats/route.ts` | MEDIUM -- Uses `requireAuth` but exposes dashboard statistics |
| `app/api/platform/get/route.ts` | LOW -- Platform detection |
| `app/api/docs/route.ts` | LOW -- Public OpenAPI docs (intentionally public) |
| `app/api/policies/route.ts` | LOW -- Legacy route guard returning 404 |
| `app/api/policies/ai-create/route.ts` | MEDIUM -- Policy creation endpoint |
| `app/api/taxonomy/sectors/route.ts` | LOW -- Taxonomy data |
| `app/api/nursing/scheduling/route.ts` | HIGH -- Nurse scheduling data |
| `app/api/nursing/operations/route.ts` | HIGH -- Nursing operations |

### 5.1.2 Middleware Auth Bypass Vectors

**Severity: HIGH**

**Finding 1: API routes skip all middleware auth enforcement**
- `middleware.ts` line ~230: `if (pathname.startsWith(apiPrefix)) { const response = NextResponse.next(); applySecurityHeaders(response); return response; }`
- ALL API routes under `/api/*` skip middleware authentication entirely. Auth is delegated to individual route handlers. This means any route missing its own auth guard is completely open.

**Finding 2: Owner bypass in development**
- `middleware.ts` line ~303: `const ownerBypass = isOwnerRole && process.env.THEA_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production';`
- While gated to non-production, if `THEA_TEST_MODE=true` is accidentally set, owner role gets full bypass of all platform isolation and tenant restrictions.

### 5.1.3 Hardcoded Credentials

**Severity: CRITICAL**

| File | Line | Issue |
|------|------|-------|
| `app/api/imdad/admin/seed-accounts/route.ts` | 40 | `hashPassword('123456')` -- All seed accounts use password `123456`. This endpoint has NO auth, so anyone can call it. |
| `app/api/imdad/admin/seed-accounts/route.ts` | 132 | Response includes `password: '123456 (same for all)'` -- reveals password in API response |

### 5.1.4 SQL Injection Risk

**Severity: HIGH**

**Finding 1: String interpolation in `$executeRawUnsafe`**
- `app/api/owner/tenants/[tenantId]/route.ts` lines 296-313
- Uses `$executeRawUnsafe` with `${sanitizedId}` interpolated directly into SQL string inside a DO block
- While there is UUID regex validation at line 290-292, the pattern of interpolating into `$executeRawUnsafe` is inherently risky. The `sanitizedId` comes from `tenant.id` (database value), so the actual risk is low, but the pattern is dangerous if copied.

**Finding 2: Table name interpolation in `upsertRawDoc`**
- `app/api/admin/clinical-infra/providers/bulk/route.ts` line 161
- `const sql = \`INSERT INTO "${table}" ...\``
- Table name is interpolated directly. If `table` parameter is user-controlled, this is SQL injection. The `table` values appear to come from internal code, but no allowlist validation exists.
- Same pattern at `app/api/clinical-infra/providers/[id]/assignments/route.ts` line 42

**Finding 3: Extensive use of `$queryRawUnsafe`**
- `app/api/imdad/search/route.ts` -- 5 separate raw queries. The `pattern` variable uses parameterized `$1`, `$2` so this is safe, but `LIM` (line 56) is interpolated directly into SQL as `LIMIT ${LIM}`. `LIM` is a constant (`const LIM = MAX_PER_CATEGORY` = 10), so safe in practice, but the pattern is fragile.
- Multiple Imdad dashboard routes use `$queryRawUnsafe` with parameterized queries (safe).

### 5.1.5 XSS via `dangerouslySetInnerHTML`

**Severity: MEDIUM**

| File | Line | Mitigation |
|------|------|------------|
| `app/(dashboard)/cvision/policies/page.tsx` | 162, 164 | Uses `sanitizeHtml()` -- **mitigated** |
| `app/layout.tsx` | 57 | Likely static content (font loading, etc.) -- **low risk** |
| `app/(dashboard)/imdad/network/page.tsx` | 121 | CSS keyframes injection -- **low risk** (static content) |
| `components/ui/chart.tsx` | 74 | Chart styling -- **low risk** |

Overall XSS risk is **LOW** -- the one dynamic use case (CVision policies) uses `sanitizeHtml`.

### 5.1.6 CORS Configuration

**Severity: MEDIUM**

| File | Line | Issue |
|------|------|-------|
| `app/api/docs/route.ts` | 22 | `Access-Control-Allow-Origin: '*'` -- Wildcard CORS on OpenAPI docs. Low risk since docs are public, but still overly permissive. |
| `app/api/cvision/docs/route.ts` | 9 | `Access-Control-Allow-Origin: '*'` -- Same for CVision API docs. |
| **Middleware** | -- | No CORS headers set on API responses in middleware. CORS is left to individual routes. Most routes don't set any CORS headers (browser default deny), which is correct. |

### 5.1.7 Content Security Policy Weaknesses

**Severity: MEDIUM**

- `middleware.ts` line 23: CSP includes `'unsafe-inline' 'unsafe-eval'` for script-src
- While noted as required by Next.js, `unsafe-eval` significantly weakens XSS protection. Consider using nonces instead.
- `lib/security/config.ts` lines 124-125 confirm this is intentional for Next.js compatibility.

### 5.1.8 Rate Limiting Coverage

**Severity: MEDIUM**

Rate limiting is applied to:
- Login (`app/api/auth/login/route.ts`) -- 20 attempts per IP per 5 min
- Patient search (`app/api/patients/search/route.ts`)
- Admin user management (`app/api/admin/users/route.ts`)
- Portal OTP (`app/api/portal/auth/request-otp/route.ts`)
- Data export (`app/api/admin/data-export/route.ts`, `app/api/portal/data-export/route.ts`)
- Identity lookup (`app/api/identity/lookup/route.ts`)
- Imdad workflow (`app/api/imdad/workflow/requests/route.ts`)

**Missing rate limiting on:**
- Password reset (`app/api/auth/forgot-password`, `app/api/auth/reset-password`) -- brute force risk
- 2FA verification -- brute force risk on TOTP codes
- HL7 ingestion endpoints -- DoS risk
- Seed accounts endpoint -- abuse risk
- All CDO endpoints
- SAM library/document operations
- Bulk operations (import, upload)

### 5.1.9 Sensitive Data Exposure

**Severity: MEDIUM**

| File | Issue |
|------|-------|
| `app/api/imdad/admin/seed-accounts/route.ts:132` | API response includes plaintext password: `password: '123456 (same for all)'` |
| `app/api/admin/data-export/route.ts:27` | User export query: `prisma.user.findMany({ where: { tenantId }, take: limit, select: { ... } })` -- uses `select` to limit fields, but need to verify password hash is excluded |
| `app/api/auth/2fa/disable/route.ts:24` | `select: { password: true, twoFactorEnabled: true, twoFactorSecret: true }` -- retrieves password hash and 2FA secret, but this is for server-side verification (acceptable if never sent to client) |

### 5.1.10 File Upload Validation

**Severity: LOW**

- `app/api/attachments/route.ts`: Validates file size (100MB max), entity type (allowlist), storage provider (allowlist). **Adequate for metadata-only uploads.**
- Actual file storage is `local_stub`/`s3_stub` -- no real file upload handling exists yet.
- When real file upload is implemented, need to add: MIME type validation, file extension validation, malware scanning, and path traversal prevention.

---

## 5.2 Edge Cases

### 5.2.1 Missing Input Validation

**Severity: HIGH**

| Area | Issue |
|------|-------|
| HL7 ingestion (`app/api/integration/hl7/receive/route.ts`) | Accepts any HL7 message string with no authentication. Malformed HL7 messages could cause parse errors or data corruption. |
| Imdad seed accounts | No validation on `tenantId` query param beyond existence check. Auto-discovers first tenant if none specified -- could seed accounts in the wrong tenant. |
| Owner tenant deletion (`app/api/owner/tenants/[tenantId]/route.ts`) | Uses `SET LOCAL session_replication_role = 'replica'` to disable FK constraints during deletion. If this fails mid-way, data integrity could be compromised. |
| CVision attendance biometric (`app/api/cvision/attendance/biometric/route.ts:221`) | Several fields commented out with `//` in the record creation, suggesting incomplete validation |

### 5.2.2 No Handling of Concurrent Edits

**Severity: MEDIUM**

Optimistic locking is implemented in:
- Imdad invoices (`app/api/imdad/financial/invoices/[id]/route.ts`) -- uses `version` field
- Imdad budgets (`app/api/imdad/financial/budgets/[id]/route.ts`) -- uses `version` field
- Imdad quality inspections (`app/api/imdad/quality/inspections/[id]/route.ts`)

**Missing optimistic locking / concurrent edit handling in:**
- Patient record updates
- Clinical notes editing
- Encounter updates
- Order modifications
- Prescription editing
- All CVision employee record updates
- All SAM document editing
- Pharmacy controlled substance records
- Lab result amendments

### 5.2.3 Date Boundary Issues

**Severity: LOW**

| Area | Issue |
|------|-------|
| Dashboard stats (`app/api/dashboard/stats/route.ts`) | Complex date range building with custom/shift/monthly granularity -- timezone handling may cause off-by-one for tenants in different timezones |
| CVision attendance | Overtime calculation depends on `isFriday` check -- hardcoded weekend assumption that may not apply to all regions |
| OPD appointments (`app/(dashboard)/opd/appointments/Appointments.tsx`) | Lines 60, 301: `if (Number.isNaN(d.getTime())) return null` -- silently drops invalid dates instead of flagging them |

### 5.2.4 Large Dataset Handling

**Severity: MEDIUM**

| Area | Issue |
|------|-------|
| Imdad search (`app/api/imdad/search/route.ts`) | Searches 1.7M+ items with `ILIKE` -- works but may be slow without proper indexing. Uses `LIMIT 10` per category. |
| Admin data export (`app/api/admin/data-export/route.ts`) | Uses `take: limit` but client controls the limit. No maximum cap visible. |
| Patient search | Rate-limited, which helps. |
| Owner tenant deletion | Iterates all tables with `tenantId` column -- for tenants with large datasets, this could timeout or lock tables. No progress reporting. |
| Attachment listing | `take: 200` hardcoded limit -- adequate |

---

## Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Auth Bypass | 4 | 8 | 8 | 3 |
| Hardcoded Credentials | 1 | 0 | 0 | 0 |
| SQL Injection | 0 | 2 | 0 | 0 |
| XSS | 0 | 0 | 1 | 0 |
| CORS | 0 | 0 | 2 | 0 |
| CSP | 0 | 0 | 1 | 0 |
| Rate Limiting | 0 | 0 | 1 | 0 |
| Data Exposure | 0 | 0 | 2 | 0 |
| Input Validation | 0 | 1 | 0 | 1 |
| Concurrent Edits | 0 | 0 | 1 | 0 |
| Date Boundaries | 0 | 0 | 0 | 1 |
| Large Datasets | 0 | 0 | 1 | 0 |
| **Total** | **5** | **11** | **17** | **5** |

---

## Top Priority Fixes Required

1. **CRITICAL: Unprotected HL7 endpoints** (`app/api/integration/hl7/receive/route.ts`, `app/api/integrations/hl7/*`) -- Add authentication (API key, mTLS, or IP allowlist). These accept clinical data with zero auth.

2. **CRITICAL: Imdad seed accounts endpoint** (`app/api/imdad/admin/seed-accounts/route.ts`) -- No auth, hardcoded `123456` password, exposes password in response. Must add auth guard and remove from production builds.

3. **CRITICAL: API routes skip middleware auth entirely** -- The middleware architecture delegates all API auth to individual handlers. Any new route that forgets to add auth is completely exposed. Consider adding a default-deny middleware layer for `/api/*` routes.

4. **HIGH: Admin routes using inconsistent auth** -- Admin user/role management routes use `requireAuth`/`requireRole` instead of `withAuthTenant`, potentially lacking CSRF protection and tenant isolation.

5. **HIGH: SQL interpolation patterns** -- Table name interpolation in clinical-infra providers. Add allowlist validation for table names.

6. **HIGH: Missing rate limiting on security-sensitive endpoints** -- Password reset, 2FA verification, and HL7 endpoints need rate limiting.

7. **MEDIUM: Missing optimistic locking** -- Patient records, clinical notes, and most CVision/SAM updates have no concurrent edit protection, risking data loss.
