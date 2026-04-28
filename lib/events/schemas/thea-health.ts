/**
 * Phase 7.4 — Thea Health domain event schemas
 *
 * Five high-value events emitted by the Thea Health platform. Importing this
 * module triggers the registerEventType() side-effects at module-load time,
 * so the barrel at `lib/events/schemas/index.ts` must be imported once at
 * app boot (not per-request) before any route attempts to emit.
 *
 * PHI discipline: every payload below is restricted to opaque IDs (UUIDs),
 * tenant scope (tenantId), status enums, and timestamps. No names, no MRNs,
 * no contact info, no clinical values. Downstream consumers (projections,
 * agents, outcomes) re-read the patient/encounter by ID through normal
 * tenant-scoped Prisma queries — not through the event payload — so PHI
 * stays inside the row-level security boundary that already governs reads.
 */

import { z } from 'zod';
import { registerEventType } from '../registry';

// ─── 1. patient.registered@v1 ───────────────────────────────────────────────
// Fired after a new PatientPortalUser row is inserted via portal self-registration.
registerEventType({
  eventName: 'patient.registered',
  version: 1,
  aggregate: 'patient',
  description:
    'A new patient successfully completed portal registration (OTP verified + portal user row created).',
  payloadSchema: z.object({
    patientId: z.string().uuid(),
    portalUserId: z.string().uuid(),
    tenantId: z.string().uuid(),
  }),
});

// ─── 2. encounter.opened@v1 ─────────────────────────────────────────────────
// Fired after a new EncounterCore + OPDEncounter pair is inserted on visit open.
registerEventType({
  eventName: 'encounter.opened',
  version: 1,
  aggregate: 'encounter',
  description:
    'An OPD encounter was opened (encounter_core ACTIVE + opd_encounters OPEN).',
  payloadSchema: z.object({
    encounterId: z.string().uuid(),
    patientId: z.string().uuid(),
    tenantId: z.string().uuid(),
    encounterType: z.literal('OPD'),
    openedAt: z.string().datetime(),
  }),
});

// ─── 3. encounter.closed@v1 ─────────────────────────────────────────────────
// Fired after the OPD status route transitions an encounter to COMPLETED or CLOSED.
// `status` is the enum value the route landed on; no free-text disposition is
// emitted (those fields can carry PHI and must be looked up by ID).
registerEventType({
  eventName: 'encounter.closed',
  version: 1,
  aggregate: 'encounter',
  description:
    'An OPD encounter transitioned to a terminal status (COMPLETED or CLOSED).',
  payloadSchema: z.object({
    encounterId: z.string().uuid(),
    patientId: z.string().uuid(),
    tenantId: z.string().uuid(),
    status: z.enum(['COMPLETED', 'CLOSED']),
    closedAt: z.string().datetime(),
  }),
});

// ─── 4. order.placed@v1 ─────────────────────────────────────────────────────
// Fired after an OPD order is created. Title/notes are deliberately excluded —
// they can contain free-text PHI. `kind` is the order type enum.
registerEventType({
  eventName: 'order.placed',
  version: 1,
  aggregate: 'order',
  description:
    'A clinical order was placed inside an OPD encounter (lab / radiology / pharmacy / procedure / referral / consult).',
  payloadSchema: z.object({
    orderId: z.string().uuid(),
    encounterId: z.string().uuid(),
    patientId: z.string().uuid().nullable(),
    tenantId: z.string().uuid(),
    kind: z.enum(['LAB', 'RADIOLOGY', 'RAD', 'PHARMACY', 'PROCEDURE', 'REFERRAL', 'CONSULT']),
    placedAt: z.string().datetime(),
  }),
});

// ─── 5. lab.result.posted@v1 ────────────────────────────────────────────────
// Fired only when a LabResult is finalized (status COMPLETED / VERIFIED /
// RESULTED). Parameter values, abnormal flags, and test display names are
// NEVER emitted — subscribers re-read by ID via tenant-scoped queries.
registerEventType({
  eventName: 'lab.result.posted',
  version: 1,
  aggregate: 'lab_result',
  description:
    'A laboratory result was finalized (LabResult row in a terminal status — COMPLETED / VERIFIED / RESULTED).',
  payloadSchema: z.object({
    labResultId: z.string().uuid(),
    orderId: z.string().min(1),
    testId: z.string().min(1),
    tenantId: z.string().uuid(),
    patientId: z.string().uuid().nullable(),
    encounterId: z.string().uuid().nullable(),
    status: z.string().min(1),
    postedAt: z.string().datetime(),
  }),
});
