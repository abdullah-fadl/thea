# OPD Phase 3 – Nursing Flow (Start → Vitals → Ready)

Additive only. OPD‑only data and APIs; no changes to core encounter lifecycle, ER/IPD, scheduling, or orders.

## UI Behavior
- Nursing worklist (`/opd/nurse-station`) shows checked‑in patients only.
- Each row includes an action to open the Nursing Panel.
- Nursing Panel shows patient summary, quick form, and ophthalmology extension (when clinic is ophthalmology).

## APIs Used
- `POST /api/opd/encounters/:encounterCoreId/flow-state`
  - `IN_NURSING` on Start
  - `READY_FOR_DOCTOR` on Ready
- `POST /api/opd/encounters/:encounterCoreId/timestamps`
  - `nursingStartAt` on Start (append‑only)
  - `nursingEndAt` on Ready (append‑only)
- `POST /api/opd/encounters/:encounterCoreId/nursing`
  - Append‑only nursing entry (`opdNursingEntries`)
- `POST /api/opd/encounters/:encounterCoreId/clinic-extensions`
  - `opdClinicExtensions.ophthalmology` deep‑merge

## State + Timestamp Transitions
1) **Start Nursing**
   - Set `opdFlowState = IN_NURSING`
   - Set `opdTimestamps.nursingStartAt` (append‑only)
   - If timestamp already exists (409), UI treats as success and shows “Already started”
2) **Ready for Doctor**
   - Set `opdTimestamps.nursingEndAt` (append‑only)
   - Set `opdFlowState = READY_FOR_DOCTOR`
   - If timestamp already exists (409), UI treats as success and shows “Already marked ready”

## Nursing Quick Form (Append‑only)
Stored as `opd_encounters.opdNursingEntries[]`:
- nursingNote
- vitals: BP, HR, Temp, RR, SpO2
- painScore (0‑10)
- chiefComplaintShort
- fallRiskScore (0‑2 or LOW/MED/HIGH)
- PFE short fields (allergies, medications, medicalHistory)
Guard:
- Nursing entries are accepted only when `opdFlowState` is `WAITING_NURSE`, `IN_NURSING`, or `READY_FOR_DOCTOR`.
- Any other state returns `400 { error, currentState, allowedStates }`.

## Ophthalmology Extension (Optional)
Only when clinic is ophthalmology:
- visualAcuity
- refraction
- intraocularPressure
Stored under `opdClinicExtensions.ophthalmology` (deep‑merge).

## Smoke Checklist
1) Checked‑in patient opens Nursing Panel from worklist.
2) Start Nursing sets `IN_NURSING` and `nursingStartAt` once.
3) Save Nursing appends a new `opdNursingEntries` entry.
4) Mark Ready sets `nursingEndAt` and `READY_FOR_DOCTOR`.
5) Ophthalmology fields save via clinic extension without deleting existing data.
