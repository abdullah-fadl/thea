# Supplies Catalog QA

## Scope
- Usage tracking only
- Optional charge generation
- No stock management v0.1
- Append-only usage events

## Checks
1. Create a supply without charge generation.
2. Create a supply with charge generation:
   - Verify a `SUP-*` charge is created and linked.
3. Cross-catalog mapping failure:
   - Try linking a charge already linked to medication/service → expect 409.
4. Double POST (usage):
   - Same `requestId` twice → second returns `noOp` + `x-idempotent-replay: 1`.
5. Concurrency:
   - Fire 5 parallel POSTs with same `requestId` → only one record created.
6. Network retry:
   - Simulate timeout, resend same `requestId` → `noOp` + `x-idempotent-replay: 1`.
7. Double submit (UI):
   - Double-click “Log” → single record created.
8. Post-change behavior:
   - Update supply name; previous usage events remain unchanged.
9. Grep proof:
   - `rg "update|delete" app/api/catalogs/supplies/usage/route.ts` → no matches.
