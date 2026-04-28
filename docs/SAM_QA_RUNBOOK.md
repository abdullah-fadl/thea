# SAM QA Runbook (v1.0)

This runbook validates the organization-first, task-first SAM experience end-to-end.

## SAM v1.0 is frozen (scope locked)
As of **2026-01-21**, SAM v1.0 scope is frozen. Any new behavior/UI changes should be treated as a **new Phase / expansion**, not a v1.0 patch.

Included in v1.0:
- Organization context setup + guard + context header
- Context rules snapshotting and inclusion in policy-engine gateway requests
- `/sam/home` Work Queues + deep links into execution views
- Queue actions with audit events (ack/resolve/snooze/assign)
- Draft creation (create-missing), reuse-from-group (when enabled), draft versioning, publish-to-Library, all auditable

## Preconditions
- App running (`yarn dev`) and policy-engine running (if testing publish/ingest).
- Tenant has SAM entitlement.
- You can sign in as a user with SAM access (admin recommended).

## Happy path (recommended smoke test)

### 1) Organization context
1. Navigate to `/sam`.
2. If redirected to `/sam/setup`, complete setup and save.
3. Confirm the **context header** shows org type + standards + phase.
4. Confirm audit event is written: `org_profile_updated`.

### 2) Work Queues
1. Navigate to `/sam/home`.
2. Confirm all 5 queues render with counts.
3. Select a department filter (if departments exist) and confirm counts change.
4. Confirm queue cards show preview items with **Open** links.

### 3) Queue actions (audited)
1. From **High-Risk Gaps** or **Conflicts to Review**, click **Ack**.
2. Confirm queue refreshes and the item count decreases (or moves state).
3. Confirm audit event is written: `queue_item_ack`.
4. Repeat for **Resolve** and **Snooze** (if present) and confirm:
   - audit events: `queue_item_resolve`, `queue_item_snooze`.
5. From **My Tasks**, click **Assign to me** if shown.
6. Confirm audit event is written: `queue_item_assign` with `assigneeUserId`.

### 4) Create missing → draft
1. From **Required / Missing**, click **Create missing**.
2. Confirm a new draft opens at `/sam/drafts/:draftId`.
3. Confirm audit event is written: `draft_created`.

### 5) Draft versioning (audited)
1. In the draft editor, change content.
2. Click **Save new version**.
3. Confirm version number increments.
4. Confirm audit event is written: `draft_version_created`.

### 6) Publish-to-Library (audited)
1. From the draft view, click **Publish to Library**.
2. Confirm you land in Library and the new document is visible.
3. Confirm the draft now shows `status=published` and has `publishedPolicyEngineId`.
4. Confirm audit event is written: `draft_published`.

### 7) Reuse from group (only if org is part of group)
1. Ensure org profile has `isPartOfGroup=true` and `groupId` set.
2. From **Required / Missing**, click **Reuse from group**.
3. Select a group document and reuse with optional adaptation notes.
4. Confirm draft is created and audit event is written: `draft_reused_from_group`.

## Edge cases / failure modes

### Policy engine unavailable
- Expected:
  - Publishing fails with a clear error toast.
  - Draft remains `status=draft`.
  - No partial library write is performed.

### OpenAI key missing / generation fails
- Expected:
  - Create missing draft fails with error response.
  - No draft record is created.

### Tenant not part of group
- Expected:
  - Reuse-from-group action does not appear.
  - `/sam/group-library` shows “not enabled”.

### Permissions / auth issues
- Expected:
  - Unauthenticated users redirect to `/login`.
  - Non-entitled tenants redirect to `/platforms?reason=not_entitled&platform=sam`.

## Audit verification (where to look)
Audit events are written through `lib/security/audit.ts` (`audit_logs`).
Key actions:
- `org_profile_updated`
- `queue_item_ack`, `queue_item_resolve`, `queue_item_snooze`, `queue_item_assign`
- `draft_created`, `draft_version_created`, `draft_reused_from_group`, `draft_published`

## Known repo-wide QA blockers (not SAM-specific)
These issues may affect repo-wide CI/local QA runs, but they are **not** SAM v1.0 defects:
- **ESLint**: `yarn lint` can fail due to a **circular JSON** parse error in `.eslintrc.json` (pre-existing config issue).
- **Unit tests**: `yarn test:unit` can fail due to a **timezone-dependent** unit test (pre-existing; unrelated to SAM flows). If needed for consistent runs, force UTC (e.g., `TZ=UTC`) or update the affected test to be timezone-agnostic.

## Tenant clean-slate reset (admin/dev-only)
If you clear policies/drafts but queues still show findings, it’s because historical `integrity_runs` / `integrity_findings` remain.

- **Endpoint**: `POST /api/sam/integrity/reset`
- **Access**: admin-only, and enabled only when `NODE_ENV=development` **or** `SAM_ENABLE_TENANT_RESET=true`
- **Body**:
  - `mode`: `"archive"` (default) or `"delete"`
  - `reason`: optional string
- **Expected result**: `/sam/home` queues drop to **0** (archived records are excluded from queues)

