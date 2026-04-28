# OPD Phase 0 – Safe Foundation (Additive Only)

This phase adds OPD-specific foundations without changing core EHR, ER, IPD, scheduling, or orders behavior.

## Reused (Already Exists)
- `encounter_core` for the core Encounter lifecycle and `encounterType: 'OPD'`.
- `opd_encounters` for OPD-only extensions (status/arrival state).
- OPD arrival actions and status transitions (existing API routes).

## Added (Safe, Additive)
### Visit Type (OPD only)
- New field on `opd_encounters`: `visitType` (values: `FVC`, `FVH`, `FU`, `RV`).
- Optional on OPD booking creation and arrival updates.

### OPD Flow State (separate from Encounter status)
- New field on `opd_encounters`: `opdFlowState`.
- New API route to set flow state without touching core Encounter status.

### OPD Timestamps (append-only)
- New object on `opd_encounters`: `opdTimestamps`.
- Append-only timestamp API; fields are only set once.
- Arrival action sets `opdTimestamps.arrivedAt` if missing.

### Clinic Extensions (flexible, optional)
- New object on `opd_encounters`: `opdClinicExtensions`.
- API accepts per-clinic extension payloads without coupling to core OPD flow.

## New OPD API Endpoints
- `POST /api/opd/encounters/:encounterCoreId/flow-state`
- `POST /api/opd/encounters/:encounterCoreId/timestamps`
- `POST /api/opd/encounters/:encounterCoreId/clinic-extensions`

## Request/Response Examples
### Timestamps (append-only)
**Request**
```
POST /api/opd/encounters/enc_123/timestamps
{
  "opdTimestamps": {
    "nursingStartAt": "2026-01-30T09:10:00.000Z"
  }
}
```
**Response (success)**
```
200
{
  "success": true,
  "opd": {
    "opdTimestamps": {
      "nursingStartAt": "2026-01-30T09:10:00.000Z"
    }
  }
}
```
**Response (409 already set)**
```
409
{
  "error": "Timestamp already set",
  "field": "nursingStartAt",
  "existingValue": "2026-01-30T09:10:00.000Z"
}
```

### Flow State (guarded transitions)
**Request**
```
POST /api/opd/encounters/enc_123/flow-state
{
  "opdFlowState": "IN_DOCTOR"
}
```
**Response (success)**
```
200
{
  "success": true,
  "opd": {
    "opdFlowState": "IN_DOCTOR"
  }
}
```
**Response (400 invalid transition)**
```
400
{
  "error": "Invalid opdFlowState transition",
  "current": "WAITING_NURSE",
  "attempted": "IN_DOCTOR",
  "allowed": ["IN_NURSING", "READY_FOR_DOCTOR"]
}
```

### Clinic Extensions (deep-merge per clinic)
**Request**
```
POST /api/opd/encounters/enc_123/clinic-extensions
{
  "opdClinicExtensions": {
    "ophthalmology": {
      "visualAcuity": "20/20"
    }
  }
}
```
**Previous stored**
```
{
  "opdClinicExtensions": {
    "ophthalmology": {
      "refraction": "-1.25"
    }
  }
}
```
**Response (deep-merge result)**
```
200
{
  "success": true,
  "opd": {
    "opdClinicExtensions": {
      "ophthalmology": {
        "refraction": "-1.25",
        "visualAcuity": "20/20"
      }
    }
  }
}
```

## Smoke Checklist
1) `POST /api/opd/encounters/:encounterCoreId/timestamps` returns `200` on first set.
2) Re-posting the same timestamp returns `409` with `{ field, existingValue }`.
3) `POST /api/opd/encounters/:encounterCoreId/flow-state` rejects invalid transitions with `400`.
4) `POST /api/opd/encounters/:encounterCoreId/clinic-extensions` deep-merges fields without losing prior data.

## Why This Is Safe
- No changes to `encounter_core` lifecycle, ER, IPD, scheduling, or orders logic.
- All new fields are optional and backward compatible.
- No destructive migrations; Mongo documents can accept new fields.
- Existing OPD behavior remains unchanged; new routes are additive.
