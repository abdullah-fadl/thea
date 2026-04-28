/**
 * Phase 8.4 — Clinical / billing flow event schemas (scaffold)
 *
 * Four high-value events that close common Saudi-hospital outcome loops:
 *
 *   - appointment.no_show@v1   — patient did not arrive for a scheduled OPD slot
 *   - claim.created@v1         — NPHIES claim envelope was constructed
 *   - claim.adjudicated@v1     — payer returned a ClaimResponse (complete / partial / error)
 *   - claim.paid@v1            — finance confirmed funds settled into the AR ledger
 *
 * IMPORTANT — these schemas are REGISTERED NOW but NOT EMITTED YET.
 * Importing this barrel makes the (eventName, version) keys known to the
 * Phase 4.2 registry, so Phase 8.4 outcome formulas can reference them
 * without falling over at registration time and so emit() will validate
 * payloads correctly the moment a route starts producing them.
 *
 * Future wiring (one task per event):
 *   - appointment.no_show     → emit from the OPD scheduler when an arrival
 *                                window expires with no `encounter.opened`.
 *   - claim.created           → emit from `app/api/fhir/claims/[id]/send/route.ts`
 *                                AFTER the bundle is built but BEFORE the
 *                                NPHIES POST (so we measure end-to-end RCM).
 *   - claim.adjudicated       → emit from the same route once a NPHIES
 *                                ClaimResponse comes back (success or error).
 *   - claim.paid              → emit from finance's payment-posting route once
 *                                an inbound remittance reconciles the claim.
 *
 * Sensitivity discipline mirrors the Phase 7.4 / 7.5 / 8.3 schemas:
 *   payloads carry only opaque IDs (UUIDs), tenant scope, status enums, and
 *   timestamps. No member numbers, no monetary amounts, no narrative text.
 *   Subscribers re-read the row by ID through tenant-scoped Prisma queries
 *   to access the full record under existing RLS / permission gates.
 */

import { z } from 'zod';
import { registerEventType } from '../registry';

// ─── 1. appointment.no_show@v1 (scaffold — not yet emitted) ─────────────────
// Fired by the OPD scheduler when a booked slot's arrival window closes
// without the patient being checked in. Used by the Saudi
// `appointment-no-show-rate-pct` outcome paired against booked appointments.
registerEventType({
  eventName: 'appointment.no_show',
  version: 1,
  aggregate: 'appointment',
  description:
    'A scheduled appointment slot expired without the patient arriving (no encounter.opened produced within the slot window).',
  payloadSchema: z.object({
    appointmentId: z.string().uuid(),
    tenantId: z.string().uuid(),
    patientId: z.string().uuid(),
    departmentId: z.string().uuid().nullable(),
    slotId: z.string().uuid().nullable(),
    scheduledAt: z.string().datetime(),
    expiredAt: z.string().datetime(),
  }),
});

// ─── 2. claim.created@v1 (scaffold — not yet emitted) ───────────────────────
// Fired when a NPHIES claim envelope is constructed and persisted (not yet
// transmitted). Marks the start of the revenue-cycle clock.
registerEventType({
  eventName: 'claim.created',
  version: 1,
  aggregate: 'claim',
  description:
    'A NPHIES claim envelope was created and persisted, ready for transmission to the payer.',
  payloadSchema: z.object({
    claimId: z.string().uuid(),
    tenantId: z.string().uuid(),
    encounterId: z.string().uuid().nullable(),
    payerId: z.string().uuid(),
    type: z.enum(['professional', 'institutional', 'pharmacy', 'oral', 'vision']),
    use: z.enum(['claim', 'preauthorization', 'predetermination']),
    createdAt: z.string().datetime(),
  }),
});

// ─── 3. claim.adjudicated@v1 (scaffold — not yet emitted) ───────────────────
// Fired when NPHIES returns a ClaimResponse (whatever the outcome). Used by
// the Saudi `claim-approval-rate-pct` outcome paired against total claims
// transmitted. `outcome` matches the FHIR Claim.outcome value set.
registerEventType({
  eventName: 'claim.adjudicated',
  version: 1,
  aggregate: 'claim',
  description:
    'NPHIES returned a ClaimResponse for a previously transmitted claim (outcome: complete | partial | error | queued).',
  payloadSchema: z.object({
    claimId: z.string().uuid(),
    claimResponseId: z.string().uuid(),
    tenantId: z.string().uuid(),
    payerId: z.string().uuid(),
    outcome: z.enum(['complete', 'partial', 'error', 'queued']),
    adjudicatedAt: z.string().datetime(),
  }),
});

// ─── 4. claim.paid@v1 (scaffold — not yet emitted) ──────────────────────────
// Fired when an inbound remittance reconciles a claim and finance posts the
// payment to AR. Marks the end of the revenue-cycle clock.
registerEventType({
  eventName: 'claim.paid',
  version: 1,
  aggregate: 'claim',
  description:
    'A claim was reconciled against an inbound remittance and finance posted the payment to the AR ledger.',
  payloadSchema: z.object({
    claimId: z.string().uuid(),
    tenantId: z.string().uuid(),
    payerId: z.string().uuid(),
    paymentId: z.string().uuid(),
    paidAt: z.string().datetime(),
  }),
});
