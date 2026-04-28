# Diagnosis Catalog QA

## Scope
- Read-only clinical catalog
- No pricing, no inventory

## Checks
1. Open `/billing/diagnosis-catalog`.
2. Verify list loads and search works by code or name.
3. Confirm there are no create/edit/delete controls.
4. Double POST: N/A (read-only).
5. Post-change behavior: N/A (read-only).
6. Cross-catalog mapping failure: N/A (no charge mapping).
