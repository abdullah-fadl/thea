/**
 * Phase 7.5 — SAM (compliance / safety / policy management) domain event
 * schemas.
 *
 * Three high-value compliance / quality events. Importing this module
 * triggers registerEventType() side-effects at module-load time, so the
 * boot-time barrel at `lib/events/schemas/index.ts` must be imported once
 * at app boot before any route attempts to emit.
 *
 * Sensitivity discipline: payloads contain only IDs (UUIDs), tenant scope,
 * status / severity enums, and timestamps. No policy bodies, no patient
 * IDs, no incident descriptions, no employee names. Free-text fields like
 * `description` on a quality incident or `userName`/`userEmail` on an
 * acknowledgment are deliberately excluded — incident descriptions can
 * contain PHI and acknowledger emails can identify staff. Subscribers
 * re-read the row by ID through tenant-scoped Prisma queries to access
 * the full record under the existing RLS / permission model.
 */

import { z } from 'zod';
import { registerEventType } from '../registry';

// ─── 1. policy.published@v1 ─────────────────────────────────────────────────
// Fired when a SAM policy draft transitions to the `published` status via
// POST /api/sam/drafts/[draftId]/publish. The aggregate is conceptually
// the policy itself; we use the draftId as the aggregate identity since
// it's the row whose status was updated. Subscribers can re-read the draft
// (and the corresponding Thea-Engine policy via publishedTheaEngineId) for
// detail without touching the event payload.
registerEventType({
  eventName: 'policy.published',
  version: 1,
  aggregate: 'policy',
  description:
    'A SAM policy draft was published (DraftDocument.status transitioned to "published").',
  payloadSchema: z.object({
    draftId: z.string().uuid(),
    tenantId: z.string().uuid(),
    publishedTheaEngineId: z.string().nullable(),
    status: z.literal('published'),
    publishedAt: z.string().datetime(),
  }),
});

// ─── 2. policy.acknowledged@v1 ──────────────────────────────────────────────
// Fired after a new PolicyAcknowledgment row is inserted via POST
// /api/sam/policies/[policyId]/acknowledge. We do NOT emit the
// acknowledger's name, email, or IP — those are stored on the row for
// audit but cross-platform consumers should look up by acknowledgmentId
// under the SAM permission model rather than receive identity directly.
registerEventType({
  eventName: 'policy.acknowledged',
  version: 1,
  aggregate: 'policy_acknowledgment',
  description:
    'A user acknowledged a SAM policy (PolicyAcknowledgment row inserted).',
  payloadSchema: z.object({
    acknowledgmentId: z.string().uuid(),
    tenantId: z.string().uuid(),
    policyId: z.string().min(1),
    userId: z.string().min(1),
    version: z.number().int().nullable(),
    acknowledgedAt: z.string().datetime(),
  }),
});

// ─── 3. incident.reported@v1 ────────────────────────────────────────────────
// Fired when a QualityIncident row is created via POST
// /api/quality/incidents. `description` is intentionally excluded — staff
// routinely paste PHI (patient IDs, room numbers, names) into incident
// narratives. `location` is also excluded — facility room labels can map
// to specific patients in small departments. Only the row identity, the
// type/severity/status enums, and the encounter scope (an opaque ID, no
// patient detail) reach the event bus.
registerEventType({
  eventName: 'incident.reported',
  version: 1,
  aggregate: 'quality_incident',
  description:
    'A quality / safety incident was reported (QualityIncident row created in OPEN status).',
  payloadSchema: z.object({
    incidentId: z.string().uuid(),
    tenantId: z.string().uuid(),
    type: z.string().min(1),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    status: z.literal('OPEN'),
    encounterCoreId: z.string().uuid().nullable(),
    reportedAt: z.string().datetime(),
  }),
});
