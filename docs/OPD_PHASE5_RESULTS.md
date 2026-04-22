# OPD Phase 5 – Results Auto-Surface + New Results Badges

Additive, OPD‑only. No changes to orders engine or result producers.

## APIs
### Results (read-only)
`GET /api/opd/encounters/:encounterCoreId/results`

Returns:
- `resultId`
- `type` (LAB/RAD/PROC)
- `title`
- `status`
- `createdAt`
- `source` (EHR/CONNECT)
- `payloadSummary`

### Results Viewed (OPD-only)
`POST /api/opd/encounters/:encounterCoreId/results/viewed`
Body: `{ resultId }`

Appends `opdResultsViewed[]`:
- `resultId`
- `viewedAt`
- `viewedBy`

## Result Types Supported
- EHR `order_results` (LAB/RAD/PROC)
- CONNECT lab results (LAB only)
Attachments are surfaced via `payloadSummary` when available.

## UI
### Patient Visit
- Auto‑surfaced results list in the Results tab.
- “New” badge shows until marked viewed.
- Marking viewed calls the OPD viewed endpoint.

### Doctor Schedule
- Each encounter includes `hasNewResults`.
- “NEW RESULTS” badge shows when any result is unviewed.

## Viewed Tracking Rules
- Viewed is OPD‑only and append‑only on `opd_encounters`.
- Result objects remain unchanged.

## Smoke Checklist
1) New results appear in OPD encounter results list.
2) Clicking “Mark Viewed” removes the “New” badge.
3) Doctor schedule shows “NEW RESULTS” when unviewed results exist.
4) Non‑OPD results and producers remain untouched.
