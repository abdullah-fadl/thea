# OPD Phase 1 – Arrival + Payment + Waiting Timers (Additive Only)

This phase adds minimal OPD arrival/payment snapshots and read-only waiting helpers.
No changes to core `encounter_core` lifecycle, ER/IPD logic, scheduling engine, or orders engine.

## Fields Added / Reused
- `opd_encounters.arrivalSource`: `'RECEPTION' | 'PATIENT'` (optional)
- `opd_encounters.opdTimestamps.arrivedAt`: reused (no duplicate `arrivedAt` field)
- `opd_encounters.payment` (optional snapshot)
  - `status`: `'PAID' | 'SKIPPED' | 'PENDING'`
  - `serviceType`: `'CONSULTATION' | 'FOLLOW_UP'`
  - `paidAt` (optional ISO datetime)
  - `amount` (optional number or null)
  - `method` (optional: `'CASH' | 'CARD' | 'ONLINE'`)

## APIs Touched / Added
- Extended `POST /api/opd/encounters/:encounterCoreId/arrival`
  - Sets `opdTimestamps.arrivedAt` if missing
  - Sets `arrivalSource` if missing
  - Sets `payment` snapshot if provided and missing
  - Sets `visitType` if provided and missing
- Extended `POST /api/opd/booking/check-in`
  - Sets `arrivalSource='RECEPTION'` if missing
  - Sets `opdTimestamps.arrivedAt` if missing
  - Sets `payment` snapshot if provided and missing
- Added `POST /api/opd/booking/:bookingId/arrived`
  - Resolves `encounterCoreId`/`opd_encounter`
  - Sets `arrivalSource='PATIENT'`
  - Sets `opdTimestamps.arrivedAt` if missing
  - No payment required
  - Does not mark check-in

## Examples
### Reception Check-in (paid)
```
POST /api/opd/booking/check-in
{
  "bookingId": "book_123",
  "payment": {
    "status": "PAID",
    "serviceType": "CONSULTATION",
    "paidAt": "2026-01-30T09:05:00.000Z",
    "amount": 200,
    "method": "CARD"
  }
}
```

### Patient Arrived (no payment)
```
POST /api/opd/booking/book_123/arrived
{}
```

## Arrived vs Check-in (Semantics)
- **Arrived** (`/api/opd/booking/:bookingId/arrived`): patient self-arrival signal only. Sets `arrivalSource='PATIENT'` and `opdTimestamps.arrivedAt` if missing. Does not set `checkedInAt`, does not attach payment, does not perform reception check-in.
- **Check-in** (`/api/opd/booking/check-in`): reception-controlled check-in. Sets `checkedInAt`, can attach payment snapshot, and is the only endpoint that marks check-in.

Suggested usage:
- Patient-facing “I Arrived” buttons should call **Arrived**.
- Reception workflows should use **Check-in** only.

## Waiting Timer Helpers
Helpers are read-only and do not persist anything:
- `waitingToNursingMinutes(now, arrivedAt, nursingStartAt)`
- `waitingToDoctorMinutes(now, nursingEndAt, doctorStartAt)`

**Example**
```
waitingToNursingMinutes(
  new Date("2026-01-30T09:30:00.000Z"),
  "2026-01-30T09:10:00.000Z",
  null
) -> 20
```

## Smoke Checklist
1) Reception check-in sets `arrivalSource='RECEPTION'` and `opdTimestamps.arrivedAt` if missing.
2) Patient arrival endpoint sets `arrivalSource='PATIENT'` and `opdTimestamps.arrivedAt` if missing.
3) Payment snapshot is accepted when provided and does not overwrite existing payment.
4) Waiting helpers return minutes for partial or in-progress flows.
