# OPD Phase 6 - Patient Mini-Portal

## Overview
This phase introduces a patient-facing mini-portal for booking, arrival, and report viewing.
All changes are OPD-only and additive. No ER/IPD/scheduling/order engine behavior is modified.

## Data Additions (Additive Only)
- `opd_bookings.portalUserId` (optional)
- `opd_bookings.portalMobile` (optional)
- `patient_master.mobile` + `patient_master.mobileNormalized` (optional, portal registration only)
- Tenant DB collections:
  - `patient_portal_users` (portal identity, linked to `patientMasterId` when known)
  - `patient_portal_sessions` (server-side session tracking, optional `patientMasterId`)
  - `patient_portal_otps` (short-lived OTP requests)

## Authentication & Registration (OTP Stub)
Minimal OTP flow using a configurable stub code, plus portal registration that writes to `patient_master`:
- `PORTAL_OTP_STUB` env (default `0000`)
- Session token stored in `portal-token` cookie (HTTP-only, 7 days by default)
- Session details stored in `patient_portal_sessions` (append-only, TTL via `expiresAt`)
- Idle timeout enforced via `PORTAL_IDLE_MINUTES` (default 30 minutes)
- Hard session expiry via `PORTAL_SESSION_DAYS` (default 7 days)
- OTP request rate-limit: per mobile (5) + per IP (20) per 10-minute window
- OTP verify attempts: max 6 attempts then lock 10 minutes
- OTP code TTL: 5 minutes

Endpoints:
- `POST /api/portal/auth/request-otp` → `{ tenantId, idType, idNumber }`
- `POST /api/portal/auth/verify-otp` → `{ tenantId, idType, idNumber, otp }`
- `POST /api/portal/auth/register` → `{ tenantId, fullName, idType, idNumber, mobile }`
- `POST /api/portal/auth/logout`
- `GET /api/portal/auth/me`

## Portal Routes
- `/p` - Login (ID + OTP) / Registration tabs
- `/p/book` - booking flow
- `/p/appointments` - upcoming bookings + "I Arrived"
- `/p/reports` - encounter list + result view
- `/p/reports/ophthalmology/[encounterCoreId]` - print-friendly ophthalmology report

## Portal APIs
Metadata and booking:
- `GET /api/portal/tenants`
- `GET /api/portal/metadata`
- `GET /api/portal/booking/slots?resourceId=...&date=YYYY-MM-DD`
- `POST /api/portal/booking/create`
- `POST /api/portal/booking/:bookingId/arrived`
- `GET /api/portal/appointments`

Reports:
- `GET /api/portal/reports` (encounters for linked `patientMasterId`)
- `GET /api/portal/reports/:encounterCoreId/results`
- `GET /api/portal/reports/ophthalmology/:encounterCoreId`

## Ownership Rules
- Portal session is required for all portal APIs (via `portal-token` cookie).
- Tenant context is derived only from portal session (never from request params).
- Bookings are visible by `portalUserId`.
- If `patientMasterId` is linked, reports are available only for that patient ID.
- Encounter/report access is blocked if `encounter_core.patientId` does not match portal user's `patientMasterId`.
- "I Arrived" only updates `opdTimestamps.arrivedAt` and `arrivalSource='PATIENT'` (no check-in).
- Registration is idempotent by `(tenantId + idType + idNumberNormalized)`:
  - If existing patient has a different mobile → 409 (no overwrite).

## Smoke Checklist (Manual)
- Register new patient (fullName + idType + idNumber + mobile) → auto-login
- Login with idType/idNumber + OTP stub and access `/p/book`
- Book a slot and verify `opd_bookings.portalUserId` + `portalMobile`
- "I Arrived" does not set `checkedInAt` or payment
- Reports list shows only when `patientMasterId` is linked
- Cross-patient access is blocked:
  - Try to open another patient's report URL → 403 or redirect
  - Try to call `/api/portal/reports/:encounterCoreId/results` on a different patient → 403
- Cross-tenant access blocked (portal session tenant mismatch fails)
- Portal token expiry/log-out clears access

