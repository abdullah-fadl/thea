# OPD Phase 4.2 – Ophthalmology Doctor Report (Glasses Rx + Print)

Additive, OPD‑only. Uses clinic extensions deep‑merge; no core encounter changes.

## Data Fields (stored under clinic extensions)
`opdClinicExtensions.ophthalmology.doctorExam`
- `visualAcuityOD`, `visualAcuityOS`
- `refractionOD { sphere, cyl, axis }`
- `refractionOS { sphere, cyl, axis }`
- `iopOD`, `iopOS`
- `impression`

`opdClinicExtensions.ophthalmology.glassesRx`
- `od { sphere, cyl, axis, add }`
- `os { sphere, cyl, axis, add }`
- `pd`
- `notes`

## UI Behavior
- In `/opd/visit/:id`, the **Ophthalmology (Doctor)** section appears only for ophthalmology clinics.
- Save uses `POST /api/opd/encounters/:encounterCoreId/clinic-extensions` (deep‑merge).
- Print link opens the report view.

## Report Route
`GET /opd/visit/:encounterCoreId/eye-report`
- Print‑friendly HTML layout
- Includes hospital name placeholder, doctor name, patient info, exam summary, and glasses Rx table
- “Print” button triggers `window.print()`

## Smoke Checklist
1) Saving doctorExam deep‑merges without deleting existing fields.
2) Saving glassesRx deep‑merges without deleting existing fields.
3) Report renders and prints.
4) Non‑ophthalmology encounters do not show the section or report.
