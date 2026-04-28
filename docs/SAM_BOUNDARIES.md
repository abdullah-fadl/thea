# SAM Boundaries (v1.0, frozen)

## SAM v1.0 freeze (scope locked)
As of **2026-01-21**, SAM v1.0 scope is frozen. Any new work should be treated as a **new Phase / expansion**.

## What SAM is
- **Organization-first governance assistant**: behavior is driven by the tenant’s organization profile + context rules.
- **Task-first**: primary UX starts from Work Queues; Library/Conflicts are execution views.
- **Deterministic + auditable orchestration**: key actions are recorded in audit logs with actor + time + identifiers.
- **Draft-first authoring**: creation flows produce drafts with explicit versioning and audit.

## What SAM is not (yet)
- A fully automated compliance engine that can “certify” compliance or guarantee correctness.
- A substitute for legal/regulatory review.
- A workflow engine for approvals/signatures (publish is minimal and should be reviewed).
- A source of truth for uploaded file storage (policy-engine owns file ingestion/indexing).

## Data ownership boundaries
- **Organization context**: `organization_profiles` (tenant DB, platform-scoped `sam_organization_profiles`)
- **Work queues**: derived/aggregated from existing data; no business logic in UI.
- **Drafts**: `draft_documents` (tenant DB, platform-scoped `sam_draft_documents`)
- **Library documents**:
  - Policy-engine owns: files, OCR, indexing, search
  - Tenant DB owns: metadata, mappings, lifecycle, tasks

## Audit boundaries
SAM writes audit events for:
- Org profile updates
- Queue actions (ack/resolve/snooze/assign)
- Draft lifecycle (created, version created, reused from group, published)

## Safety / guardrails
- Drafts are **suggestions** and must be reviewed before publication/use.
- Context rules can suppress advanced conflict surfacing for new organizations.

