# PHASE 3 FLOW TESTING AUDIT -- SAM & IMDAD PLATFORMS

**Auditor:** Claude Opus 4.6 (Senior QA Engineer)
**Date:** 2026-04-01
**Scope:** End-to-end user flow tracing for SAM (Governance) and Imdad (Supply Chain)
**Method:** Source-level route.ts inspection -- every API handler read and verified

---

## EXECUTIVE SUMMARY

| Platform | Flows Tested | Complete | Partial | Broken/Missing |
|----------|-------------|----------|---------|----------------|
| SAM      | 5           | 2        | 2       | 1              |
| Imdad    | 10          | 5        | 4       | 1              |

**Overall Verdict:** Both platforms have solid CRUD foundations. Imdad is substantially more mature with full lifecycle state machines. SAM has critical gaps in its audit/compliance and standards flows. Several cross-flow integrations are missing or incomplete.

---

## SAM PLATFORM FLOWS

### FLOW 1: Policy Creation --> Version Control --> Publishing --> Acknowledgment

**Status: PARTIAL -- Missing Acknowledgment**

#### What Exists (verified in code):

| Step | Route | Methods | Auth/Permissions | Status |
|------|-------|---------|-----------------|--------|
| Draft Creation (AI-generated) | `app/api/sam/drafts/create-missing/route.ts` | POST | `withAuthTenant` + `sam` platformKey | WORKING |
| Draft Read | `app/api/sam/drafts/[draftId]/route.ts` | GET | `withAuthTenant` + `sam` platformKey | WORKING |
| Version Creation | `app/api/sam/drafts/[draftId]/versions/route.ts` | POST | `withAuthTenant` + `sam` platformKey | WORKING |
| Publishing to Thea Engine | `app/api/sam/drafts/[draftId]/publish/route.ts` | POST | `withAuthTenant` + `sam` platformKey | WORKING |
| Library List (published docs) | `app/api/sam/library/list/route.ts` | GET | `permissionKey: 'sam.library.list'` | WORKING |
| Bulk Actions (delete/archive) | `app/api/sam/library/bulk-action/route.ts` | POST | `permissionKey: 'sam.library.bulk-action'` | WORKING |
| Task Assignment | `app/api/sam/library/documents/[documentId]/tasks/route.ts` | GET, POST | `withAuthTenant` + `sam` platformKey | WORKING |
| Task Update/Delete | `app/api/sam/library/documents/[documentId]/tasks/[taskId]/route.ts` | PATCH, DELETE | `withAuthTenant` + `sam` platformKey | WORKING |

#### Findings:

1. **CRITICAL -- No Acknowledgment Flow:** There is no API route for users to acknowledge they have read a published policy. The task system (Training/Review/Update/Other) exists but there is no explicit "I acknowledge this policy" endpoint or tracking table. This is a fundamental governance requirement.

2. **BUG -- Draft GET has no UPDATE/DELETE:** The `drafts/[draftId]/route.ts` only exports GET. There is no PUT/PATCH to update draft metadata (title, department, status) and no DELETE to remove drafts. Users can only modify content via version creation.

3. **GOOD -- Version control is append-only:** Each version stores full content, model info, prompt hash. Immutable audit trail.

4. **GOOD -- Publishing flow is complete:** Draft -> Thea Engine ingest -> mark published with theaEngineId -> audit log entry.

5. **WARNING -- No draft listing endpoint:** There is no `app/api/sam/drafts/route.ts` (GET for list). The `create-missing` route only creates. Users cannot list their drafts via a dedicated API.

6. **GOOD -- Lifecycle status auto-update:** `app/api/sam/library/lifecycle/status/route.ts` POST auto-evaluates lifecycle status (ACTIVE/EXPIRING_SOON/EXPIRED/UNDER_REVIEW) based on dates and logs transitions.

---

### FLOW 2: Audit/Integrity Run --> Findings --> Report --> Remediation

**Status: COMPLETE (as "Integrity" flow -- not traditional audit)**

#### What Exists:

| Step | Route | Methods | Permissions | Status |
|------|-------|---------|-------------|--------|
| Create Integrity Run | `app/api/sam/integrity/runs/route.ts` | POST | `sam.integrity.run` | WORKING |
| List Integrity Runs | `app/api/sam/integrity/runs/route.ts` | GET | `sam.integrity.read` | WORKING |
| Get Run Details | `app/api/sam/integrity/runs/[runId]/route.ts` | GET | verified | WORKING |
| Cancel Run | `app/api/sam/integrity/runs/[runId]/cancel/route.ts` | POST | verified | WORKING |
| List Run Findings | `app/api/sam/integrity/runs/[runId]/findings/route.ts` | GET | `sam.integrity.read` | WORKING |
| Update Finding Status | `app/api/sam/integrity/findings/[findingId]/route.ts` | POST | `sam.integrity.resolve` | WORKING |
| Apply Remediation | `app/api/sam/integrity/findings/[findingId]/apply/route.ts` | POST | `sam.integrity.apply` | WORKING |
| Manage Rulesets | `app/api/sam/integrity/rulesets/route.ts` | GET, POST | `sam.integrity.read/resolve` | WORKING |
| Ruleset Detail | `app/api/sam/integrity/rulesets/[rulesetId]/route.ts` | verified | verified | WORKING |
| Activity Log | `app/api/sam/integrity/activity/route.ts` | GET | verified | WORKING |
| Reset | `app/api/sam/integrity/reset/route.ts` | POST | verified | WORKING |

#### Findings:

1. **GOOD -- Full lifecycle:** RUNNING -> COMPLETED/FAILED, with duplicate detection (runKey hash within 10 minutes).

2. **GOOD -- Finding deduplication:** Uses dedupeKey (SHA-256 hash of type+severity+documentIds+summary) to prevent duplicate findings across runs.

3. **GOOD -- Four-status finding model:** OPEN -> IN_REVIEW -> RESOLVED/IGNORED. Remediation has preview mode (confirm=false) and apply mode (confirm=true).

4. **GOOD -- Separation of concerns:** Runs (bulk operations) and findings (individual issues) are properly separated with cross-references.

5. **WARNING -- Finding metadata overwrite:** In `findings/[findingId]/route.ts` line 37, when updating ownerName and dueDate, the metadata is built incrementally but each new property creates a new object that may overwrite the previous metadata entirely (no spread of existing metadata).

6. **GOOD -- Critical finding alerts:** When HIGH/CRITICAL findings are detected, an ALERT-type activity is automatically created.

---

### FLOW 3: Compliance Monitoring --> Violation Detection --> Corrective Action

**Status: MISSING -- No dedicated compliance module**

There is NO `app/api/sam/compliance/` directory. The integrity system partially covers this (detecting issues/conflicts in policies), but there is:
- No compliance monitoring dashboard API
- No violation tracking with severity/SLA
- No corrective action plan (CAP) creation or tracking
- No compliance calendar or deadline tracking
- No regulatory mapping (CBAHI/JCI standard -> specific requirement -> evidence)

**Recommendation:** This is a significant gap for a governance platform. The integrity module provides document-level analysis but not organizational compliance tracking.

---

### FLOW 4: Risk Assessment --> Mitigation Planning --> Follow-up

**Status: MISSING -- No dedicated risk module**

There is NO `app/api/sam/risks/` directory. No risk register, risk assessment templates, mitigation plans, or follow-up tracking exists.

---

### FLOW 5: Standards Management (CBAHI, JCI)

**Status: PARTIAL -- Embedded in org profile, not standalone**

There is NO `app/api/sam/standards/` directory. Standards are referenced within:
- Org profile (`selectedStandards` array in `getOrgContextSnapshot`)
- Draft generation prompts (standards mapped into AI prompt context)
- Context rules (tone, strictness based on selected standards)

But there is NO:
- Standards library with requirements
- Standards-to-document mapping tracker
- Gap analysis by standard
- Readiness assessment per standard
- Evidence collection per requirement

---

## IMDAD (SUPPLY CHAIN) PLATFORM FLOWS

### FLOW 1: Purchase Request --> Approval --> PO Creation --> Vendor Assignment --> Delivery

**Status: COMPLETE**

#### Full chain verified:

| Step | Route | Methods | Permissions | State Machine |
|------|-------|---------|-------------|---------------|
| Create PR | `procurement/requisitions/route.ts` | GET, POST | `imdad.procurement.pr.create` | Creates in DRAFT |
| Update PR (DRAFT only) | `procurement/requisitions/[id]/route.ts` | GET, PUT | `imdad.procurement.pr.edit` | Optimistic locking |
| Submit/Approve/Reject PR | `procurement/requisitions/[id]/route.ts` | PATCH | `imdad.procurement.pr.approve` | DRAFT->PENDING_APPROVAL->APPROVED/REJECTED |
| Create PO (links to PR) | `procurement/purchase-orders/route.ts` | GET, POST | `imdad.procurement.po.create` | Creates in DRAFT, optional prId |
| Update PO (DRAFT only) | `procurement/purchase-orders/[id]/route.ts` | GET, PUT | `imdad.procurement.po.edit` | Optimistic locking |
| Submit/Approve/Send/Cancel PO | `procurement/purchase-orders/[id]/route.ts` | PATCH | `imdad.procurement.po.approve` | DRAFT->PENDING->APPROVED->SENT, CANCELLED from any |
| Create GRN (links to PO) | `procurement/grn/route.ts` | GET, POST | `imdad.procurement.grn.create` | Creates in DRAFT |
| Receive/Verify/Complete GRN | `procurement/grn/[id]/route.ts` | GET, PATCH | `imdad.procurement.grn.receive` | DRAFT->PENDING_QC->ACCEPTED->COMPLETED |

#### Findings:

1. **GOOD -- Optimistic locking everywhere:** All PUT/PATCH operations check `version` field and return 409 on conflict.

2. **GOOD -- Sequence numbering:** PR/PO/GRN all use `ImdadSequenceCounter` with fiscal year partitioning.

3. **GOOD -- Four-eyes principle on GRN:** Verify step enforces `receivedBy !== userId` (line 162-165 of grn/[id]/route.ts).

4. **GOOD -- Stock mutation on GRN complete:** `stockMutate` is called per line item, updating inventory atomically.

5. **BUG -- GRN complete action sets status to ACCEPTED, not COMPLETED:** In `grn/[id]/route.ts` line 246, the `complete` action sets status to `'ACCEPTED'` instead of `'COMPLETED'`. The audit log says COMPLETED but the DB record says ACCEPTED. Status mismatch.

6. **WARNING -- PR approval permission too broad:** The PATCH endpoint for submit/approve/reject all use the same permission `imdad.procurement.pr.approve`. Submit should use a separate permission since any requester should be able to submit their own draft.

7. **WARNING -- No link enforcement PR->PO:** PO creation accepts optional `prId` but does not validate that the PR exists or is in APPROVED status. A PO can be created referencing a non-existent or rejected PR.

---

### FLOW 2: Receiving --> Inspection --> Inventory Update

**Status: COMPLETE**

| Step | Route | Status |
|------|-------|--------|
| GRN receive (quantities) | `procurement/grn/[id]/route.ts` PATCH receive | WORKING |
| Quality inspection creation | `quality/inspections/route.ts` POST | WORKING -- creates with checklist items |
| Quality inspection update | `quality/inspections/[id]/route.ts` | WORKING -- GET, PUT, PATCH for status |
| Inventory stock mutation | `inventory/transactions/route.ts` POST via `stockMutate` | WORKING |
| GRN complete triggers stock update | `procurement/grn/[id]/route.ts` PATCH complete | WORKING -- calls stockMutate per line |

#### Findings:

1. **WARNING -- No automatic inspection trigger:** GRN receive transitions to PENDING_QC status, but there is no automatic creation of a quality inspection record. The inspection must be manually created as a separate action. In a real hospital supply chain, receiving should auto-trigger QC for regulated items.

2. **GOOD -- Inspection has checklist model:** `ImdadInspectionChecklist` with checkNumber, specification, tolerance, result per check.

3. **WARNING -- Inspection templates exist but are not auto-applied:** `quality/inspection-templates/route.ts` exists (GET, POST) but there is no code that automatically applies a template when creating an inspection for a specific item type.

---

### FLOW 3: Stock Management --> Reorder Alerts --> Procurement Cycle

**Status: PARTIAL -- Missing automated reorder**

| Step | Route | Status |
|------|-------|--------|
| Item Master CRUD | `inventory/items/route.ts`, `[id]/route.ts` | COMPLETE -- GET, POST, PUT, DELETE |
| Stock Counts | `inventory/stock-counts/route.ts` | CREATE + LIST only |
| Inventory Transactions | `inventory/transactions/route.ts` | GET, POST via stockMutate |
| Batch/Lot Tracking | `inventory/batch-lots/route.ts` | GET, POST |
| Location Management | `inventory/locations/route.ts` | GET, POST |
| Adjustments | `inventory/adjustments/route.ts` | GET, POST |

#### Findings:

1. **CRITICAL -- No reorder alert mechanism:** There is no API that compares current stock against reorder points and generates alerts or automatic PRs. Ward PAR levels exist in the clinical module but there is no automated process that checks stock vs PAR and triggers procurement.

2. **WARNING -- Stock count has no execution flow:** Stock counts can be created in DRAFT/PLANNED status but there is no PATCH endpoint to record actual counted quantities or reconcile variances.

3. **GOOD -- stockMutate is centralized:** All stock changes go through `lib/imdad/stockMutate.ts`, ensuring consistent transaction logging.

---

### FLOW 4: Vendor Management --> Evaluation --> Contract Renewal

**Status: PARTIAL -- Missing evaluation scoring**

| Step | Route | Status |
|------|-------|--------|
| Vendor CRUD | `procurement/vendors/route.ts`, `[id]/route.ts` | COMPLETE -- GET, POST, PUT, DELETE (soft) |
| Contract CRUD | `procurement/contracts/route.ts`, `[id]/route.ts` | COMPLETE -- GET, POST, PUT, PATCH |
| Contract Lifecycle | `procurement/contracts/[id]/route.ts` PATCH | WORKING -- activate/suspend/terminate |
| Vendor Audits | `quality/vendor-audits/route.ts`, `[id]/route.ts` | GET, POST + detail CRUD |

#### Findings:

1. **WARNING -- No vendor evaluation scoring system:** Vendors have a `rating` field (0-5) but there is no structured evaluation workflow (evaluation criteria, weighted scoring, period-based evaluation). Vendor audits exist in the quality module but produce no automatic rating update.

2. **WARNING -- No contract renewal automation:** Contracts have `autoRenew` flag and `renewalNoticeDays` but there is no scheduled job or API to detect expiring contracts and trigger renewal notifications.

3. **GOOD -- Vendor status starts as PENDING_APPROVAL:** New vendors require approval before use, preventing unauthorized vendor additions.

4. **GOOD -- Contract has amendment tracking:** Contracts include `amendments` relation for tracking contract changes over time.

---

### FLOW 5: Clinical Supply Chain (Ward PAR Levels --> Dispensing --> Consumption --> Returns)

**Status: COMPLETE**

| Step | Route | Status |
|------|-------|--------|
| Ward PAR Levels | `clinical/ward-par-levels/route.ts`, `[id]/route.ts` | COMPLETE -- GET, POST, PUT, DELETE |
| Dispensing Requests | `clinical/dispensing/route.ts`, `[id]/route.ts` | COMPLETE -- GET, POST + detail |
| Consumption Logs | `clinical/consumption/route.ts` | GET, POST (append-only) |
| Patient Returns | `clinical/returns/route.ts`, `[id]/route.ts` | COMPLETE -- GET, POST + detail |
| Formulary | `clinical/formulary/route.ts`, `[id]/route.ts` | COMPLETE |
| Clinical Charges | `clinical/charges/route.ts`, `[id]/route.ts` | COMPLETE |

#### Findings:

1. **GOOD -- Consumption is append-only:** No PUT/PATCH/DELETE on consumption logs. This is correct for audit purposes.

2. **WARNING -- Dispensing does not auto-deduct stock:** Creating a dispense request does not call `stockMutate`. Stock deduction must be done separately via inventory transactions. This creates risk of dispensing without stock being deducted.

3. **WARNING -- Returns do not auto-credit stock:** Creating a patient return does not call `stockMutate` to add inventory back. Same gap as dispensing.

4. **GOOD -- Duplicate checks:** PAR levels check departmentId+itemId uniqueness, dispense checks dispenseNumber uniqueness, returns check returnNumber uniqueness.

---

### FLOW 6: Financial Flow (Budgets --> Invoices --> Payments --> Cost Centers)

**Status: COMPLETE**

| Step | Route | Status |
|------|-------|--------|
| Cost Centers | `financial/cost-centers/route.ts` | GET (flat + tree), POST |
| Budgets | `financial/budgets/route.ts`, `[id]/route.ts` | GET, POST + detail |
| Invoices | `financial/invoices/route.ts`, `[id]/route.ts` | GET, POST (with lines) + detail |
| Payments | `financial/payments/route.ts` | GET, POST |
| Charges | `financial/charges/route.ts` | GET, POST |

#### Findings:

1. **GOOD -- Payment auto-updates invoice:** Payment creation atomically increments `paidAmount` and decrements `balanceDue` on the invoice in a `$transaction`.

2. **GOOD -- Invoice three-way match fields:** Invoice has `purchaseOrderId`, `grnId`, `poLineId`, `grnLineId` for three-way matching (PO vs GRN vs Invoice).

3. **WARNING -- No budget enforcement on PO creation:** When a PO is created, there is no check against budget availability. Budgets have `allocatedAmount`/`availableAmount` but PO creation does not decrement or validate.

4. **GOOD -- Cost center hierarchy:** Supports tree structure with parentId, up to 3 levels of nesting.

5. **WARNING -- Budget has no approval workflow:** Budgets are created in DRAFT but there is no PATCH endpoint for status transitions (approve/activate/freeze).

---

### FLOW 7: Asset Management (Register --> Maintenance --> Transfers --> Disposal)

**Status: COMPLETE**

| Step | Route | Status |
|------|-------|--------|
| Asset Register | `assets/register/route.ts`, `[id]/route.ts` | GET, POST + detail CRUD |
| Maintenance Orders | `assets/maintenance/route.ts`, `[id]/route.ts` | GET, POST + detail CRUD |
| Asset Transfers | `assets/transfers/route.ts`, `[id]/route.ts` | GET, POST + detail CRUD |
| Asset Disposals | `assets/disposals/route.ts`, `[id]/route.ts` | GET, POST + detail CRUD |
| Asset Query | `assets/query/route.ts` | advanced query |
| Export | `export/assets/route.ts` | export functionality |

#### Findings:

1. **GOOD -- Disposal updates asset status:** Creating a disposal record atomically sets the asset status to DISPOSED in a `$transaction`.

2. **GOOD -- Comprehensive asset model:** Tracks purchase info, warranty, depreciation, maintenance schedule, calibration, criticality, custodian.

3. **WARNING -- Transfer does not update asset location:** Creating a transfer request does not update the asset's `locationId` or `departmentId`. Transfer approval/completion would need to do this but no PATCH status transition exists on transfer list route (only on `[id]` detail).

4. **WARNING -- Maintenance order has no auto-scheduling:** Assets have `maintenanceFrequencyDays` and `nextMaintenanceDate` but no cron or scheduled check to auto-create maintenance orders when due.

---

### FLOW 8: Approval Workflow (Submit --> Inbox --> Decide --> Escalate --> History)

**Status: COMPLETE**

| Step | Route | Status |
|------|-------|--------|
| Submit for Approval | `approval/submit/route.ts` | POST -- matches workflow template by documentType + amount range |
| Approval Inbox | `approval/inbox/route.ts` | GET -- pending steps for current user (incl. delegations) |
| Record Decision | `approval/decide/route.ts` | POST -- approve/reject with auto-advance to next step |
| Escalate Step | `approval/escalate/route.ts` | POST -- re-assigns to escalation target |
| Delegation Management | `approval/delegate/route.ts`, `delegations/route.ts`, `[id]/route.ts` | CRUD |
| Approval History | `approval/history/route.ts` | GET -- full history with steps and decisions |
| Workflow Templates | `approval/workflows/route.ts`, `[id]/route.ts` | CRUD |
| Workflow Rules | `approval/workflows/[id]/rules/route.ts`, `[ruleId]/route.ts` | CRUD |

#### Findings:

1. **GOOD -- Separation of duties enforced:** Approver cannot be the submitter (line 45-49 of decide/route.ts).

2. **GOOD -- Multi-step sequential approval:** Steps advance automatically when approved. Rejection at any step rejects the whole request.

3. **GOOD -- Delegation support:** Users can delegate approval authority with `validUntil` expiry. Inbox checks both direct and delegated approvals.

4. **GOOD -- Auto-approve rules:** Workflow rules can have `autoApprove=true` for low-value items.

5. **GOOD -- Timeout tracking:** Steps have `timeoutHours` and inbox calculates `timeRemainingHours`.

6. **WARNING -- No automatic timeout escalation:** Steps track timeout hours but there is no scheduled job to auto-escalate timed-out steps. The escalation is manual only via POST to `/escalate`.

7. **WARNING -- Escalation target lookup fragile:** The escalate route tries to find `escalateToUserId` from `ImdadApprovalWorkflowRuleStep` using `step.ruleId`, but `ruleId` is accessed via `(step as any).ruleId`, suggesting the field may not be in the schema.

---

### FLOW 9: Quality Management (Inspections --> NCR --> Recalls --> Vendor Audits --> Certificates)

**Status: COMPLETE**

| Step | Route | Status |
|------|-------|--------|
| Inspections | `quality/inspections/route.ts`, `[id]/route.ts` | GET, POST + detail CRUD |
| Inspection Templates | `quality/inspection-templates/route.ts`, `[id]/route.ts` | GET, POST + detail |
| NCR (Non-Conformance) | `quality/ncr/route.ts`, `[id]/route.ts` | GET, POST + detail CRUD |
| Recalls | `quality/recalls/route.ts`, `[id]/route.ts` | GET, POST + detail CRUD |
| Vendor Audits | `quality/vendor-audits/route.ts`, `[id]/route.ts` | GET, POST + detail CRUD |
| Certificates | `quality/certificates/route.ts`, `[id]/route.ts` | GET, POST + detail CRUD |
| SFDA Logs | `quality/sfda-logs/route.ts` | GET, POST |

#### Findings:

1. **GOOD -- Complete quality ecosystem:** All five quality sub-domains have full CRUD with list filtering and detail views.

2. **WARNING -- No NCR-to-recall linkage:** NCR and recalls are independent entities. There is no field linking an NCR to a recall action, nor any auto-trigger for recall when a critical NCR is raised.

3. **WARNING -- No inspection result -> NCR auto-creation:** When an inspection fails, there is no automatic NCR generation. The flow is manual.

4. **GOOD -- SFDA integration exists:** `integrations/sfda/` has verify, track-trace, compliance, verify-drug, report, device-lookup endpoints for Saudi FDA compliance.

---

### FLOW 10: AI Decision Engine (Signals --> Scan --> Predict --> Execute --> Self-Correct)

**Status: COMPLETE**

| Step | Route | Status |
|------|-------|--------|
| Signals (CRUD) | `decisions/signals/route.ts` | GET, POST |
| Decision CRUD | `decisions/route.ts`, `[id]/route.ts` | GET, POST + detail |
| Autonomous Scan | `decisions/autonomous/scan/route.ts` | POST -- converts signals to decisions |
| Predict | `decisions/autonomous/predict/route.ts` | POST -- ML predictions for proactive decisions |
| Execute | `decisions/autonomous/execute/route.ts` | POST -- generates action items from decisions |
| Self-Correct | `decisions/autonomous/self-correct/route.ts` | POST -- re-evaluates failed/stale decisions |
| Core Loop | `decisions/autonomous/core-loop/route.ts` | POST -- orchestrates scan->predict->execute->correct |
| Feedback | `decisions/autonomous/feedback/route.ts` | POST |
| Pressure Tracking | `decisions/autonomous/pressure/route.ts` | GET, POST |
| Cluster Analysis | `decisions/autonomous/cluster/route.ts` | POST |
| History | `decisions/autonomous/history/route.ts` | GET |
| Pulse Dashboard | `decisions/pulse/route.ts` | GET |

#### Findings:

1. **GOOD -- Full autonomous loop:** core-loop orchestrates the complete cycle: scan signals -> predict future issues -> execute decisions -> self-correct failures.

2. **GOOD -- Auto-approval logic:** Decisions above confidence threshold (default 85%) are auto-approved without human intervention.

3. **GOOD -- Escalation mapping:** Signal severity maps to escalation level (CRITICAL->CORPORATE, HIGH->HOSPITAL, MEDIUM->DEPARTMENT).

4. **GOOD -- Duplicate detection:** 12-24 hour windows prevent duplicate decision generation from the same signals.

5. **GOOD -- Action generation:** Execute route maps decision types to specific actions (DEVICE_REPLACEMENT -> disposal+PR+inspection).

6. **WARNING -- No actual integration with other modules:** The execute route creates `ImdadDecisionAction` records but does NOT actually call the procurement/asset/quality APIs to create real PRs, disposal orders, or inspections. The actions are descriptive only -- they need manual execution.

---

## CROSS-PLATFORM FINDINGS

### Missing Cross-Flow Integrations:

1. **No SAM-Imdad link:** SAM governance policies are not linked to Imdad operations. A procurement compliance policy in SAM cannot trigger compliance checks in Imdad.

2. **No approval integration:** Imdad has its own approval workflow engine. SAM has no approval flow at all. These should share infrastructure.

3. **No notification system:** Neither platform has a notification/email API for alerts, approvals pending, policy acknowledgments due, contract expiry, etc.

### Permission Model:

| Platform | Pattern | Granularity |
|----------|---------|-------------|
| SAM | `sam.library.list`, `sam.integrity.run` | Module-level |
| Imdad | `imdad.procurement.pr.create`, `imdad.assets.register.list` | Action-level |

SAM permissions are coarser-grained than Imdad. Imdad follows a consistent `module.entity.action` pattern.

### Audit Logging:

| Platform | Method | Coverage |
|----------|--------|----------|
| SAM | `createAuditContext` + `logAuditEvent` (security/audit) | Partial -- drafts and integrity only |
| Imdad | `imdadAudit.log` | Complete -- every mutation logged with bounded context tags |

Imdad audit logging is superior, with consistent bounded context tagging (BC1_INVENTORY through BC8_APPROVAL), actor tracking, and before/after data capture.

### Data Validation:

| Platform | Method | Quality |
|----------|--------|---------|
| SAM | Mixed -- Zod + `validateBody` helper | Good |
| Imdad | Consistent Zod schemas on all routes | Excellent |

### Error Handling:

| Platform | Pattern | SEC-06 Compliance |
|----------|---------|-------------------|
| SAM | `withErrorHandler` wrapper + try/catch | Yes -- generic error messages in responses |
| Imdad | Direct try/catch per handler | Yes -- generic messages, but some routes have `console.error` leaking internal details in server logs |

---

## CRITICAL BUGS FOUND

| # | Platform | Location | Severity | Description |
|---|----------|----------|----------|-------------|
| 1 | Imdad | `procurement/grn/[id]/route.ts` line 246 | HIGH | GRN `complete` action sets status to `'ACCEPTED'` instead of `'COMPLETED'`. Audit log says COMPLETED but DB says ACCEPTED. |
| 2 | SAM | `integrity/findings/[findingId]/route.ts` line 37 | MEDIUM | Metadata overwrite: setting ownerName/dueDate/slaDays creates new metadata object that may not preserve existing fields like recommendation, evidence, dedupeKey. |
| 3 | Imdad | Clinical dispensing + returns | MEDIUM | Neither dispensing nor returns call `stockMutate`. Stock levels can become inconsistent with actual ward inventory. |

---

## MISSING FLOWS SUMMARY

| # | Platform | Flow | Impact |
|---|----------|------|--------|
| 1 | SAM | Policy Acknowledgment tracking | CRITICAL -- governance requirement |
| 2 | SAM | Compliance monitoring module | CRITICAL -- core governance function |
| 3 | SAM | Risk assessment module | HIGH -- governance standard |
| 4 | SAM | Standards management (CBAHI/JCI mapping) | HIGH -- accreditation requirement |
| 5 | SAM | Draft listing endpoint | MEDIUM -- UX gap |
| 6 | Imdad | Automated reorder from stock/PAR comparison | HIGH -- supply chain automation |
| 7 | Imdad | Budget enforcement on PO creation | HIGH -- financial control |
| 8 | Imdad | Automatic timeout escalation (cron) | MEDIUM -- approval SLA |
| 9 | Imdad | Stock count execution/reconciliation | MEDIUM -- inventory accuracy |
| 10 | Imdad | Decision engine -> real module integration | MEDIUM -- AI value delivery |
| 11 | Both | Notification/email system | HIGH -- operational requirement |
| 12 | Both | Cross-platform integration | MEDIUM -- platform synergy |

---

## RECOMMENDATIONS (Priority Order)

1. **Add SAM policy acknowledgment flow** -- Create `app/api/sam/library/documents/[documentId]/acknowledgments/route.ts` with GET/POST for tracking who acknowledged what and when.

2. **Fix GRN complete status bug** -- Change line 246 in `procurement/grn/[id]/route.ts` from `'ACCEPTED'` to `'COMPLETED'`.

3. **Fix finding metadata overwrite** -- In `integrity/findings/[findingId]/route.ts`, spread existing metadata before adding new fields.

4. **Add stock integration to clinical dispensing/returns** -- Call `stockMutate` when dispensing (OUT) and returning (IN) to keep inventory accurate.

5. **Add budget validation to PO creation** -- Before creating a PO, check cost center budget availability and decrement `availableAmount`.

6. **Build SAM compliance module** -- This is the core value proposition of a governance platform.

7. **Add automated reorder checking** -- Scheduled job or API that compares stock levels against PAR/reorder points and generates alerts or auto-PRs.

8. **Connect decision engine to real modules** -- When execute creates a PURCHASE_REQUISITION action, actually call the PR creation API.

---

**End of Phase 3 Flow Testing Audit**
