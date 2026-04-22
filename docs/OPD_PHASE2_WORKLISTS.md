# OPD Phase 2 – Operational Lists (Doctor Schedule + Nursing Worklist)

Additive, read-only operational lists for OPD. No changes to core encounter lifecycle, ER/IPD, scheduling engine, or orders engine.

## Page Routes
- `/opd/doctor-worklist` – Doctor worklist for today (logged-in provider)
- `/opd/nurse-station` – Nursing worklist (checked-in patients only)

## API Contracts
### Doctor Schedule
`GET /api/opd/doctor/schedule?date=YYYY-MM-DD`

**Response**
```
{
  "date": "2026-01-30",
  "doctor": { "providerId": "prov_1", "displayName": "Dr. A" },
  "items": [
    {
      "bookingId": "book_1",
      "bookingTypeLabel": "BOOKED",
      "clinicId": "clinic_1",
      "startAt": "2026-01-30T09:00:00.000Z",
      "checkedInAt": "2026-01-30T08:55:00.000Z",
      "status": "CHECKED_IN",
      "encounterCoreId": "enc_123",
      "visitType": "FU",
      "waitingToNursingMinutes": 5,
      "waitingToDoctorMinutes": 12,
      "patient": { "fullName": "Jane Doe", "mrn": "MRN001" }
    }
  ]
}
```

Notes:
- Arrived-only patients (`arrivalSource='PATIENT'` and not checked in) are excluded.
- `status` is derived as `CHECKED_IN` → `ARRIVED` → `BOOKED`.

### Nursing Worklist
`GET /api/opd/nursing/worklist?clinicId=CLINIC_ID&date=YYYY-MM-DD`

**Response**
```
{
  "date": "2026-01-30",
  "clinicId": "clinic_1",
  "items": [
    {
      "bookingId": "book_2",
      "encounterCoreId": "enc_456",
      "visitType": "FVC",
      "doctorName": "Dr. B",
      "isArrived": true,
      "isCheckedIn": true,
      "waitingToNursingMinutes": 10,
      "waitingToDoctorMinutes": 0,
      "patient": { "fullName": "Omar Ali", "mrn": "MRN002" }
    }
  ]
}
```

Notes:
- Worklist is **checked-in only** (filters on `checkedInAt`).

## Waiting Minutes
Computed using `lib/opd/waiting.ts`:
- `waitingToNursingMinutes(now, arrivedAt, nursingStartAt)`
- `waitingToDoctorMinutes(now, nursingEndAt, doctorStartAt)`

Waiting values return `null` when the relevant timestamps are missing.

## Smoke Checklist
1) Checked-in patient appears on doctor schedule and nursing worklist.
2) Arrived-only patient (self-arrived, not checked in) does **not** appear.
3) Waiting minutes display for patients with timestamps.
4) “Open Visit” links work only when `encounterCoreId` exists.
