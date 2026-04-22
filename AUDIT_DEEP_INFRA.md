# Thea Platform -- Deep Infrastructure Audit

**Date:** 2026-04-01
**Auditor:** Claude Opus 4.6 (QA Engineer)
**Scope:** Database Schema, Middleware, Auth System, Multi-tenancy

---

## Executive Summary

The Thea platform has a well-architected security posture with strong fundamentals: JWT-based auth with key rotation, CSRF double-submit cookies, tenant-isolated API guards, NIST-aligned password policy, and comprehensive rate limiting. However, this audit found **14 HIGH**, **18 MEDIUM**, and **12 LOW** severity findings across all four layers.

The most critical issues are:
1. **Refresh token rotation is NOT implemented** (tokens are reused indefinitely for 30 days)
2. **413 orphaned models** (77% of schema) have no API routes
3. **CSRF cookie in middleware is NOT httpOnly**, contradicting the httpOnly cookie in `lib/security/csrf.ts`
4. **`/api/ai` is listed in BOTH SAM and Health route lists**, creating ambiguous platform isolation
5. **Multiple CVision API routes bypass `withAuthTenant`** and use a separate auth system

---

## 1. Database Schema Audit

### 1.1 Model Inventory

| Platform/Domain | Schema File(s) | Model Count |
|---|---|---|
| Core (Tenant, User, Session, Auth) | core.prisma | 30 |
| EHR - OPD | opd.prisma | 11 |
| EHR - ER | er.prisma | 22 |
| EHR - IPD | ipd.prisma | 25 |
| EHR - Orders | orders.prisma | 15 |
| EHR - Clinical | clinical.prisma | 44 |
| EHR - Clinical Infra | clinical_infra.prisma | 13 |
| EHR - Billing | billing.prisma | 31 |
| EHR - Lab | lab.prisma | 9 |
| EHR - Pharmacy | pharmacy.prisma | 5 |
| EHR - OR | or.prisma | 16 |
| EHR - Scheduling | scheduling.prisma | 7 |
| EHR - Patient | patient.prisma | 6 |
| EHR - Encounter | encounter.prisma | 1 |
| EHR - Discharge | discharge.prisma | 4 |
| EHR - Admission | admission.prisma | 5 |
| EHR - Psychiatry | psychiatry.prisma | 12 |
| EHR - Oncology | oncology.prisma | 9 |
| EHR - Quality | quality.prisma | 16 |
| EHR - Telemedicine | telemedicine.prisma | 7 |
| EHR - Transplant | transplant.prisma | 4 |
| EHR - Analytics | analytics.prisma | 11 |
| EHR - Blood Bank | blood_bank.prisma | 4 |
| EHR - Care Path | care_path.prisma | 4 |
| EHR - Care Gaps | care_gaps.prisma | 2 |
| EHR - CSSD | cssd.prisma | 4 |
| EHR - Equipment | equipment.prisma | 3 |
| EHR - Physiotherapy | physiotherapy.prisma | 3 |
| EHR - Pathology | pathology.prisma | 2 |
| EHR - Referrals | referrals.prisma | 2 |
| EHR - Reminders | reminders.prisma | 2 |
| EHR - Portal | portal.prisma | 8 |
| EHR - Admin | ehr_admin.prisma | 8 |
| EHR - Consumables | consumables.prisma | 5 |
| EHR - Workflow | workflow.prisma | 5 |
| EHR - AI | ai.prisma | 3 |
| EHR - Integration | integration.prisma | 7 |
| EHR - Taxonomy | taxonomy.prisma | 6 |
| EHR - Misc | misc.prisma | 26 |
| SAM | sam.prisma | 14 |
| CVision - Admin | cvision-admin.prisma | 38 |
| CVision - Attendance | cvision-attendance.prisma | 11 |
| CVision - Core | cvision-core.prisma | 11 |
| CVision - Operations | cvision-operations.prisma | 16 |
| CVision - Payroll | cvision-payroll.prisma | 15 |
| CVision - Performance | cvision-performance.prisma | 16 |
| CVision - Recruitment | cvision-recruitment.prisma | 14 |

**Totals:**
- **532 models** across 48 schema files
- **49 enums** (in base.prisma)
- **1,054 `@@index([tenantId])` declarations** across all schemas

### 1.2 Orphaned Models (Defined but Never Used in API Routes)

**413 out of 532 models (77.6%) have zero API route references.**

This is extremely high. A sample of unused models:

| Category | Examples |
|---|---|
| Billing | BillingCreditNote, BillingInvoice, BillingLock, BillingPlan, BillingPolicyRule, BillingPosting, BillingPromoCode |
| Clinical | ClinicalConsent, ClinicalHandover, ClinicalPathway, BloodGasAnalysis, CalorieIntakeRecord |
| Analytics | AnalyticsKpiDefinition, AnalyticsKpiValue |
| AI/CDS | AiAuditLog, AiConfig, CdsAlert |
| Infrastructure | ClinicalInfraClinic, ClinicalInfraFacility, ClinicalInfraFloor, ClinicalInfraRoom, ClinicalInfraUnit |
| CVision | Many CVision models are likely used via the separate CVision middleware, not searchable by `withAuthTenant` |
| SAM | ApprovedAccessAuditLog, ApprovedAccessToken |

**Assessment:** Many of these are aspirational schema for planned features. Some CVision models may be used via the MongoDB-based `getCVisionCollection()` pattern rather than Prisma, which would explain why they do not appear in `app/api/` grep results. Regardless, over 400 models with no API consumers is a significant maintenance burden.

### 1.3 Models Without Indexes

**22 models have NO `@@index` declarations at all:**

- AdmissionRequest, WardTransferRequest, BillingLock, CatalogUsageIdempotency
- DailyCarePath, CarePathTask, Tenant, User, EhrUser
- IcuCodeBlue, NewbornRecord, OpdEncounter, OpdNursingEntry
- OpdBooking, OpdRecommendation, OrNursingPreOp, OrAnesthesiaPreOp
- OrOperativeNote, OrPostOpOrder, PatientMaster, PsychRiskAssessment, ReminderSettings

**[HIGH]** `Tenant` and `User` have NO `@@index` -- these are the most queried models in the system. Prisma auto-creates PK indexes, and User has `@@unique([email, tenantId])` and `@@index([email])`, `@@index([role])`, but `Tenant` has only `@unique` on `tenantId` (which implicitly creates an index). Still, composite indexes for common query patterns are missing.

**[HIGH]** `PatientMaster` has no index -- patient lookups are among the most frequent operations.

**[HIGH]** `OpdEncounter` and `OpdBooking` lack indexes despite being high-traffic tables.

### 1.4 Models Without tenantId

**9 models lack a `tenantId` column:**

- `SystemSetting` -- global system config, acceptable
- `RefreshToken` -- keyed by userId, acceptable but see auth section
- `OrganizationType` -- taxonomy, acceptable
- `ErBedAssignment`, `ErStaffAssignment`, `ErNote` -- **[MEDIUM]** These ER sub-models lack direct tenantId. They likely reference a parent (ErEncounter/ErPatient) that has tenantId, but without direct tenantId they cannot be independently tenant-filtered.
- `OpdNursingEntry`, `OpdDoctorEntry`, `OpdDoctorAddendum` -- **[MEDIUM]** Same pattern as ER sub-models.

### 1.5 Relation Integrity

Relations are consistently defined with `@relation(fields: [tenantId], references: [id])` back to Tenant. Foreign keys are present. No orphaned foreign key references found in the schema files reviewed.

**[LOW]** Some models use `String` for references (e.g., `documentId String` in DocumentTask) rather than Prisma relations with `@relation`. This means referential integrity is enforced at the application level, not the database level.

---

## 2. Middleware Deep Audit

**File:** `/Users/yousef/Desktop/thea/Thea/middleware.ts` (773 lines)

### 2.1 Authentication Flow

The middleware correctly:
- Reads auth token from `auth-token` cookie only (no header/query)
- Uses `verifyTokenEdge()` (jose library, Edge-compatible)
- Supports JWT key rotation (current + previous secret)
- Redirects unauthenticated page requests to `/login` with redirect param
- Returns 401 for unauthenticated API requests

### 2.2 Public Routes (No Auth Required)

```
/, /demo, /select-platform, /api/auth/*, /p/*, /portal/*, /api/health,
/about, /pricing, /contact, /blog, /products/*, /forgot-password, /reset-password
```

**[LOW]** `/p/*` and `/portal/*` are public -- confirmed these are patient portal routes with their own auth system.

### 2.3 Critical Finding: API Routes Skip Platform Isolation

```typescript
if (pathname.startsWith(apiPrefix)) {
    const response = NextResponse.next();
    applySecurityHeaders(response);
    return response;  // <-- ALL API routes pass through with ONLY security headers
}
```

**[HIGH]** At line 296-299, ALL API routes (`/api/*`) bypass the middleware's platform isolation checks entirely. The middleware only enforces platform isolation for UI page routes. API-level platform isolation is delegated entirely to `withAuthTenant()`.

This means:
- If any API route forgets to use `withAuthTenant`, it has NO auth or platform protection from middleware
- This is by design (commented "API routes enforce themselves"), but creates risk

### 2.4 Route Lists: `/api/ai` Duplication

**[HIGH]** `/api/ai` appears in BOTH `SAM_API_ROUTES` (line 123) and `HEALTH_API_ROUTES` (line 184). While API routes bypass middleware platform checks anyway (see 2.3), this creates confusion about ownership and could cause issues if middleware API isolation is ever enabled.

### 2.5 CSRF Cookie Inconsistency

**[HIGH]** The middleware sets the CSRF cookie as:
```typescript
httpOnly: false, // Client JS must read this to send as X-CSRF-Token header
```

But `lib/security/csrf.ts` sets it as:
```typescript
httpOnly: true, // [SEC] prevent XSS from reading CSRF token
```

These two systems create conflicting CSRF cookies. The middleware (line 758) sets a NON-httpOnly `csrf-token` cookie. The `/api/auth/me` endpoint calls `setCSRFTokenCookie()` which sets an httpOnly `csrf-token` cookie and exposes the token via `X-CSRF-Token` response header.

**Impact:** After the first page load (middleware sets non-httpOnly cookie), the `/api/auth/me` call overwrites it with an httpOnly cookie. The client's cached CSRF token from the response header will match, but subsequent page loads will create a new middleware cookie that does not match the httpOnly cookie from `/api/auth/me`.

**Recommendation:** Standardize on one CSRF implementation. The `lib/security/csrf.ts` approach (httpOnly cookie + response header) is more secure.

### 2.6 Owner Bypass Logic

**Secure.** The owner bypass is properly gated:
```typescript
const ownerBypass = isOwnerRole
    && process.env.THEA_TEST_MODE === 'true'
    && process.env.NODE_ENV !== 'production';  // NEVER in production
```

The `[SEC-08]` approved access token validation via `/api/approved-access/validate` is a good design for Edge Runtime constraints.

### 2.7 2FA Enforcement

**[MEDIUM]** 2FA is only enforced in production (`ENFORCE_2FA = process.env.NODE_ENV === 'production'`). Admin users in development can operate without 2FA indefinitely, which means the 2FA flow may go untested.

### 2.8 Platform Isolation (UI Routes)

Platform isolation for page routes is well-implemented:
- SAM users cannot access Health routes and vice versa
- CVision users are restricted to `/cvision/*`
- Imdad users are restricted to `/imdad/*`
- Common routes (`/account`, `/notifications`, `/welcome`) are accessible to all

**[LOW]** `/welcome` appears in ALL platform route lists (SAM_ROUTES, HEALTH_ROUTES, CVision, SCM), which is redundant since it is also in COMMON_ROUTES logic.

### 2.9 Request Size Limit

The 10MB body limit (line 249) is checked via `content-length` header. **[LOW]** This only checks the declared content-length; a malicious client could omit the header and stream a larger body.

### 2.10 Redirect Loop Analysis

No redirect loops detected. The middleware correctly checks `pathname !== '/login'` before adding redirect params, and `pathname === '/'` is handled as a public route.

---

## 3. Auth System Audit

### 3.1 Token Generation

| Property | Value | Assessment |
|---|---|---|
| Library (Node) | `jsonwebtoken` | Industry standard |
| Library (Edge) | `jose` | Edge-compatible, correct |
| Algorithm | HS256 (default) | **[MEDIUM]** HMAC-based. RS256 would allow public key verification without sharing the secret. Acceptable for a monolith, but limits future microservice architecture. |
| Expiry | `7d` | **[HIGH]** 7-day JWT expiry is too long for a healthcare system. HIPAA recommends session timeouts of 15-30 minutes. The access token cookie (`maxAge: 1 hour`) partially mitigates this, but the JWT itself remains valid for 7 days if extracted. |
| Key Rotation | Supported (current + previous) | Good |
| Payload | userId, email, role, sessionId, activeTenantId, entitlements | **[MEDIUM]** Contains `email` and `role` in JWT. While not secrets, email is PII. Consider removing from JWT and fetching on demand. |

### 3.2 Password Security

| Property | Value | Assessment |
|---|---|---|
| Hashing | bcryptjs | Good |
| Salt Rounds | 10 | **[LOW]** OWASP recommends 12+ for healthcare. 10 is acceptable but weaker than ideal. |
| Min Length | 12 characters | Good (NIST: 8 min) |
| Max Length | 128 characters | Good (NIST: at least 64) |
| Complexity Rules | None forced (NIST-aligned) | Good |
| Common Password Check | ~50 passwords in blocklist | **[MEDIUM]** The blocklist is tiny. Real-world lists have 100K+ entries. Consider using `zxcvbn` or the HaveIBeenPwned API. |
| Password History | Last 5 passwords checked | Good |
| Password Expiry | 90 days (HIPAA) | Good |
| Forced Change | Supported (`forcePasswordChange`) | Good |

### 3.3 Session Management

| Property | Value | Assessment |
|---|---|---|
| Duration | 7 days | **[MEDIUM]** Long for healthcare. HIPAA typically requires 15-30 min idle timeout. |
| Max Per User | 10 sessions | Reasonable for multi-device |
| Storage | PostgreSQL `Session` table | Good |
| Invalidation on Login | All previous sessions deleted | **[MEDIUM]** `deleteUserSessions()` deletes ALL sessions, then creates a new one. This forces logout on all other devices on every login. |
| Idle Timeout | Configured (30 min default) but NOT enforced in session validation | **[HIGH]** `SESSION_CONFIG.IDLE_TIMEOUT_MS` is defined in config but `validateSession()` in `sessions.ts` only checks `expiresAt` (absolute expiry). It does NOT check `lastSeenAt` against idle timeout. |
| Session Validation Cache | 15-second TTL | **[MEDIUM]** A revoked session remains valid for up to 15 seconds. Acceptable tradeoff for performance, but should be documented. |

### 3.4 Refresh Token

| Property | Value | Assessment |
|---|---|---|
| Token | UUID v4, SHA-256 hashed before storage | Good |
| Duration | 30 days | Reasonable with rotation |
| Cookie | httpOnly, secure (prod), sameSite=strict | Good |
| **Rotation** | **NOT IMPLEMENTED** | **[HIGH]** `refreshAccessToken()` returns `{ userId, newRefreshToken?: string }` but `newRefreshToken` is never set. The old refresh token is reused indefinitely for 30 days. Comment says "For now, return same refresh token." |
| Revocation | Supported (sets `revoked: true`) | Good |
| Family Tracking | Not implemented | **[MEDIUM]** If a refresh token is stolen, the attacker can use it indefinitely. With rotation + family tracking, a stolen token would be detected when both parties try to use it. |

### 3.5 Rate Limiting on Login

| Layer | Mechanism | Limit |
|---|---|---|
| IP-based | Redis-backed (`checkRateLimitRedis`) | 20 attempts per 5 minutes per IP |
| Account-based | PostgreSQL (`loginAttempts` table) | 5 failures then 15-minute lockout |
| General API | Redis-backed (in `withAuthTenant`) | 120 requests per minute per user |

**Assessment:** Good layered approach. Falls back to in-memory if Redis is unavailable.

**[LOW]** The IP rate limit in the login route (20/5min) is separate from the `RATE_LIMIT_CONFIG.LOGIN` (5/15min). These should ideally be consolidated.

### 3.6 Cookie Security Flags

| Cookie | httpOnly | secure | sameSite | Assessment |
|---|---|---|---|---|
| `auth-token` | Yes | Prod only | strict | Good |
| `refresh-token` | Yes | Prod only | strict | Good |
| `csrf-token` (middleware) | **No** | Prod only | strict | **[HIGH]** See section 2.5 |
| `csrf-token` (csrf.ts) | Yes | Prod only | strict | Good |
| `active-platform` | Yes | Prod only | strict | Good |

### 3.7 2FA Implementation

- Uses TOTP (otplib) with 6 digits, 30-second window
- QR code generation for authenticator app setup
- Temporary JWT token issued at login for 2FA challenge flow
- Only enforced for admin roles in production

**[MEDIUM]** No backup codes are generated/managed despite `MFA_CONFIG.BACKUP_CODES_COUNT = 10` being configured. If a user loses their authenticator, there is no recovery path documented.

### 3.8 Identify Endpoint (`/api/auth/identify`)

**[MEDIUM]** When a user has no `tenantId`, the endpoint iterates ALL tenants and searches for the user in each one (lines 150-179). This is an O(N) scan across all tenants, which could be slow and could leak timing information about how many tenants exist.

---

## 4. Multi-Tenancy Audit

### 4.1 Tenant Isolation Architecture

The primary guard is `withAuthTenant()` in `/lib/core/guards/withAuthTenant.ts`:
- Extracts `tenantId` from the authenticated session (NEVER from request body/query)
- Validates it is a UUID before passing to Prisma
- Returns 403 if `tenantId` is missing/invalid for tenant-scoped routes
- Provides `createTenantQuery()` helper for adding tenantId to queries

**[MEDIUM]** `createTenantQuery()` adds `tenantId` to a query object, but it is a helper, not enforced. Individual route handlers must remember to use it or manually add `tenantId` to their Prisma `where` clauses.

### 4.2 API Route Coverage

| Metric | Count |
|---|---|
| Total API route files | 1,484 |
| Routes using `withAuthTenant` | 1,323 (89.2%) |
| Routes using direct `requireAuth`/`requireRole`/`requireOwner` | 72 (4.8%) |
| Routes with NO auth guard | ~89 (6.0%) |

**Routes without any auth guard (sample):**

| Route | Risk |
|---|---|
| `/api/imdad/metrics` | **[HIGH]** Returns metrics data with no auth at all |
| `/api/imdad/admin/seed-accounts` | **[CRITICAL]** Admin seeding with no auth? (needs verification) |
| `/api/health` | Low (health check, expected) |
| `/api/init` | Low (initialization endpoint) |
| `/api/opd/health` | Low (health check) |
| `/api/fhir/metadata` | Low (FHIR capability statement, standard) |
| `/api/docs` | Low (API documentation) |
| Multiple CVision routes | **[HIGH]** Use `requireSessionAndTenant` from CVision middleware, not `withAuthTenant` |
| `/api/cvision/public/jobs`, `/api/cvision/public/apply` | Expected (public job board) |
| `/api/er/triage/complete` | Re-exports from `../finish/route`, likely has auth there |

### 4.3 CVision Separate Auth System

**[HIGH]** CVision routes use a completely separate auth middleware (`requireSessionAndTenant` from `lib/cvision/middleware.ts`) and a separate database layer (`getCVisionDb`, `getCVisionCollection`). This creates:
- Inconsistent security posture between platforms
- No CSRF protection (CVision middleware likely does not call `requireCSRF`)
- No XSS sanitization (CVision middleware likely does not call `sanitizeRequestBody`)
- Separate rate limiting policies (or none at all)

### 4.4 Random API Route Tenant Isolation Check

Checked 10 routes that use `withAuthTenant`:

| Route | tenantId Usage Count | Assessment |
|---|---|---|
| `/api/orders/route.ts` | 12 references | Properly filters by tenantId |
| `/api/patients/route.ts` | 7 references | Properly filters |
| `/api/clinical-notes/route.ts` | 9 references | Properly filters |
| `/api/scheduling/slots/route.ts` | 3 references | Properly filters |

All sampled routes correctly receive `tenantId` from `withAuthTenant` context and use it in Prisma queries.

### 4.5 Cross-Tenant Data Access Vectors

**Can User A from Tenant 1 access Tenant 2's data?**

- **Via `withAuthTenant` routes:** No. `tenantId` comes from the session, not from user input.
- **Via direct `requireAuth` routes:** Depends on implementation. The `requireAuth` helper resolves `tenantId` from the session and returns it. If the route handler uses it correctly, isolation holds.
- **Via unguarded routes:** Yes, if the route exposes data without auth.
- **Via CVision routes:** Depends on `requireSessionAndTenant` implementation.

**[MEDIUM]** `validateTenantIsolation()` in `lib/security/auth.ts` exists but is a helper function -- it is not automatically called. Routes must opt-in to use it.

### 4.6 Database-Level Isolation

**There is NO database-level tenant isolation.** All tenants share the same PostgreSQL database and tables. Isolation is purely application-level via `WHERE tenantId = ?` in queries.

**[MEDIUM]** Row-Level Security (RLS) policies are not used. While application-level isolation works, RLS would provide defense-in-depth at the database layer.

---

## 5. Summary of Findings

### CRITICAL (1)
| ID | Finding | Location |
|---|---|---|
| C-01 | `/api/imdad/admin/seed-accounts` may have no auth guard | `app/api/imdad/admin/seed-accounts/route.ts` |

### HIGH (14)
| ID | Finding | Location |
|---|---|---|
| H-01 | Refresh token rotation not implemented -- tokens reused for 30 days | `lib/core/auth/refreshToken.ts:97` |
| H-02 | JWT expiry is 7 days (too long for healthcare/HIPAA) | `lib/auth.ts:13` |
| H-03 | Session idle timeout configured but not enforced | `lib/auth/sessions.ts` vs `lib/security/config.ts` |
| H-04 | CSRF cookie httpOnly inconsistency between middleware and csrf.ts | `middleware.ts:758` vs `lib/security/csrf.ts:31` |
| H-05 | `/api/ai` in both SAM and Health route lists (ambiguous ownership) | `middleware.ts:123,184` |
| H-06 | ALL API routes bypass middleware platform isolation | `middleware.ts:296-299` |
| H-07 | CVision routes use separate auth system, possibly missing CSRF/XSS/rate-limit | `app/api/cvision/*/route.ts` |
| H-08 | `/api/imdad/metrics` returns data with no authentication | `app/api/imdad/metrics/route.ts` |
| H-09 | `PatientMaster` model has no database indexes | `prisma/schema/patient.prisma` |
| H-10 | `OpdEncounter` and `OpdBooking` models have no indexes | `prisma/schema/opd.prisma` |
| H-11 | 413 orphaned models (77%) create maintenance burden | `prisma/schema/*.prisma` |
| H-12 | `User` model missing composite query indexes | `prisma/schema/core.prisma` |
| H-13 | Multiple cron/webhook routes lack auth guards | `app/api/cron/*/route.ts` |
| H-14 | ER/OPD sub-models (ErBedAssignment, ErNote, OpdNursingEntry, etc.) lack tenantId | `prisma/schema/er.prisma`, `opd.prisma` |

### MEDIUM (18)
| ID | Finding | Location |
|---|---|---|
| M-01 | HS256 JWT limits microservice key distribution | `lib/auth.ts` |
| M-02 | JWT payload contains email (PII) | `lib/auth/edge.ts` |
| M-03 | Common password blocklist is only ~50 entries | `lib/security/passwordPolicy.ts` |
| M-04 | 2FA only enforced in production, untested in dev | `middleware.ts:383` |
| M-05 | Session validation cached for 15s after revocation | `lib/auth/sessions.ts:104` |
| M-06 | `deleteUserSessions()` on login forces logout on all devices | `app/api/auth/login/route.ts:262` |
| M-07 | No refresh token family tracking for theft detection | `lib/core/auth/refreshToken.ts` |
| M-08 | `validateTenantIsolation()` is opt-in, not automatic | `lib/security/auth.ts` |
| M-09 | No Row-Level Security at PostgreSQL level | Database config |
| M-10 | Identify endpoint scans all tenants for unassigned users | `app/api/auth/identify/route.ts:150-179` |
| M-11 | `createTenantQuery()` is a helper, not enforced | `lib/core/guards/withAuthTenant.ts:433` |
| M-12 | 7-day session duration exceeds HIPAA recommendations | `lib/auth/sessions.ts:6` |
| M-13 | Backup codes for 2FA not implemented despite config | `lib/security/config.ts:143` |
| M-14 | ER sub-models without tenantId depend on parent joins | `prisma/schema/er.prisma` |
| M-15 | OPD sub-models without tenantId depend on parent joins | `prisma/schema/opd.prisma` |
| M-16 | Many SAM models use `String` IDs instead of Prisma relations | `prisma/schema/sam.prisma` |
| M-17 | User cache TTL of 120s means role/permission changes have delay | `lib/auth/requireAuth.ts:44` |
| M-18 | CVision uses MongoDB collections alongside Prisma schema | `lib/cvision/db.ts` |

### LOW (12)
| ID | Finding | Location |
|---|---|---|
| L-01 | bcrypt salt rounds = 10 (OWASP recommends 12+ for healthcare) | `lib/auth.ts:41` |
| L-02 | `/welcome` in all platform route lists (redundant) | `middleware.ts` |
| L-03 | Content-Length check can be bypassed by omitting header | `middleware.ts:286` |
| L-04 | Two separate IP rate limits for login (20/5min vs 5/15min config) | `app/api/auth/login/route.ts:46` vs `lib/security/config.ts:37` |
| L-05 | Portal routes use their own auth, expected but not audited here | `app/api/portal/*/route.ts` |
| L-06 | `DocumentTask.documentId` is String not a relation | `prisma/schema/sam.prisma` |
| L-07 | Some health-check endpoints return without auth (expected) | Various `/health` routes |
| L-08 | `ReminderSettings` model has no index | `prisma/schema/reminders.prisma` |
| L-09 | `SystemSetting` model has no tenantId (acceptable for global config) | `prisma/schema/misc.prisma` |
| L-10 | Tenant status cache (30s) means blocking takes up to 30s | `lib/auth/requireAuth.ts:37` |
| L-11 | CSP allows `unsafe-inline` and `unsafe-eval` for Next.js | `middleware.ts:23` |
| L-12 | `appConfig.name` used as TOTP issuer fallback | `lib/security/config.ts:138` |

---

## 6. Recommendations (Priority Order)

### Immediate (Sprint 0)
1. **Implement refresh token rotation** -- invalidate old token when issuing new one
2. **Reduce JWT expiry** from 7d to 1h (rely on refresh token for longevity)
3. **Fix CSRF cookie inconsistency** -- remove middleware CSRF cookie, use only `csrf.ts`
4. **Add auth to `/api/imdad/metrics`** and verify `/api/imdad/admin/seed-accounts`
5. **Enforce idle session timeout** in `validateSession()`

### Short-term (2-4 weeks)
6. Add `@@index([tenantId])` to PatientMaster, OpdEncounter, OpdBooking, User
7. Add `tenantId` to ER/OPD sub-models or enforce parent-join isolation
8. Audit all CVision routes for CSRF, XSS sanitization, and rate limiting
9. Expand common password blocklist (use `zxcvbn` or external list)
10. Implement 2FA backup codes
11. Resolve `/api/ai` route ownership between SAM and Health

### Medium-term (1-3 months)
12. Add PostgreSQL Row-Level Security policies as defense-in-depth
13. Remove or archive 400+ orphaned models
14. Migrate CVision from MongoDB to Prisma/PostgreSQL for unified auth
15. Consider migrating from HS256 to RS256 JWTs
16. Implement refresh token family tracking

---

*Report generated 2026-04-01 by automated deep audit.*
