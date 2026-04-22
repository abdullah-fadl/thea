# OPD Phase 4 – Doctor Flow Core

Additive, OPD‑only. No changes to core encounter lifecycle, ER/IPD, scheduling, or orders.

## State + Timestamp Transitions
1) **PT Seen**
   - `opdFlowState = IN_DOCTOR`
   - `opdTimestamps.doctorStartAt` (append‑only; 409 treated as success)
2) **Send to Procedure**
   - `opdFlowState = PROCEDURE_PENDING`
   - `opdTimestamps.procedureStartAt` (append‑only)
3) **Procedure Done – Waiting**
   - `opdFlowState = PROCEDURE_DONE_WAITING`
   - `opdTimestamps.procedureEndAt` (append‑only)
4) **Complete Visit**
   - `opdFlowState = COMPLETED`
   - `opdTimestamps.doctorEndAt` (append‑only)
   - Optional `opdDisposition`

## Endpoints
- `POST /api/opd/encounters/:encounterCoreId/flow-state`
- `POST /api/opd/encounters/:encounterCoreId/timestamps`
- `POST /api/opd/encounters/:encounterCoreId/doctor`
- `POST /api/opd/encounters/:encounterCoreId/disposition`

## UI Notes
### Doctor Worklist (`/opd/doctor-worklist`)
- Shows READY badge for `READY_FOR_DOCTOR`.
- PT Seen button appears for READY patients.
- Procedure‑done patients show a badge (`PROCEDURE_DONE`).

### Patient Visit (`/opd/visit/:id`)
- Doctor Note section (append‑only SOAP or Free note).
- Procedure actions (send to procedure, done waiting).
- Complete Visit action with optional OPD‑only disposition.

## Doctor Note Guard
Doctor note append allowed only when:
- `opdFlowState` is `IN_DOCTOR` or `PROCEDURE_DONE_WAITING`.
Invalid state returns `400 { currentState, allowedStates }`.

## Disposition (OPD‑only)
`opdDisposition`:
- `type`: `OPD_REFERRAL | ER_REFERRAL | ADMISSION`
- `note` (optional)

## Smoke Checklist
1) READY patient shows PT Seen button in doctor schedule.
2) PT Seen sets `IN_DOCTOR` and `doctorStartAt` (409 handled).
3) Doctor note saves and appends an entry.
4) Procedure loop updates flow state and timestamps.
5) Complete Visit sets `COMPLETED`, `doctorEndAt`, and optional disposition.
