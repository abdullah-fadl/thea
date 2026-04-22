# Service Catalog QA

## Scope
- Visit / Bed-day / Nursing services
- Auto charge only
- No inventory
- Append-only usage events

## Checks
1. Create a service:
   - Verify a `SRV-*` catalog code and linked charge are created.
2. Post a service usage event:
   - Expect a charge event created with snapshot (name/price/unit) at time of use.
3. Double POST (usage):
   - Same `requestId` twice → second returns `noOp` + `x-idempotent-replay: 1`.
4. Concurrency:
   - Fire 5 parallel POSTs with same `requestId` → only one record created.
5. Network retry:
   - Simulate timeout, resend same `requestId` → `noOp` + `x-idempotent-replay: 1`.
6. Double submit (UI):
   - Double-click “Log” → single record created.
7. Post-change behavior:
   - Update service price/name.
   - Existing charge events remain unchanged (snapshot preserved).
8. Cross-catalog mapping failure:
   - Attempt to link a medication charge to service (should be blocked by item type).
9. Grep proof:
   - `rg "update|delete" app/api/catalogs/services/usage/route.ts` → no matches.
