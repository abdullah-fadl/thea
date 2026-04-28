# Stage B — CVision Mongo → Postgres Migration Plan

**Status:** Planning. No code changes, no DB writes.
**Branch:** `phase-8-6-ops-readiness` (verified against worktree of `claude/laughing-volhard-e9cbb0`).
**Date:** 2026-04-27.

---

## TL;DR — the migration is ~95% already done

The original framing — *"121 Prisma models defined but 246 routes still talk to MongoDB, this fiction must end"* — is **incorrect**. The fiction is the inverse: 246 routes look Mongo-shaped at the call site (`db.collection('x').findOne(...)`), but every one of them now executes Prisma queries against Postgres via a translation shim that landed on **2026-04-22**, five days ago.

The remaining real work is small and pre-clinic-shadow-run critical:
1. Audit the shim's correctness on a representative slice of routes (data has never flowed through it under real load).
2. Fix the dead Mongo code path in `offer-portal/[token]/route.ts` that will crash the first time anyone uses it.
3. Spot-check the 24 routes that don't import the shim — most are stateless, but verify.
4. Decide whether to refactor the 221 facade-using routes to native Prisma (cleanup, optional, defer-able).

**Revised effort estimate: 1–3 weeks of verification + fixes**, not 3–4 months. A full Strangler Fig with dual-write/dual-read is unnecessary because there is no parallel Mongo store to write to.

---

## Evidence — what's actually in the code

### The shim exists and is universal
- [lib/cvision/db.ts:11](lib/cvision/db.ts:11) imports `cvisionDb` from [lib/cvision/prisma-db.ts](lib/cvision/prisma-db.ts).
- [lib/cvision/prisma-db.ts:1–10](lib/cvision/prisma-db.ts) is documented as *"Drop-in replacement for the MongoDB-compatible PrismaShim. Provides the same `.collection().find()/.findOne()/.insertOne()` API but backed by Prisma model calls instead of raw SQL."*
- [lib/cvision/prisma-helpers.ts](lib/cvision/prisma-helpers.ts) provides `mongoFilterToPrisma`, `mongoUpdateToPrisma`, `mongoSortToPrisma`, `mongoProjectToPrisma` — the four translators that make `{ tenantId, status: { $in: [...] } }` become a Prisma `where` clause.
- Both files have **zero references** to `MongoClient`, `mongoose`, or `mongodb` driver imports. The shim never opens a Mongo connection.

### Even the legacy Mongo helper is now a Prisma facade
This is the strongest evidence. [lib/db/mongo.ts:11–35](lib/db/mongo.ts:11) — the file that the two "Mongo holdout" routes import — is itself a Prisma shim:

```typescript
export async function getPlatformClient(): Promise<{ client: any; db: PrismaDb }> {
  return { client: null, db: cvisionDb };
}
```

So the offer-portal route's call to `getPlatformClient()` returns `{ client: null, db: <Prisma> }`. Any code that uses `client.db(...)` (which the offer-portal route does on line 66 and 166) will throw `Cannot read property 'db' of null` at runtime.

### Route audit — 246 CVision routes
| Bucket | Count | Behaviour |
|---|---|---|
| Imports `@/lib/cvision/db` (Prisma facade) | **221** | Hits Postgres via the shim. |
| Imports `@/lib/db/mongo` directly | **2** | `training/route.ts` (only for cross-platform user lookup, also shimmed); `offer-portal/[token]/route.ts` (would crash on `null.db()`). |
| Other (stateless / external) | **24** | Mostly AI/ML (chatbot, ranking, parse-cv, parse-pdf), integrations (zatca, gosi, iban), health checks, dev overrides. Likely no DB writes; needs a one-pass spot check. |

### Live database state
Connected via `DATABASE_URL` from `.env.local` (Supabase, ap-northeast-2 pooler).
- **121/121 CVision tables exist** in the live Postgres database.
- **0/121 tables have any rows.** Confirmed via `pg_stat_user_tables.n_live_tup`.

This matches the project state: no production users yet, only the owner account exists. **The shim has never been exercised by real traffic.** That is the critical risk for Stage B, not the data location.

### No Mongo runtime escape hatch
- No `MONGO_URI`, `MONGODB_URL`, `MONGODB_URI`, `USE_MONGO`, or `CVISION_DB_USE_MONGO` env vars set in `.env.local`.
- No `mongoose.connect()` call anywhere in active code (only in 8 historical migration scripts under `scripts/migrations/0[5-6]*.ts` that were one-shot index migrations for the old IPD/clinical stack).
- No conditional branch in [lib/cvision/db.ts](lib/cvision/db.ts) or [lib/cvision/prisma-db.ts](lib/cvision/prisma-db.ts) that routes to MongoDB based on env.
- No CVision-specific feature flag in `lib/core/flags/`.

### Shim correctness — a concrete concern
The shim silently swallows invalid UUID tenantIds:
```typescript
if (hasInvalidUuidTenantId(where)) return PrismaCursor.empty(this._model);
if (hasInvalidUuidTenantId(where)) return null;
```
([lib/cvision/prisma-db.ts](lib/cvision/prisma-db.ts), 3 occurrences). This is defensive but means a bug that passes `tenantId: ""` or `tenantId: undefined` will look like "no rows" instead of erroring. With zero rows in production, every query already returns empty — so this failure mode is invisible today and will only surface once real data is loaded.

---

## Migration state assessment

| Layer | Status |
|---|---|
| Postgres schema (121 tables) | ✅ Live |
| Prisma client wiring | ✅ Live |
| Route → Prisma plumbing (via shim) | ✅ Live |
| Mongo data backfill | N/A — no Mongo data exists |
| Production traffic against new path | ❌ Never tested under load |
| Native Prisma calls in route code | ❌ Still Mongo-shaped facade |
| Dead Mongo code paths | ⚠️ At least 1 (offer-portal) |
| Data parity with Mongo | N/A — no Mongo source of truth |

**Verdict: ~95% complete.** What remains is verification, dead-code cleanup, and (optional) refactoring the facade away.

---

## Why the original Strangler Fig plan does not apply

A Strangler Fig migration assumes:
1. A live Mongo source of truth exists.
2. Writes need to land in both stores during cutover.
3. Reads need a parity check before flipping authority.
4. Per-module flags gate the cutover.

None of these hold for CVision today:
1. There is no live Mongo source of truth — `getPlatformClient().client === null`.
2. There is no Mongo to dual-write to — the shim has no Mongo path.
3. There is nothing to parity-check against.
4. Every route already runs against Postgres.

A Strangler Fig built on these assumptions would generate weeks of dual-write/dual-read scaffolding for code paths that already only have one destination. Worse, it would introduce the very kind of complexity (parallel writes, mismatch logs, flags) that historically *causes* the burns the user wants to avoid.

---

## What Stage B should actually do

### Track 1 — Pre-clinic-shadow-run verification (must finish in ~1 week)

The clinic shadow run is the first time the shim sees real data. The risk is not "Mongo data is in the wrong place" — it's "the Mongo→Prisma translation has a bug that returns wrong results, and zero rows masked it."

**Step 1 — Smoke test the top 10 high-traffic CVision flows.**
Pick the routes most likely to be exercised in the shadow run:
1. `POST /api/cvision/employees` (create employee)
2. `GET /api/cvision/employees` (list with filters, search, pagination)
3. `GET /api/cvision/employees/[id]` (read by id)
4. `PUT /api/cvision/employees/[id]` (update with partial fields)
5. `POST /api/cvision/departments` + `GET` (org tree)
6. `GET /api/cvision/attendance` (date range queries — exercises `$gte`/`$lte` translation)
7. `POST /api/cvision/leaves` + approval workflow
8. `GET /api/cvision/payroll/runs` (aggregate query — exercises `$group`/`$sum` translation)
9. `POST /api/cvision/recruitment/candidates` + status transitions
10. `GET /api/cvision/notifications` (sort + limit, common cursor ops)

For each, run an integration test that creates → reads → updates → soft-deletes → re-reads and confirms invariants. Goal: catch any shim translator bug (filter, update, sort, projection, aggregate) before users do.

**Step 2 — Audit the four shim translators.**
Read [lib/cvision/prisma-helpers.ts](lib/cvision/prisma-helpers.ts) end-to-end with a focus on:
- Filter translation: `$and`, `$or`, `$in`, `$nin`, `$gte`, `$lte`, `$ne`, `$exists`, `$regex`. Confirm each maps to the correct Prisma operator and that nested combinations work.
- Update translation: `$set`, `$unset`, `$inc`, `$push`, `$pull`. Note that `$push`/`$pull` against JSON arrays in Postgres need different handling than Mongo.
- Aggregate translation: `$match`, `$group`, `$sum`, `$lookup`. The `$lookup` case is the most likely to silently misbehave.
- Empty-tenantId silent-empty behaviour: decide whether to keep, change to throw, or log. Recommendation: log a warning so a future bug is visible in monitoring.

**Step 3 — Fix the offer-portal landmine.**
[app/api/cvision/offer-portal/[token]/route.ts:65–67](app/api/cvision/offer-portal/[token]/route.ts:65) calls `client.db('cvision_${tokenDoc.tenantId}').collection('candidates')` where `client` is now `null`. The route also writes to a `cvision_offer_tokens` Mongo DB on line 258 — same crash. Either (a) rewrite to use `prisma.cvisionCandidate.findFirst({ where: { id, tenantId } })` and a new Postgres-backed token table, or (b) gate the route behind a 503 if the offer-portal flow isn't needed for the shadow run.

**Step 4 — Spot-check the 24 unaccounted routes.**
For each: read 5 lines of imports + grep for `prisma`, `db.`, `findOne`, `insertOne`. Most will be stateless (AI calls, file parsing, external API integrations). Any that do touch the DB through some other helper need to be verified against the same Postgres path.

### Track 2 — Optional cleanup (defer until after shadow run)

Replace the Mongo-shaped facade with native Prisma calls. This is a code-health improvement, not a correctness fix. Rough scope: 221 routes × ~30min each = ~14 person-days, spread across modules. Do it post-shadow-run, after the shim has proven correct.

The cleanup *can* be done module-by-module (the original module decomposition still applies for sequencing), but skip the dual-write/dual-read scaffolding entirely — just rewrite the route, run tests, ship.

---

## Revised risk register

| Risk | Impact | Mitigation | Monitoring signal |
|---|---|---|---|
| Shim filter/update translator has a silent bug | High — wrong data returned | Track 1 Step 1 + Step 2 audit before shadow run | Vitest 2722/2722 + new shim correctness tests |
| Empty-tenantId silent-empty masks an upstream bug | Med — debugging time wasted | Add a `logger.warn` when `hasInvalidUuidTenantId` triggers | Log volume on warn channel |
| Dead Mongo code paths (offer-portal, etc.) crash on first use | Med — single feature outage | Track 1 Step 3 + grep for `getPlatformClient` and audit each call site | Sentry / runtime errors |
| Shim aggregate (`$group`, `$lookup`) returns wrong shape under load | Med | Step 2 audit; integration test the payroll aggregate route specifically | Compare against hand-written SQL for one sample run |
| Shim performance — Mongo's filter syntax with deep `$and`/`$or` translates to verbose Prisma queries | Low–Med | Profile the top 10 routes with `EXPLAIN ANALYZE` on real data once it exists | Slow-query log |
| 24 unaccounted routes hide a Mongo write | Low | Step 4 spot check | Grep audit |
| Soft-delete filter (`deletedAt: null`) is missed in some queries | Low | Audit during Track 2 cleanup | Row counts on tables with `deletedAt` set |

The big risks from the original plan — **Mongo→Postgres data shape mismatch, missing tables, ObjectId vs UUID, FK constraints Mongo never enforced, transaction boundary differences** — are mostly moot. The schema was authored Postgres-first; there is no Mongo data to coerce. The exception is the offer-portal candidates collection, which would have lived in `cvision_${tenantId}` Mongo DBs in some prior iteration but has no rows now.

---

## What we are NOT doing

- **No dual-write.** No Mongo store to write to.
- **No backfill scripts.** No source data.
- **No per-module feature flags for cutover.** Cutover already happened on 2026-04-22 in commit `0f951b1`.
- **No data parity checks.** Nothing to compare against.
- **No drop-collection step.** The Mongo databases the code references (`cvision_${tenantId}`) likely don't exist on any live Mongo cluster — the project doesn't have a `MONGO_URI` configured.

---

## First concrete next step

**Write a single integration test file that exercises the employee CRUD flow end-to-end against the live Postgres dev DB.** Specifically:

```
tests/integration/cvision-shim-correctness.test.ts
  - createEmployee (POST) → expect 201 + UUID id returned
  - listEmployees with search + pagination → expect employee in results
  - listEmployees with status filter ($in via shim) → expect filtered correctly
  - getEmployee by id → expect full record with all fields
  - updateEmployee with partial fields ($set via shim) → expect only those fields changed
  - softDelete → expect deletedAt set, row excluded from default list
  - createEmployee with invalid tenantId "" → expect 400, not silent empty
```

If all pass, that's strong evidence the shim works on the most-used route. Expand to 9 more routes (Step 1 list above), and the bulk of pre-shadow-run risk is retired. Estimated effort: **2–3 days for one engineer.**

After Track 1 ships, write a one-page status note for the user covering: which routes are smoke-tested, what shim bugs were found and fixed, what's the residual risk going into the shadow run.

---

## Appendix — what changed from the original Stage B framing

| Original assumption | Actual finding |
|---|---|
| 246 routes still talk to MongoDB | 221 talk to Postgres via shim, 1 partial-shimmed, 1 broken-Mongo, 24 stateless |
| 121 Prisma models defined but unused | 121 models live and queryable; 0 rows because no users yet |
| Need Strangler Fig with dual-write per module | Cutover already happened; verification is what's needed |
| 3–4 month migration | 1–3 weeks of verification + dead-code fixes; cleanup is open-ended but not on critical path |
| Risk: Mongo→Postgres data shape mismatch | Risk: shim translator correctness under real load |

The user's instinct to plan first was correct. Had this been executed as written, weeks of dual-write scaffolding would have been built against a non-existent Mongo store.
