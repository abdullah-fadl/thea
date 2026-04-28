# Stage B T4 — CVision "Stateless Routes" Inventory

**Date:** 2026-04-27
**Branch:** `cvision-stage-b`
**Inventory query:**

```bash
find app/api/cvision -name 'route.ts' -exec grep -L \
  "getCVisionDb\|getCVisionCollection\|cvisionDb\|prisma\." {} +
```

The grep above returns **24 routes** that lack *direct* references to the
CVision DB layer. The classification below verifies what each one actually does.

## Classification key

- **STATELESS** — truly does not need a database. No persistence, no DB lookups.
- **MISLABELED** — does need a database but reaches it indirectly through a helper
  module (engine / manager). The grep filter missed these because the route file
  itself contains no direct `prisma.` / `getCVisionDb` calls.
- **DEAD** — declared but unimplemented; safe to remove.

## Verdict

| # | Route | Class | Reason |
|---|---|---|---|
|  1 | `dev-override` | STATELESS | Cookie-based role/scope impersonation, gated by `CVISION_DEV_OVERRIDE=1`. No DB. |
|  2 | `gosi` | STATELESS | Pure GOSI / End-of-Service / Nitaqat calculator. `lib/cvision/gosi.ts` has 0 DB calls. |
|  3 | `iban` | STATELESS | Pure Saudi IBAN validation + bank list. `lib/cvision/iban-validator.ts` has 0 DB calls. |
|  4 | `docs` | STATELESS | Returns the static `openApiSpec` object (13 lines total). |
|  5 | `integrations/zatca` | STATELESS | ZATCA invoice client. `zatca-client.ts` has 0 DB; only auth lookup happens via middleware. |
|  6 | `admin/email-test` | STATELESS | Sends a test email via `sendEmail`. Email sender has 0 DB calls. |
|  7 | `recruitment/extract-cv-text` | STATELESS | Server-side PDF/DOC text extraction. No persistence. |
|  8 | `recruitment/cv-inbox/parse-pdf` | STATELESS | `pdf-parse` text extraction. No persistence. |
|  9 | `recruitment/cv-inbox/parse-cv` | STATELESS | AI CV analyzer; receives departments/jobTitles in payload. No persistence. |
| 10 | `recruitment/ai-interview/upload` | STATELESS | Writes WebM clips to `storage/interviews/<sessionId>/`. Filesystem only. |
| 11 | `warehouse` | MISLABELED | `warehouse-engine.ts` — 6 DB calls. |
| 12 | `saas` | MISLABELED | tenant-manager (7) + user-manager (2) + api-keys (8) + webhooks (5) all hit DB. |
| 13 | `communications` | MISLABELED | `comms-engine.ts` — 5 DB calls. |
| 14 | `investigations` | MISLABELED | `disciplinary/investigation-engine.ts` — 6 DB calls. |
| 15 | `bookings` | MISLABELED | `booking/booking-engine.ts` — 4 DB calls. |
| 16 | `undo` | MISLABELED | `undo.ts` (4) + `soft-delete.ts` (5) — DB-backed history & restore. |
| 17 | `bi` | MISLABELED | `analytics/bi-engine.ts` — 4 DB calls. |
| 18 | `offer-portal/[token]` | MISLABELED | Uses `getPlatformClient().db` directly (covered by Stage B T1 fix). |
| 19 | `auth/security` | MISLABELED | `auth/security-engine.ts` — 4 DB calls. |
| 20 | `ai/ranking` | MISLABELED | `ai/candidate-ranking-engine.ts` — 10 DB calls. |
| 21 | `ai/chatbot` | MISLABELED | `ai/interview-chatbot-engine.ts` — 5 DB calls. |
| 22 | `ai/threshold` | MISLABELED | `ai/confidence-threshold-engine.ts` — 4 DB calls. |
| 23 | `authz/context` | MISLABELED | `authz/context.ts` — 3 DB calls (employee link lookup). |
| 24 | `recruitment/ai-interview/process` | MISLABELED | Persists session results via `ai/interview-chatbot-engine.ts`. |

## Totals

- **STATELESS:** 10
- **MISLABELED:** 14
- **DEAD:** 0

No code changes are required.

The "mislabel" is a property of the audit query, not the routes themselves —
each MISLABELED route correctly delegates DB access to a typed engine module
in `lib/cvision/<domain>/`. Going forward, DB-aware audit queries should also
match `from '@/lib/cvision/.*-engine'` and similar helper imports, not only
direct `prisma.`/`getCVisionDb` calls. None of the 24 routes are dead, and
every MISLABELED route is exercised in production through its engine layer.

## Follow-up notes

- The `/files` route (not in this inventory because it does call `getCVisionDb`)
  uses the unmapped `cvision_files` collection; the shim falls back to a no-op
  delegate. Stage B T3 substituted `documents-smoke.test.ts` against the real
  `cvision_employee_documents` model. A separate task should either map the
  collection or migrate `/files` callers to `/documents`.
- The 10 STATELESS routes are safe to leave outside any future DB-migration
  smoke-test sweep.
