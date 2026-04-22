# AUDIT PHASE 2 -- Bug Hunting Report

**Date:** 2026-04-01
**Auditor:** Claude Opus 4.6 (Senior QA Engineer)
**Scope:** Full codebase -- EHR, CVision (HR), SAM (Governance), Imdad (Supply Chain)
**Files Examined:** 168 Imdad API routes, 95 Imdad dashboard pages, 232 CVision API routes, 59 billing routes, middleware.ts, lib/entitlements.ts, lib/auth/*

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 5 |
| HIGH | 12 |
| MEDIUM | 10 |
| LOW | 5 |
| **TOTAL** | **32** |

---

## Bug Table

| # | Platform | Severity | File(s) | Description | Expected | Actual | Fix |
|---|----------|----------|---------|-------------|----------|--------|-----|
| 1 | Imdad | **CRITICAL** | `prisma/schema/` (missing) | **No Prisma schema files exist for any Imdad models.** All 168 Imdad API routes reference `prisma.imdadInvoice`, `prisma.imdadItemMaster`, `prisma.imdadPurchaseOrder`, `prisma.imdadDecision`, etc. -- approximately 50+ model names. Zero of these models exist in any `.prisma` file under `prisma/schema/`. The generated Prisma client has zero Imdad references. | Imdad models (ImdadInvoice, ImdadItemMaster, ImdadPurchaseOrder, ImdadVendor, ImdadAsset, ImdadDecision, ImdadApprovalRequest, etc.) should be defined in `prisma/schema/imdad.prisma` | Models do not exist. All Imdad API calls will throw runtime errors like `prisma.imdadInvoice is not a function` | Create `prisma/schema/imdad.prisma` with all ~50+ Imdad models, run `prisma generate` and `prisma migrate` |
| 2 | Imdad | **CRITICAL** | `app/(dashboard)/imdad/` (30 components) | **30 imported components do not exist.** Pages import from `@/components/imdad/command-center/`, `@/components/imdad/war-room/`, `@/components/imdad/assets/`, `@/components/imdad/warehouse/`, `@/components/imdad/clinical/`, `@/components/imdad/inventory/`, `@/components/imdad/drawers/`, `@/components/imdad/procurement/`, `@/components/imdad/quality/` -- none of these directories/files exist. Only 3 components exist: `IdentityBar.tsx`, `ImdadSidebar.tsx`, `GlobalSearch.tsx`. | All 30 imported components should exist | `components/imdad/` has only 3 files. Build will fail for 11+ pages: command-center, war-room, inventory/items, procurement/vendors, procurement/purchase-orders, warehouse/warehouses, warehouse/receiving, assets/register, clinical/formulary, quality/inspections, my-operations | Create all 30 missing components |
| 3 | Imdad | **CRITICAL** | `app/api/imdad/admin/seed-accounts/route.ts` | **Unauthenticated seed endpoint creates users with hardcoded password `123456`.** No `withAuthTenant` wrapper. Anyone can POST to `/api/imdad/admin/seed-accounts` to create 20 accounts with known credentials. The response body also leaks the password: `password: '123456 (same for all)'`. | Endpoint should require authentication and admin role | Endpoint is completely unprotected. Attackers can create accounts with known passwords | Wrap with `withAuthTenant` + require admin role; remove password from response; use secure random passwords |
| 4 | CVision | **CRITICAL** | `app/api/cvision/attendance/biometric/route.ts` | **Unauthenticated biometric endpoint with insecure device auth.** No `withAuthTenant` wrapper. Device auth parses API key format `tenant_<tenantId>_<secret>` but accepts ANY value where `parts.length >= 2`. Also falls back to `body.tenantId` -- any caller can specify any tenant. API key returned in plaintext on device registration. | Endpoint should use proper authentication, validate API keys against DB | Auth is trivially bypassable; tenantId can be spoofed via request body; API keys stored and returned in plaintext | Add proper auth; validate API keys against stored (hashed) values; hash API keys in DB |
| 5 | Imdad | **CRITICAL** | `app/api/imdad/simulation/status/route.ts:28` | **Hardcoded tenantId** `dfc612cb-25fc-4036-9194-3ab0b0b867a3` in `getLiveCounts()`. The `GET` handler uses `withAuthTenant` which provides `tenantId`, but `getLiveCounts()` ignores it and queries a hardcoded tenant. | Should use the authenticated user's tenantId | Always queries a single hardcoded tenant, breaking multi-tenancy | Pass `tenantId` from the handler to `getLiveCounts()` |
| 6 | Imdad | **HIGH** | `app/api/imdad/financial/invoices/route.ts:131-138` | **Invoice number race condition.** Generates `internalNumber` via `count() + 1`. Under concurrent requests, two invoices can get the same number since `count()` is not atomic with `create()`. | Sequence numbers should be generated atomically | Duplicate invoice numbers under concurrent creation | Use `imdadSequenceCounter.upsert` with `{ increment: 1 }` as the single source (it's already called but after the number is generated); or use `$transaction` with serializable isolation |
| 7 | Imdad | **HIGH** | `app/api/imdad/financial/invoices/[id]/route.ts:246` | **Possible NaN in match tolerance.** Reads `existing.matchTolerancePct` but this field is not in the create schema and may be null/undefined. `Number(null) = 0` so tolerance would be 0, making most matches fail as `DISPUTED`. | Should have a default tolerance value (e.g., 5%) | If `matchTolerancePct` is null, tolerance = 0, and any non-zero variance causes DISPUTED status | Default to a sensible tolerance: `Number(existing.matchTolerancePct ?? 5)` |
| 8 | Imdad | **HIGH** | `app/api/imdad/approval/submit/route.ts:107-117` | **Production console.log statements.** 5 `console.log()` calls with `[Approval]` prefix leak internal workflow details (rule IDs, amounts, step counts) to server logs in production. | Use structured logger (`logger.debug`) with log levels | `console.log` in production leaks operational data and cannot be filtered | Replace with `logger.debug()` calls |
| 9 | Imdad | **HIGH** | `app/api/imdad/` (40+ files) | **Excessive `any` type usage.** Over 40 files use `: any` for query `where` clauses, loop variables, error catches, and data objects. This bypasses TypeScript safety and masks potential type mismatches. | Use properly typed interfaces or Prisma-generated types | Type safety is bypassed; potential runtime errors from incorrect field names, wrong types | Define typed interfaces for query filters; use Prisma types for data objects |
| 10 | Imdad | **HIGH** | `app/api/imdad/bulk/update-prices/route.ts:72`, `app/api/imdad/bulk/stock-adjustment/route.ts:81` | **N+1 query pattern in bulk operations.** Both bulk routes pre-fetch items correctly but then issue individual `prisma.update()` + `imdadAudit.log()` calls inside a `for` loop. For 500 price updates, this creates 1000 sequential DB calls. | Use `prisma.$transaction` with batch updates or `updateMany` | Sequential DB calls cause O(n) latency; 500-item batch = ~1000 DB round trips | Batch updates with `$transaction` or use `updateMany` where possible |
| 11 | Imdad | **HIGH** | `app/api/imdad/decisions/autonomous/feedback/route.ts:56-77` | **Nested N+1 query pattern.** For each completed decision, loops through signal IDs calling `findFirst` + `update` individually. With 200 decisions each having multiple signals, this creates hundreds of sequential DB calls. | Batch signal resolution with `updateMany` | Sequential DB calls per signal per decision | Use `prisma.imdadOperationalSignal.updateMany({ where: { id: { in: allSignalIds } } })` |
| 12 | Imdad | **HIGH** | `app/api/imdad/admin/seed-accounts/route.ts:71-123` | **N+1 query pattern in seed route.** For each of 20 accounts: `findFirst` + `update` or `create` = 40 sequential DB calls minimum. | Should batch-create or use `createMany` | 40+ sequential queries for a seed operation | Use `prisma.$transaction` with `createMany` or upsert pattern |
| 13 | Imdad | **HIGH** | Multiple `[id]/route.ts` files (quality/vendor-audits, quality/recalls, quality/certificates, quality/inspections, quality/ncr, procurement/vendors, etc.) | **Fragile ID extraction via `pathname.split('/').pop()!`.** Next.js 14 provides route params as the third argument to handlers. Using `pathname.split('/').pop()!` is fragile and can break if query params or trailing slashes are present. Additionally, the non-null assertion `!` suppresses potential `undefined`. | Use Next.js params: `const { id } = (await params) as { id: string }` | `pop()!` can return wrong segment or undefined; inconsistent with other routes that use params correctly | Use the `params` argument pattern consistently |
| 14 | Imdad | **HIGH** | `app/api/imdad/governance/access-requests/route.ts:30-31,47` | **Unsafe `prisma as any` casts.** Uses `(prisma as any).imdadAccessRequest` in 3 places and accesses `(user as any)?.nameEn`. This likely means the `ImdadAccessRequest` model doesn't exist in Prisma types (see Bug #1). | Should use properly typed Prisma models | Bypasses type checking; will fail at runtime if model doesn't exist | Create proper Prisma model; remove `as any` casts |
| 15 | Imdad | **HIGH** | `app/api/imdad/metrics/route.ts` | **Unauthenticated metrics endpoint.** No `withAuthTenant` wrapper. Exposes internal system metrics to anyone at `/api/imdad/metrics`. | Should require authentication | Unauthenticated access to system metrics | Wrap with `withAuthTenant` |
| 16 | Imdad | **HIGH** | `app/api/imdad/simulation/status/route.ts:41-53` | **SQL injection risk with `$queryRawUnsafe`.** Table names from the `tables` array are interpolated directly into SQL queries. While the array is currently hardcoded (safe), using `$queryRawUnsafe` with string interpolation is an anti-pattern -- any future change to make table names dynamic would introduce SQL injection. | Use `$queryRaw` with tagged template literals | `$queryRawUnsafe` used with string interpolation for table names | Replace with `$queryRaw` using template literals, or use Prisma model queries |
| 17 | Imdad | **HIGH** | `app/api/imdad/search/route.ts:54` | **SQL injection risk in search.** Uses `$queryRawUnsafe` with `LIMIT ${LIM}` where `LIM` is derived from a constant. While currently safe (constant is 10), the pattern of using `$queryRawUnsafe` with template literal interpolation is fragile. The `tenantId` and `pattern` ARE properly parameterized as `$1` and `$2`, but `LIMIT` is not. | Use `$queryRaw` tagged templates or parameterize LIMIT | LIMIT value is inlined via template literal in `$queryRawUnsafe` | Use parameterized `$queryRaw` or convert LIMIT to a parameter |
| 18 | EHR | **MEDIUM** | `app/api/billing/charge-events/route.ts`, `app/api/billing/payments/route.ts`, `app/api/billing/medication-catalog/route.ts` | **Inconsistent billing route patterns.** Some billing routes import `v4 as uuidv4` for ID generation while others use `randomUUID` from crypto. Some wrap with `withErrorHandler`, others don't. This inconsistency can lead to different error response formats. | Consistent use of UUID generation and error handling | Mixed patterns across billing routes | Standardize on `crypto.randomUUID()` and `withErrorHandler` wrapper |
| 19 | All | **MEDIUM** | `middleware.ts:296-299` | **Middleware skips ALL API route enforcement.** All API routes (line 296-299) get a `NextResponse.next()` with only security headers. No platform isolation, no entitlement checks, no RBAC for API routes in middleware. This means API routes must self-enforce via `withAuthTenant`. Any route that forgets `withAuthTenant` is completely unprotected. | Middleware should enforce at minimum auth on API routes | Complete reliance on individual route handlers for auth enforcement; any missing `withAuthTenant` = open endpoint | Add auth check for API routes in middleware, or add a lint rule to detect routes without `withAuthTenant` |
| 20 | Imdad | **MEDIUM** | `app/(dashboard)/imdad/page.tsx` | **Missing `useLang` in client component with hardcoded text.** The root page has `'use client'` but does not import `useLang`. Contains hardcoded text "IMDAD" and Arabic character. Per CLAUDE.md, every user-visible string must be bilingual. | All text should use `tr()` pattern | Hardcoded "IMDAD" text and Arabic character without bilingual support | Import `useLang`, use `tr()` for visible text |
| 21 | Imdad | **MEDIUM** | `app/api/imdad/` (14+ files) | **Silent error swallowing with empty `catch {}`.** Multiple routes use `catch {}` or `catch { }` which silently swallows errors. This makes debugging impossible when things fail. Seen in: `quality/ncr`, `admin/config`, `admin/roles`, `decisions/autonomous/feedback`, `bulk/update-prices`, `bulk/approve-pos`, `bulk/stock-adjustment`. | Errors should be logged even if the operation is best-effort | Errors are completely hidden; failures are invisible | Add `catch (err) { logger.warn('...', { error: err }); }` |
| 22 | CVision | **MEDIUM** | `app/api/cvision/attendance/biometric/route.ts:322-324` | **API key stored in plaintext.** Device registration stores API key without hashing and returns it in the response. Comment says "Store hashed in production" but no hashing is implemented. | API keys should be hashed before storage (like passwords) | Plaintext storage of API keys in database | Hash API key before storing; only return key once at creation |
| 23 | CVision | **MEDIUM** | `app/api/cvision/attendance/biometric/route.ts:370-387` | **Recursive-like function call bug.** `handleLogSync` calls `handlePunch(request, ...)` for each log entry, but `handlePunch` expects a `NextRequest` and body. The `request` object is the original request -- it won't have the individual log's body. The function passes `{...log, tenantId, deviceSerial}` as the second arg, but `handlePunch` reads `body` from its second parameter, not from `req.json()`. This works accidentally because `handlePunch` destructures its `body` parameter, but it re-authenticates the device for each entry. | Bulk sync should process entries directly without re-calling the handler | Re-authenticates device for each of potentially hundreds of log entries; wastes compute | Extract punch processing logic into a shared helper function |
| 24 | Imdad | **MEDIUM** | `app/api/imdad/financial/invoices/[id]/route.ts:109-111` | **Tax recalculation ignores existing line-level taxes.** When updating an invoice, tax is recalculated as `subtotal * (taxRate / 100)`, ignoring any line-level tax amounts that were set during creation. The create route uses line-level taxes if present (`lineTaxTotal > 0`), but the update route always uses the flat rate. | Tax calculation should be consistent between create and update | Update always uses flat-rate tax, potentially overriding per-line tax amounts | Re-fetch lines and recalculate consistently with the create logic |
| 25 | Imdad | **MEDIUM** | `app/api/imdad/financial/invoices/[id]/route.ts:276` | **Missing optimistic locking on PATCH.** The update uses `prisma.imdadInvoice.update({ where: { id } })` without including `version` in the where clause, despite validating `version` earlier. The PUT handler correctly uses `where: { id, version: existing.version }`, but PATCH does not. | PATCH should use `where: { id, version: existing.version }` for consistency | Version is validated but not enforced in the DB query; concurrent PATCH requests can overwrite each other | Add `version` to the `where` clause in PATCH |
| 26 | Imdad | **MEDIUM** | `app/api/imdad/financial/invoices/[id]/route.ts:281-292` | **Wrong audit action for status transitions.** The audit log always uses `action: 'APPROVE'` regardless of the actual action (verify, match, approve, or pay). | Audit action should match the actual transition | Audit trail shows 'APPROVE' for verify/match/pay transitions, corrupting the audit log | Use `action` from the parsed body instead of hardcoding 'APPROVE' |
| 27 | Imdad | **MEDIUM** | `app/api/imdad/assets/query/route.ts:24` | **Unbounded query with in-memory aggregation.** Fetches up to 500 assets then does in-memory grouping. For large datasets, this misses items beyond 500 and the aggregations are inaccurate. | Use DB-level aggregation (GROUP BY) for accurate counts/sums | Aggregations are based on at most 500 items; total counts may be wrong | Use Prisma `groupBy` or raw SQL `GROUP BY` for aggregations |
| 28 | All | **LOW** | `app/api/imdad/` (20+ files), `app/api/cvision/` (10+ files) | **Console.log/console.error in production routes.** Over 30 instances of `console.error` and `console.log` in API routes instead of using the structured logger. This pollutes server logs and doesn't integrate with log aggregation. | Use `logger.error()` / `logger.warn()` / `logger.debug()` | Unstructured console output in production | Replace all `console.*` with structured logger calls |
| 29 | Imdad | **LOW** | `app/(dashboard)/imdad/` (10+ pages) | **Missing loading states.** Multiple pages (command-center, bulk/stock-adjustment, trace, inbox, financial, quality, my-work, network, admin) fetch data but don't show loading skeletons or spinners during fetch. | Pages should show loading state while data loads | Users see empty/broken UI during data fetch | Add loading skeletons or Suspense boundaries |
| 30 | Imdad | **LOW** | `app/api/imdad/inventory/stock-counts/route.ts:73` | **Missing try/catch around `req.json()`.** The POST handler calls `await req.json()` without try/catch. If the request body is malformed JSON, this throws an unhandled error resulting in a 500. Other routes correctly wrap this in try/catch. | Should catch JSON parse errors and return 400 | Malformed JSON body causes 500 instead of 400 | Wrap `req.json()` in try/catch |
| 31 | Imdad | **LOW** | `app/api/imdad/inventory/stock-counts/route.ts:93-104` | **Using `as any` to bypass Prisma types.** Both the `data` object and the `status` field are cast to `any`. This is a symptom of Bug #1 (missing schema) but also masks type errors in the data structure. | Use properly typed Prisma inputs | Type errors are hidden; wrong field names won't be caught | Fix after creating Prisma schema (Bug #1) |
| 32 | Imdad | **LOW** | `lib/entitlements.ts:46-51` | **Inconsistent entitlement defaults.** When computing intersection, `sam` and `health` default to `true` (`?? true`) but `edrac`, `cvision`, and `imdad` default to `false` (`?? false`). This means if a user has `platformAccess` defined but `sam` is unset, they get SAM access by default, but if `imdad` is unset, they don't get Imdad access. | Consistent defaults or explicit documentation of the asymmetry | SAM/health have permissive defaults; CVision/Imdad have restrictive defaults. This can cause confusing access issues. | Document the intentional asymmetry or make all defaults consistent |

---

## Affected Pages (Broken Due to Missing Components)

The following 11 Imdad dashboard pages will fail to render due to missing component imports (Bug #2):

1. `app/(dashboard)/imdad/command-center/page.tsx` -- 7 missing components
2. `app/(dashboard)/imdad/war-room/page.tsx` -- 4 missing components
3. `app/(dashboard)/imdad/inventory/items/page.tsx` -- 2 missing components
4. `app/(dashboard)/imdad/procurement/vendors/page.tsx` -- 2 missing components
5. `app/(dashboard)/imdad/procurement/purchase-orders/page.tsx` -- 2 missing components
6. `app/(dashboard)/imdad/warehouse/warehouses/page.tsx` -- 2 missing components
7. `app/(dashboard)/imdad/warehouse/receiving/page.tsx` -- 2 missing components
8. `app/(dashboard)/imdad/assets/register/page.tsx` -- 2 missing components
9. `app/(dashboard)/imdad/clinical/formulary/page.tsx` -- 2 missing components
10. `app/(dashboard)/imdad/quality/inspections/page.tsx` -- 2 missing components
11. `app/(dashboard)/imdad/my-operations/page.tsx` -- 3 missing components

---

## Missing Imdad Prisma Models (Bug #1 Detail)

Models referenced in API routes that do not exist in any schema file:

- ImdadInvoice, ImdadInvoiceLine, ImdadInvoicePayment
- ImdadItemMaster, ImdadItemLocation
- ImdadPurchaseOrder, ImdadPurchaseOrderLine
- ImdadPurchaseRequisition, ImdadPurchaseRequisitionLine
- ImdadVendor, ImdadVendorScorecard
- ImdadAsset, ImdadAssetMaintenance, ImdadAssetTransfer, ImdadAssetDisposal
- ImdadDecision, ImdadDecisionAction, ImdadOperationalSignal
- ImdadApprovalRequest, ImdadApprovalStep, ImdadApprovalWorkflowTemplate, ImdadApprovalWorkflowRule, ImdadApprovalWorkflowRuleStep
- ImdadInventoryLocation, ImdadInventoryAdjustment, ImdadInventoryTransaction, ImdadStockCount, ImdadBatchLot
- ImdadWarehouse, ImdadWarehouseZone, ImdadWarehouseBin, ImdadWarehouseTransfer, ImdadWarehousePutAway, ImdadWarehousePickList, ImdadReplenishmentRule, ImdadTemperatureLog
- ImdadGoodsReceivingNote, ImdadGoodsReceivingNoteLine, ImdadContract
- ImdadBudget, ImdadBudgetProposal, ImdadAnnualBudgetPlan, ImdadPhasedInvestment, ImdadBenchmark, ImdadDeviceIntelligence
- ImdadOrganization, ImdadDepartment, ImdadRoleDefinition, ImdadSystemConfig
- ImdadNotification, ImdadAuditLog, ImdadEventBusMessage, ImdadJobExecution
- ImdadAlertRule, ImdadAlertInstance, ImdadKpiSnapshot, ImdadDashboard, ImdadReport, ImdadReportExecution
- ImdadQualityInspection, ImdadInspectionTemplate, ImdadNonConformanceReport, ImdadQualityCertificate, ImdadQualityRecall, ImdadVendorAudit
- ImdadSfdaIntegrationLog, ImdadWebhook, ImdadWebhookDelivery
- ImdadSequenceCounter, ImdadPayment, ImdadCharge, ImdadCostCenter
- ImdadFormularyItem, ImdadClinicalDispensing, ImdadClinicalReturn, ImdadClinicalCharge, ImdadClinicalConsumption, ImdadWardParLevel
- ImdadAccessRequest

Total: ~60+ models missing

---

## Priority Remediation Order

1. **Bug #1** -- Create Imdad Prisma schema (blocks all Imdad functionality)
2. **Bug #2** -- Create 30 missing Imdad UI components (blocks 11 pages)
3. **Bug #3** -- Secure seed-accounts endpoint (security vulnerability)
4. **Bug #4** -- Secure biometric endpoint (security vulnerability)
5. **Bug #5** -- Fix hardcoded tenantId (data isolation violation)
6. **Bug #15** -- Secure metrics endpoint (information disclosure)
7. **Bugs #6, #25** -- Fix race conditions (data integrity)
8. **Bug #26** -- Fix audit logging (compliance)
9. **Bugs #10, #11, #12** -- Fix N+1 patterns (performance)
10. Remaining bugs by severity

---

*Generated by Phase 2 Bug Hunting Audit*
