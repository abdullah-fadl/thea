# Pricing Packages QA

## Scope
- Manual apply
- Fixed price
- Overrides charges (stored as application records)
- Idempotent apply

## Checks
1. Create a package and verify `PKG-*` code is generated.
2. Double POST (apply):
   - Call apply twice with same `requestId` → second returns `noOp` and same application.
   - Verify response header `x-idempotent-replay: 1`.
3. Network retry:
   - Simulate timeout, resend same `requestId` → `noOp` + header set.
4. Double submit (UI):
   - Double-click “Apply” → single application record.
5. Post-change behavior:
   - Update package price.
   - Existing applications remain unchanged (snapshot preserved).
6. Cross-catalog mapping failure:
   - Not applicable (no charge mapping).
