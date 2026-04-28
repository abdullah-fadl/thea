# Project Cleanup Audit
# تدقيق تنظيف المشروع

> Generated 2026-04-27 — read-only audit. No deletions performed, no commits made.
> أُنشئ في 2026-04-27 — تدقيق للقراءة فقط. لم يُحذف شيء ولم يُنشأ commit.

---

## TL;DR / الموجز

- **Clutter level / مستوى الفوضى:** **HIGH / عالٍ** — root is a graveyard of phase docs, the parent worktrees folder still holds 10 stale agent worktrees, CVision has 121 Prisma models for a module that is still 100% MongoDB, and there are 75 local branches.
- **Top 3 wins / أكبر ثلاث مكاسب:**
  1. Delete 23 phase/audit `.md` files at the project root (~720 KB) and the 4 leftover one-off artifacts (`Path.html` 397 KB, `CVision_Dashboard_Final.jsx` 26 KB, `_write_ui.js`, `backend_test.py`). / احذف 23 ملف توثيق مرحلي + 4 ملفات متروكة.
  2. Remove the 10 sibling Claude worktrees in `../../.claude/worktrees/` (only this one is active). / احذف 10 مجلدات worktree متروكة.
  3. Decide CVision's DB story: the 7 cvision-*.prisma files (121 models, ~117 KB) are entirely **unused** by the 246 cvision routes — they all still call `db.collection(…)` Mongo. Either migrate the routes or delete the schemas. / قرّر مستقبل CVision: إما ترحيل الـ 246 route من Mongo إلى Prisma، أو حذف الـ 121 model غير المستخدم.
- **Estimated cleanup hours / الوقت التقديري:** **~14 hours** to reach "spotless" (4h root docs + branches/stashes/worktrees, 2h dependency pruning, 2h dead Prisma fields, 6h CVision schema decision + scrub).
- **Report file:** [docs/cleanup-audit.md](docs/cleanup-audit.md) — written, **uncommitted**.

---

## 1. Root-level stale docs / وثائق متراكمة في الجذر

The project root has **23 historical planning / audit `.md` files** plus several one-off artifact files left over from Cursor / earlier Claude sessions. Total weight: **~720 KB of `.md` clutter + ~470 KB of misc artifacts** that pollute every `ls`, `find`, and editor file-tree view.

| File | Size | Why it's stale | Recommendation |
| --- | ---: | --- | --- |
| [AUDIT_CHECKLIST.md](AUDIT_CHECKLIST.md) | 75 KB | Phase-1/2 audit checklist; superseded by [.claude/audit-report-2026-03-19.md](.claude/audit-report-2026-03-19.md) and [NOTES.md](NOTES.md) | **delete** |
| [AUDIT_DEEP_INFRA.md](AUDIT_DEEP_INFRA.md) | 25 KB | Infra audit from earlier Cursor session | **delete** |
| [AUDIT_FINAL_SUMMARY.md](AUDIT_FINAL_SUMMARY.md) | 30 KB | Already superseded by V2 below | **delete** |
| [AUDIT_FINAL_SUMMARY_V2.md](AUDIT_FINAL_SUMMARY_V2.md) | 21 KB | Superseded by `.claude/FULL_EHR_AUDIT_2026-03-19.md` | **delete** or **move to `docs/archive/`** |
| [AUDIT_PHASE1_UNDERSTANDING.md](AUDIT_PHASE1_UNDERSTANDING.md) | 30 KB | Phase 1 work-product, completed | **delete** |
| [AUDIT_PHASE2_BUGS.md](AUDIT_PHASE2_BUGS.md) | 22 KB | Phase 2 work-product, completed | **delete** |
| [AUDIT_PHASE3_FLOWS_EHR_HR.md](AUDIT_PHASE3_FLOWS_EHR_HR.md) | 31 KB | Phase 3 work-product | **delete** |
| [AUDIT_PHASE3_FLOWS_SAM_IMDAD.md](AUDIT_PHASE3_FLOWS_SAM_IMDAD.md) | 28 KB | Phase 3 work-product | **delete** |
| [AUDIT_PHASE4_MISSING.md](AUDIT_PHASE4_MISSING.md) | 11 KB | Phase 4 work-product | **delete** |
| [AUDIT_PHASE5_SECURITY.md](AUDIT_PHASE5_SECURITY.md) | 14 KB | Phase 5 work-product | **delete** |
| [CLAUDE_PHASE1.md](CLAUDE_PHASE1.md) | 6 KB | Per-phase prompt instructions for Claude — completed phases | **delete** |
| [CLAUDE_PHASE2.md](CLAUDE_PHASE2.md) | 6 KB | Per-phase prompt instructions | **delete** |
| [CLAUDE_PHASE3.md](CLAUDE_PHASE3.md) | 6 KB | Per-phase prompt instructions | **delete** |
| [CLAUDE_PHASE4_5.md](CLAUDE_PHASE4_5.md) | 8 KB | Per-phase prompt instructions | **delete** |
| [PHASE0_PLAN.md](PHASE0_PLAN.md) | 10 KB | Phase 0 plan; we are now mid-phase-8 per branch list | **delete** |
| [PHASE1_PLAN.md](PHASE1_PLAN.md) | 5 KB | Phase 1 plan, completed | **delete** |
| [PHASE2_PLAN.md](PHASE2_PLAN.md) | 3 KB | Phase 2 plan, completed | **delete** |
| [PHASE3_PLAN.md](PHASE3_PLAN.md) | 3 KB | Phase 3 plan, completed | **delete** |
| [PHASE4_5_PLAN.md](PHASE4_5_PLAN.md) | 3 KB | Phase 4/5 plan, completed | **delete** |
| [START_HERE.md](START_HERE.md) | 2 KB | Pointer to phase docs that are themselves stale | **delete** |
| [CVISION_AUDIT_REPORT.md](CVISION_AUDIT_REPORT.md) | 138 KB | Standalone module audit; the largest single MD file in the project | **move to `docs/cvision/AUDIT.md`** if still useful, otherwise delete |
| [TESTING.md](TESTING.md) | 5 KB | Likely overlaps with [docs/E2E_TESTING_SAM.md](docs/E2E_TESTING_SAM.md) etc. | **review and merge into `docs/`** |
| [NOTES.md](NOTES.md) | 155 KB | The active running phase notebook (last touched in commit `68fc803` for phase-7.7.5) — **keep** but consider rotating older sections into `docs/archive/`. | **keep, prune older sections** |
| [CLAUDE.md](CLAUDE.md) | 8 KB | Active project instructions (still references Phase 0!) — **needs an update**: the "Current Mission" is still listed as Phase 0 / Syra cleanup, which is long since complete (we are at Phase 8.x). | **update mission section** |

**Mystery / one-off artifacts at the root:**

| File | Size | Origin | Recommendation |
| --- | ---: | --- | --- |
| [Path.html](Path.html) | **397 KB** | A single 205-line HTML page, no apparent integration | **delete** (huge file, not referenced) |
| [CVision_Dashboard_Final.jsx](CVision_Dashboard_Final.jsx) | 26 KB | Stand-alone JSX file at root, orphaned from `app/(dashboard)/cvision/` | **delete** (active CVision UI lives in `app/(dashboard)/cvision/`) |
| [_write_ui.js](_write_ui.js) | 11 B | One-line file containing literally the word `placeholder` | **delete** |
| [backend_test.py](backend_test.py) | 20 KB | Python smoke test pointing at `https://healthpro-18.preview.emergentagent.com` (an emergent.agent.com URL — likely from the Emergent platform that pre-dates Thea) | **delete** |
| [codemod-report.json](codemod-report.json) | 3 KB | Output of `scripts/codemod-improved-v2.ts` from a one-time auth-wrapper migration | **delete** (rerun the codemod to regenerate if needed) |
| [ui-crawl-results.json](ui-crawl-results.json) / [ui-crawl-results.md](ui-crawl-results.md) | <1 KB | Empty results from a 2026-03-28 UI crawl run (`totalRoutes: 126, passed: 0, failed: 0`) | **delete** (test artifacts; should be `.gitignored`) |
| [ui-routes.json](ui-routes.json) / [ui-routes.meta.json](ui-routes.meta.json) | 22 / 46 KB | Generated by `scripts/generate-ui-routes.ts` (yarn `routes:ui`) | **gitignore + regenerate** (don't commit generated files) |
| [cvision Dark.svg](cvision%20Dark.svg) / [cvision Light.svg](cvision%20Light.svg) | 339 / 760 KB | Brand assets at the project root with spaces in their names | **move to `public/brand/`** |

**Total deletable from root:** ~26 MD files + 8 misc artifacts ≈ **1.5 MB freed**. This is by far the highest-payoff cleanup.

---

## 2. Syra legacy references / مراجع Syra المتبقية

Phase 0 cleanup looks **fully complete**. The grep `-rni "syra"` over `*.{ts,tsx,js,jsx,prisma,md,json}` returns only **3 files**, none of them code:

| File | What it contains | Action |
| --- | --- | --- |
| [CLAUDE.md](CLAUDE.md) | The project instructions file describing the Syra removal *as a goal*. Mission section claims we're still in "Phase 0 — Syra cleanup," which is misleading since it's done. | **Update CLAUDE.md** — remove the Syra section entirely; replace mission with current phase |
| [.claude/audit-report-2026-03-19.md](.claude/audit-report-2026-03-19.md) | Audit report stating "Syra cleanup: 100% complete" | **keep** (historical audit) or **archive** |
| [__tests__/lib/config.test.ts](__tests__/lib/config.test.ts) | A guard test: `expect(configStr).not.toContain('syra')` — actively prevents regression | **keep** ✅ |
| [docs/SYRA_HEALTH_PLATFORM_KNOWLEDGE_BASE_AR.md](docs/SYRA_HEALTH_PLATFORM_KNOWLEDGE_BASE_AR.md) | An Arabic platform knowledge base file that still has "SYRA" in the filename | **rename** to `THEA_HEALTH_PLATFORM_KNOWLEDGE_BASE_AR.md` |

**Verdict:** The codebase itself is clean. The only "Syra"-named live file is the Arabic KB doc with a stale filename. No regression risk.

---

## 3. Git stashes / حالات الـ stash

```
$ git stash list
stash@{0}: On main: wip-pre-phase-4-3
```

Only **one stash** exists in this worktree. The user's note suggested 11+, but those `wip-pre-phase-*` stashes were either dropped, or live in a different clone. Recommend:

| Stash | Inspect | Recommendation |
| --- | --- | --- |
| `stash@{0}` (`wip-pre-phase-4-3`) | Run `git stash show -p stash@{0}` to inspect; if everything from phase-4-3 is now in `phase-4-3-cedar-policy-engine` branch, the stash is redundant | **drop** after one-line inspection |

If the user has another clone with more stashes, the same rule applies: each `wip-pre-phase-N` stash is from before a phase that has since merged → safe to drop after eyeball.

---

## 4. Dead Prisma fields / حقول Prisma غير المستخدمة

### 4.1 Legacy `embedding Json?` column on `SamPolicyChunk` — **confirmed dead**

In [prisma/schema/sam.prisma:53](prisma/schema/sam.prisma:53):

```prisma
model SamPolicyChunk {
  ...
  embedding    Json?                            // <— legacy column
  // Distinct from the legacy `embedding` JSONB column (kept untouched per
  // Phase 7.1 plan) — see comment line 55.
  embeddingVec Unsupported("vector(1536)")?    // <— current column
  ...
}
```

A code search for the name `embedding` (excluding `embeddingVec`) on `SamPolicyChunk` returns **zero application reads/writes** — only the schema declaration. The accompanying comment confirms it was kept for a clean cutover and is now safe to drop.

**Recommendation:** schedule a one-line migration to `DROP COLUMN sam_policy_chunks.embedding;` and remove the field from the schema. Estimate: 15 min.

### 4.2 Edrac entitlement columns — **dead until Edrac ships**

[prisma/schema/core.prisma](prisma/schema/core.prisma) declares these Edrac columns even though the platform has zero schema/routes/UI:

```prisma
Tenant.entitlementEdrac          Boolean @default(false)
User.platformAccessEdrac         Boolean?
TenantEntitlement.enabledEdrac   Boolean @default(false)
TenantEntitlement.allowedPlatforms Json   // includes edrac
```

Plus 16 references across `app/`, `contexts/`, `middleware.ts`, `app/api/owner/…`, `app/admin/…`. They are kept lit because the **owner console** writes to them and the **platforms grid** reads them.

**Recommendation:** see Section 14.5 — keep until product decides on Edrac, but note the dead weight.

### 4.3 Imdad — 41 of 120 models are unreferenced by application code

See Section 5.4 / 14.3 below for the full list. Some are line-item child tables (e.g. `ImdadGoodsReceivingNoteLine`, `ImdadInvoiceLine`) whose Prisma access goes through the parent — those are **false positives** and not actually dead. But several large models (`ImdadDelegationChain`, `ImdadAuditLogPartition`, `ImdadDeviceReplacementPlan`, `ImdadProposalLineItem`, `ImdadPickLine`, `ImdadVendorScorecard`, `ImdadVendorContact`, `ImdadVendorDocument`, `ImdadInspectionChecklist`, `ImdadStockReservation`, `ImdadStockTransaction`, `ImdadRecallAction`, `ImdadReceivingDock`, `ImdadUnitsOfMeasure`, `ImdadUomConversion`) have **zero references anywhere** — they look aspirational.

### 4.4 CVision — entire schema is dead

See Section 14.2. **121 of 121** Prisma models in the seven `cvision-*.prisma` files are unreferenced by the 246 CVision API routes (which all use Mongo `db.collection(…)`). Either the routes need migration or the schemas need deletion.

---

## 5. Dead exports / dead imports / صادرات غير مستخدمة

This category needs more careful per-symbol verification. Conservative findings only:

### 5.1 [core/](core/) at the project root — **duplicate of `lib/core/`**

Three files only:
- [core/rbac/test-accounts.ts](core/rbac/test-accounts.ts)
- [core/rbac/roles.ts](core/rbac/roles.ts)
- [core/brain/ImdadBrain.ts](core/brain/ImdadBrain.ts)

Grep for any import path of `@/core/` or `./core/` returns **zero hits**. Meanwhile `lib/core/` is the live tree (auth, audit, departments, errors, flags, guards, http, models, org, owner). Confidence: high. **Action:** delete `core/` at the root.

### 5.2 [platforms/](platforms/) at the root — template-only, not application code

Contains only `platforms/_template/` (README + example files). The README explicitly says "Copy and adapt; do not import from `platforms/_template/` in application code." Confirmed not imported anywhere. **Action:** keep as scaffold reference, but consider relocating to `docs/platform-template/` so it's clearly documentation, not application code.

### 5.3 Generated routes file

`ui-routes.json` and `ui-routes.meta.json` are generated by `scripts/generate-ui-routes.ts` (per the `yarn routes:ui` script). They should be `.gitignore`d, not committed. Same for everything inside `playwright-report/` and `test-results/`.

### 5.4 Prisma model usage scan results (cross-referenced from `lib/`, `app/`, `scripts/`, `__tests__/`, `simulator/`)

| Platform | Models declared | Models referenced | Models unreferenced |
| --- | ---: | ---: | ---: |
| Imdad   | 120 | 79 | **41** (some are child tables — likely false positives) |
| CVision | 121 |  9 (only `Cvision*` brand names appearing in TS code, **not** as `prisma.cvisionX.method`) | **112** |
| SAM     |  26 | 25 | **1** (`OperationLink` — flagged-only TODO comment in [lib/sam/operationLinks.ts:6](lib/sam/operationLinks.ts:6)) |
| Thea Health (clinical / opd / ipd / er / lab / pharmacy / billing) | ~250 | not yet measured per-model | (clinical platform is heavily live — Mongo→Prisma migration done) |

---

## 6. Duplicate or near-duplicate files / ملفات مكررة

Surprisingly clean. The find sweep for `*Legacy*`, `*-old.*`, `*.bak`, `*.backup`, `*.tmp`, `*.orig`, `*-v2.*`, `*-deprecated*` returned **only one result**:

| File | Status |
| --- | --- |
| [scripts/codemod-improved-v2.ts](scripts/codemod-improved-v2.ts) | The third version (`codemod-apply-auth-wrapper.ts` → `codemod-improved.ts` → `codemod-improved-v2.ts`) of the auth-wrapper codemod. All three are still in `package.json` (`codemod:auth`, `codemod:improved`, `codemod:v2`). One-time scripts that have already executed. **Action:** keep one (`-v2`), delete the older two; or move all three to `scripts/archive/` since the codemod is finished. |

**No `*Legacy.tsx` files remain** — Phase 0 cleanup completed that work.

The `.renderignore` correctly excludes `tests/`, but `tests/` at the project root is just a single empty `__init__.py` (Python) — **delete the whole `tests/` folder**. The active TS test tree is `__tests__/`.

---

## 7. Stale test files / ملفات اختبار قديمة

The whole codebase was actively touched in the last week (the most recent commit is from today, `68fc803`). Last-touched dates per `__tests__/` subdirectory:

| Directory | Last commit | Notes |
| --- | --- | --- |
| `__tests__/lib/` | 2026-04-25 | Active |
| `__tests__/app/` | 2026-04-25 | Active |
| `__tests__/cvision/` | 2026-04-22 | 20 test files all touched at the same commit — likely batch-edited; worth confirming they still match the actual cvision API surface (which is still Mongo, see §14.2) |
| `__tests__/integration/` | 2026-04-22 | Active |
| `__tests__/security/` | 2026-04-22 | Active |
| `__tests__/e2e/` | 2026-04-22 | Active |
| `__tests__/performance/` | 2026-04-22 | Active |
| `__tests__/api/` | 2026-04-22 | Active |
| `__tests__/hl7/` | 2026-04-22 | Active |

**No tests are date-stale.** One file ([__tests__/hl7/adt-processor.test.ts](__tests__/hl7/adt-processor.test.ts)) still references the legacy `'opd_…'` Mongo collection name format — verify whether `adt-processor` itself was migrated. If so, the test references are dead.

The empty [tests/__init__.py](tests/__init__.py) Python file is the only true orphan in test-land.

---

## 8. Console.log / debugger / TODO / FIXME / مخلفات تصحيح

```
console.log + debugger:  38 (lib/ + app/)
FIXME + XXX:             23 (most are placeholder strings like '+966 5XXXX XXXX', not real FIXMEs)
TODO:                    11 actionable
```

### Worst offenders / أسوأ الملفات

| File | Issue |
| --- | --- |
| [app/owner/tenants/[tenantId]/page.tsx](app/owner/tenants/[tenantId]/page.tsx) | **9 `console.log`s** scattered through delete-flow handlers (lines 142, 382, 403, 410, 418, 719, 1249, 1263, 1273). Looks like leftover debugging from a "why isn't delete working" session. |
| [app/(dashboard)/admin/structure-management/StructureManagement.tsx](app/\(dashboard\)/admin/structure-management/StructureManagement.tsx) | **6+ `console.log`s** for org/floor/department fetches (lines 135–330). Same pattern — debug-only. |
| [app/api/imdad/approval/submit/route.ts](app/api/imdad/approval/submit/route.ts) | **3 `console.log`s** (lines 107, 109, 116) prefixed `[Approval]` — likely should go to `lib/monitoring/logger` instead. |
| [lib/services/email.ts](lib/services/email.ts:76) | `console.log` block printing email envelopes — appears to be the no-SMTP fallback path and is intentional, but it should be downgraded to `logger.info` for consistency. |
| [lib/imdad/logger.ts](lib/imdad/logger.ts:56) and [lib/imdad/sla-worker.ts](lib/imdad/sla-worker.ts:75) | These are the actual logger module — `console.log` here is legitimate. |

### Real TODOs (not placeholders) / المهام المؤجلة الفعلية

| File:Line | TODO |
| --- | --- |
| [lib/core/org/structure.ts:25](lib/core/org/structure.ts:25) | "Create a Prisma model `OrgNode` with all fields from the OrgNode interface" |
| [lib/core/org/structure.ts:487](lib/core/org/structure.ts:487) | Implement actual checks against real Prisma models |
| [lib/core/org/structure.ts:501](lib/core/org/structure.ts:501) | Implement reassignment against real Prisma models |
| [lib/core/subscription/middleware.ts:52](lib/core/subscription/middleware.ts:52) | Add subscription status to JWT payload at login |
| [lib/sam/operationLinks.ts:6](lib/sam/operationLinks.ts:6) | Add Prisma model for operation_documents (relates to dead `OperationLink` model in §5.4) |
| [lib/sam/tenantContext.ts:78](lib/sam/tenantContext.ts:78) | Add Prisma models for tenant_context_packs / tenant_context_overlays |
| [lib/services/structureService.ts:7](lib/services/structureService.ts:7) | Create Prisma models for Floor / FloorDepartment / FloorRoom to replace raw SQL |
| [lib/services/structureService.ts:27](lib/services/structureService.ts:27) | Replace with `prisma.floor.findMany` once Floor model is created |
| [lib/utils/translation.ts:14](lib/utils/translation.ts:14) | Integrate with translation service |
| [lib/workflow/escalation.ts:334](lib/workflow/escalation.ts:334) | Add flag/isRead columns to LabResult model |

The `lib/core/org/structure.ts` TODO + `lib/services/structureService.ts` TODOs are both about creating the same Floor/FloorDepartment/OrgNode Prisma models — **these are the same TODO duplicated in two places**.

---

## 9. Unused dependencies / تبعيات غير مستخدمة

Manual sample of 17 suspect packages (full `depcheck` would be needed for a definitive list, but these are confirmed by `grep`):

| Package | Listed in package.json as | Files importing it (entire repo, ex node_modules) | Verdict |
| --- | --- | ---: | --- |
| `canvas` | dependency | **0** | **unused** — heavy native dep (libcairo/libpango); likely transitive helper for `pdfkit`. **Verify before removing.** |
| `pdf-poppler` | dependency | **0** | **unused** — likely orphaned from a prior PDF→image experiment |
| `tesseract.js` | dependency | **0** | **unused** — was for OCR, but OCR now lives in [Thea-engine/](Thea-engine/) (Python). Safe to remove from main app. |
| `fhir-kit-client` | dependency | **0** | **unused** — Phase 7.7 FHIR work was implemented as serializers, not via fhir-kit-client |
| `blob-stream` | dependency | **0** | **unused** — likely a transitive of pdfkit, but it's listed at the top level |
| `@cornerstonejs/core`, `@cornerstonejs/dicom-image-loader`, `@cornerstonejs/tools` | dependencies | 2 each | **probably used** — DICOM viewer code; verify all 3 packages are needed (some may be transitive) |
| `mammoth` | dependency | 6 | used (Word doc parsing) |
| `pdfjs-dist` | dependency | 1 | used (sparingly) |
| `html2canvas` | dependency | 1 | used (one screen) |
| `dicom-parser` | dependency | 2 | used (DICOM) |
| `xlsx` | dependency | 7 | used |
| `jspdf` | dependency | 1 | used |
| `pdfkit` | dependency | 1 | used (server-side PDF) |
| `pdf-parse` | dependency | 10 | used (heavily) |
| `@fullcalendar/*` (6 sub-packages) | dependency | 1 file imports `@fullcalendar/core` | the React fullcalendar is heavy and only 1 file uses it — **verify** all 6 sub-packages are needed |
| `mongodb` | devDependency | 28 files | used — primarily in CVision and the migration scripts |

**Likely safe removals (verify with `depcheck` first):**
- `canvas`
- `pdf-poppler`
- `tesseract.js`
- `fhir-kit-client`
- `blob-stream`

**Total `node_modules` weight removable:** several hundred MB (especially `canvas`, `tesseract.js`, `@cornerstonejs/*`).

---

## 10. Top-level folder commentary / تعليق على المجلدات الجذرية

| Folder | Status | Comment |
| --- | --- | --- |
| `app/` | ✅ active | Next.js App Router |
| `components/` | ✅ active | Shared components |
| `lib/` | ✅ active | Core libraries (104 subfolders) |
| `prisma/` | ✅ active | Schema + migrations |
| `public/` | ✅ active | Static assets |
| `scripts/` | ✅ active | 58 scripts; some one-time codemods could be archived (see §6) |
| `hooks/` | ✅ active | React hooks |
| `contexts/` | ✅ active | React contexts |
| `types/` | ✅ active | Type defs |
| `middleware.ts` | ✅ active | Edge middleware |
| `__tests__/` | ✅ active | All test code |
| `simulator/` | ✅ active | Healthcare workflow simulator (per `CLAUDE.md` Simulator Update Rule); 2026-04-22 last touched |
| `docs/` | ✅ mostly active | 33+ MD files; one (`SYRA_HEALTH_PLATFORM_KNOWLEDGE_BASE_AR.md`) needs renaming |
| `data/` | ✅ active | Static JSON data files (ICD-10, drug catalogs, allergy maps) actually imported by `lib/clinical/` and 4 API routes |
| `platforms/` | 🟡 docs only | Contains only `platforms/_template/` — never imported. **Move to `docs/platform-template/`** for clarity |
| `core/` | 🔴 dead | 3 files (`rbac/test-accounts.ts`, `rbac/roles.ts`, `brain/ImdadBrain.ts`); zero imports anywhere. The live tree is `lib/core/`. **Delete.** |
| `Thea-engine/` | 🟡 separate | Standalone Python policy/OCR microservice (504 KB; 57 files). Not part of the Next.js app build. **Has 13 of its own setup MD files** (`SETUP_MACOS.md`, `SETUP_OPENAI.md`, `VENV_SETUP.md`, etc.) — its own internal cleanup needed. Keep as service, but consolidate its README. |
| `thea-website/` | 🟡 separate | Standalone marketing site (588 KB; 52 files); not part of EHR build. Keep, but verify that `package-lock.json` (vs main app's `yarn.lock`) is intentional. |
| `tests/` | 🔴 dead | Just `tests/__init__.py` (empty Python file). **Delete.** |
| `load-tests/` | ✅ active | Three `k6-*.js` files referenced by `yarn load:smoke|test|stress`. Keep. |
| `playwright-report/` | 🔴 generated artifact | A 542 KB `index.html` from a Playwright run. Should not be committed. **Delete + add to `.gitignore`.** |
| `test-results/` | 🔴 generated artifact | 3 stale Playwright run dirs. Should not be committed. **Delete + add to `.gitignore`.** |
| `.cursor/` | 🟡 IDE | Cursor IDE config. Keep if anyone uses it; harmless if not. |
| `.emergent/` | 🔴 stale | Emergent platform leftover (matches the URL in `backend_test.py`). **Delete.** |
| `.github/` | ✅ active | GitHub config |
| `.claude/` | ✅ active | Claude IDE config; contains 2 audit reports + a `worktrees/` subdirectory (see §13) |
| `Dockerfile`, `docker-compose.yml`, `next.config.js`, `vercel.json`, `render.yaml`, `playwright.config.ts`, `prisma.config.ts`, `vitest.*.config.ts`, `eslintrc.cjs`, `tailwind.config.js`, `postcss.config.js`, `tsconfig.json`, `jsconfig.json`, `components.json`, `package.json`, `yarn.lock`, `.env.example`, `.gitignore`, `.dockerignore`, `.renderignore`, `.nvmrc` | ✅ active config | All needed |

---

## 11. Stacked branches / فروع متراكمة

```
$ git branch | wc -l
75 local branches
```

Breakdown:
- **41** `claude/<name>-<hash>` agent worktree branches (auto-created by Claude Code agents) — these were never meant to be long-lived. Many have already been merged into named phase branches.
- **34** `phase-*` branches representing the historical phase work (phase-0-safety-nets through phase-8-6-ops-readiness).
- **`main`** + **`claude/quirky-villani-d355ac`** (current).

### Recommendation:

1. **Drop all merged `claude/<name>-<hash>` branches** — `git branch --merged main | grep '^  claude/' | xargs git branch -d`. Estimate ~30 of 41 will be cleanly merged.
2. **Keep the `phase-*` branch heads** — they're useful as historical anchors and lightweight.
3. After the cleanup, you should be down to **~5–10 local branches**.

Do **not** force-delete (`-D`) any branch without first verifying it's merged or backed up.

---

## 12. Migrations cleanup / migrations نظافة

`prisma/schema/migrations/` has 16 named migrations from 2026-04-02 through 2026-04-25, plus a `manual/` directory and `migration_lock.toml`. Names are crisp and dated.

**No orphan migrations found.** Every migration corresponds to a phase commit (e.g. `20260424000008_pgvector_embeddings` ↔ phase-5-2). The directory looks well-maintained.

One thing to verify: the `manual/` subdirectory — confirm it's intentional (Prisma sometimes creates this for one-off manual SQL).

---

## 13. Worktrees cleanup / تنظيف الـ worktrees

The user thought these were already removed — **they are not**. The parent directory `/Users/yousef/Desktop/THEA NEW/thea/.claude/worktrees/` currently holds **11 worktrees** (10 stale + this one):

```
amazing-haslett-745ad4       2026-04-26 02:52
competent-kepler-9d021f      2026-04-26 04:30
confident-ramanujan-074d3e   2026-04-26 02:40
exciting-tu-20d6a0           2026-04-26 00:24
hungry-hermann-563927        2026-04-26 03:11
loving-mccarthy-6b83eb       2026-04-25 23:38
lucid-khorana-63c666         2026-04-26 03:21
musing-pare-91766a           2026-04-26 04:53
quirky-villani-d355ac        2026-04-27 00:48   ← THIS ONE (current)
sad-cartwright-f36cc4        2026-04-26 03:38
upbeat-almeida-5668f1        2026-04-26 04:11
```

Each worktree is a full repo checkout — likely **5–10 GB total** on disk. This is by far the biggest disk-space win.

**Action:**
1. From the main repo: `git worktree list` to confirm registrations.
2. For each stale worktree: `git worktree remove --force <path>` (use `--force` only after confirming nothing in it is unique).
3. Then `git worktree prune` to clean orphan refs.

⚠️ Do not just `rm -rf` the directories — that orphans the git refs. Use `git worktree remove`.

---

## 14. Per-platform cleanup audit / تدقيق لكل منصة

The project hosts **5 platforms**: Thea Health, CVision, Imdad, SAM, Edrac. Below is a per-platform breakdown.

### 14.1 Thea Health / ثيا هيلث

| Metric | Value |
| --- | --- |
| Schema files | 30+ files: `clinical.prisma`, `clinical_infra.prisma`, `opd.prisma`, `ipd.prisma`, `er.prisma`, `lab.prisma`, `pharmacy.prisma`, `billing.prisma`, `oncology.prisma`, `psychiatry.prisma`, `or.prisma`, `cssd.prisma`, `blood_bank.prisma`, `pathology.prisma`, `physiotherapy.prisma`, `transplant.prisma`, `discharge.prisma`, `admission.prisma`, `encounter.prisma`, `scheduling.prisma`, `analytics.prisma`, `ai.prisma`, `agents.prisma`, `events.prisma`, `outcomes.prisma`, `quality.prisma`, `referrals.prisma`, `reminders.prisma`, `consumables.prisma`, `equipment.prisma`, `telemedicine.prisma`, `portal.prisma`, `ontology.prisma`, `taxonomy.prisma`, `care_path.prisma`, `care_gaps.prisma`, `ehr_admin.prisma`, `integration.prisma`, `workflow.prisma`, `orders.prisma`, `patient.prisma`, `misc.prisma`, `core.prisma`, `base.prisma` |
| Total models in Health schemas | ~370 |
| Routes (sampled major ones) | opd: 59, ipd: 46, er: 67, lab: 27, pharmacy: 29, clinical: 24, billing: 59 → **~311 routes** in core clinical alone |
| Routes on Mongo (`db.collection`) | **0** in opd/ipd/er/lab/pharmacy/clinical/billing — all migrated ✅ |
| Routes on Prisma | opd: 55/59, ipd: 46/46, er: 60/67, lab: 22/27, pharmacy: 28/29, clinical: 17/24, billing: 54/59 → ~95% Prisma coverage |
| Stale routes | None obvious — most-recent commits are all from this week |
| Cleanup wins | (1) Drop the legacy `embedding Json?` column on `SamPolicyChunk` (note: this is in sam.prisma but cited under §4.1). (2) Resolve 3 dead Floor/FloorDepartment/OrgNode TODOs (§8) by either creating the Prisma models or deleting the TODO comments. (3) The few non-Prisma routes in opd/er/lab/pharmacy/clinical/billing (totaling ~17 routes) — investigate whether they're file-reads / proxy routes that legitimately don't need Prisma. |

**Verdict:** The Health platform is **clean and active**. Migration to Prisma is essentially done.

### 14.2 CVision / سي-فيجن

| Metric | Value |
| --- | --- |
| Schema files | 7: [cvision-admin.prisma](prisma/schema/cvision-admin.prisma), [cvision-attendance.prisma](prisma/schema/cvision-attendance.prisma), [cvision-core.prisma](prisma/schema/cvision-core.prisma), [cvision-operations.prisma](prisma/schema/cvision-operations.prisma), [cvision-payroll.prisma](prisma/schema/cvision-payroll.prisma), [cvision-performance.prisma](prisma/schema/cvision-performance.prisma), [cvision-recruitment.prisma](prisma/schema/cvision-recruitment.prisma) |
| Total Prisma models | **121** |
| Models referenced via `prisma.cvisionX.…` | **0** |
| Models referenced as TS types only | 9 |
| **Models effectively unused** | **112 of 121** |
| Routes total | **246** |
| Routes using `db.collection(…)` Mongo | **94** |
| Routes using Prisma | **0** |
| Routes using neither (auth proxy / admin / etc.) | ~152 |
| Routes touched in last 7 days | 5 (240 of 246 last touched 2026-04-22 in commit `0f951b1`, single batch edit) |

**This is the single biggest cleanup decision in the project.** Either:
- **Option A:** Migrate all 246 CVision routes from MongoDB to Prisma. The `lib/cvision/prisma-helpers.ts` mapping table suggests this was the planned direction — needs ~weeks of work.
- **Option B:** Delete the 7 `cvision-*.prisma` files (~117 KB / 121 models) and accept that CVision stays on MongoDB indefinitely.

The middle ground (keeping unused schema "for future use") is the worst option — it makes the schema look like reality when it is fiction.

**Cleanup wins inside CVision regardless of A/B:**
- Remove the 9 `console.log`s in [app/owner/tenants/[tenantId]/page.tsx](app/owner/tenants/[tenantId]/page.tsx) and 6+ in [StructureManagement.tsx](app/\(dashboard\)/admin/structure-management/StructureManagement.tsx).
- Delete `CVision_Dashboard_Final.jsx` at the project root (orphaned, see §1).
- Move `cvision Dark.svg` and `cvision Light.svg` (1.1 MB total) from the root into `public/brand/`.
- Move `CVISION_AUDIT_REPORT.md` (138 KB) out of the root into `docs/cvision/AUDIT.md`.

### 14.3 Imdad / إمداد

| Metric | Value |
| --- | --- |
| Schema files | 1: [imdad.prisma](prisma/schema/imdad.prisma) (161 KB — the largest schema file in the repo) |
| Total Prisma models | **120** |
| Models referenced anywhere | 79 |
| Models with **zero** references in `lib/`, `app/`, `scripts/`, `__tests__/`, `simulator/` | **41** |
| Routes total | **175** |
| Routes using Mongo | 0 (fully Prisma) |
| Routes using Prisma | 158 |
| Other routes | 17 (likely auth / cron / proxy) |

**Likely-truly-dead Imdad models** (after filtering child tables that may be accessed via parent):
- `ImdadDelegationChain`
- `ImdadAuditLogPartition`
- `ImdadDeviceReplacementPlan`
- `ImdadProposalLineItem`
- `ImdadDashboardConfig`
- `ImdadVendorScorecard`, `ImdadVendorContact`, `ImdadVendorDocument` (3 vendor accessory tables)
- `ImdadInspectionChecklist`, `ImdadInspectionTemplate`
- `ImdadStockReservation`, `ImdadStockTransaction` (suspicious — these usually ARE referenced)
- `ImdadPickLine`, `ImdadPutAwayLine`, `ImdadPutAwayRule`, `ImdadReceivingDock`, `ImdadRecallAction`
- `ImdadUnitsOfMeasure`, `ImdadUomConversion` (UOM was scoped but never integrated)
- `ImdadNotificationPreference`, `ImdadNotificationTemplate`, `ImdadPermission`, `ImdadPrintTemplate`

The remaining ~20 of the 41 "unreferenced" hits are line-item child tables (`*Line`, `*Item`) that may be reached via parent `include: { lines: true }` and aren't false-flagged here.

**Cleanup actions:**
1. For each of the ~20 truly dead models above, before deletion: `grep -r "<modelName>" prisma/` to confirm no foreign-key relations from live models. If clean, drop with a single migration.
2. Resolve the 3 `console.log [Approval] …` debug lines in [app/api/imdad/approval/submit/route.ts](app/api/imdad/approval/submit/route.ts).
3. Reading `imdad.prisma` is now a 161 KB single-file slog — consider splitting into `imdad-core.prisma`, `imdad-procurement.prisma`, `imdad-warehouse.prisma`, `imdad-finance.prisma`, etc., mirroring the CVision split.

### 14.4 SAM / سام

| Metric | Value |
| --- | --- |
| Schema files | 1: [sam.prisma](prisma/schema/sam.prisma) |
| Total Prisma models | **26** |
| Models referenced | 25 |
| Unused models | **1** — `OperationLink` (TODO in [lib/sam/operationLinks.ts:6](lib/sam/operationLinks.ts:6) says "Add Prisma model for operation_documents when SAM module is migrated") — model declared but the helper isn't using it yet |
| Routes total | 65 |
| Routes using Mongo | 0 |
| Routes using Prisma | 48 |
| Other routes | 17 (auth/proxy) |

**Cleanup actions:**
1. Either remove `OperationLink` from `sam.prisma` or finish the TODO and have `lib/sam/operationLinks.ts` use it.
2. Drop the legacy `SamPolicyChunk.embedding Json?` column (§4.1).

**Verdict:** SAM is **the cleanest platform**. ~1 hour of work to reach spotless.

### 14.5 Edrac / إدراك

| Metric | Value |
| --- | --- |
| Schema files | 0 (no `edrac.prisma`) |
| Prisma models | 0 |
| API routes (`app/api/edrac/`) | 0 |
| UI pages (`app/platforms/edrac` or dashboard) | 0 (route is registered in `contexts/PlatformContext.tsx` but no pages exist) |
| References in code | 142 lines across 16 files — all just listing `edrac` as one platform key in entitlement maps |

**Where `edrac` lives:**
- `lib/db/platformKey.ts` — registered as one of the 5 valid platform keys
- `contexts/PlatformContext.tsx:44–48` — has metadata + a placeholder route `/platforms/edrac` (which doesn't exist)
- `prisma/schema/core.prisma` — `Tenant.entitlementEdrac`, `User.platformAccessEdrac`, `TenantEntitlement.enabledEdrac`, `allowedPlatforms` JSON includes `edrac`
- `app/owner/tenants/...`, `app/admin/...`, `app/platforms/page.tsx` — surfaces the entitlement toggle in the owner/admin UIs
- `middleware.ts:586` — bootstrap code grants `edrac: true` in the default entitlement set
- `app/platforms/PlatformsClient.tsx:165–173` — shows an edrac tile if entitled (uses `/brand/edrac.png` logo)

**Verdict:** Edrac is a **stub-only platform** — no schema, no routes, no pages, but every entitlement scaffold treats it as a real platform. Two paths forward:

- **If Edrac is on the roadmap:** keep the entitlement plumbing; the cost is small (~5 schema columns + 16 file references). Add a `// TODO(edrac): scaffold platform routes` comment in `lib/db/platformKey.ts` so future developers don't think it's a typo.
- **If Edrac is dead:** remove
  - `entitlementEdrac` / `platformAccessEdrac` / `enabledEdrac` columns (one migration)
  - `'edrac'` from the `PlatformKey` union in `lib/db/platformKey.ts`
  - The `'edrac'` branch from `contexts/PlatformContext.tsx`
  - The 16 references in admin / owner / platforms pages
  - The `/brand/edrac.png` asset (if it exists)

  Estimated work: 2–3 hours including a Prisma migration. **Recommend deferring this decision to product.**

---

## Prioritized cleanup plan / خطة التنظيف بالأولوية

### P0 — Do this week / هذا الأسبوع (high payoff, low risk)

1. **[1.5h] Delete 23 root-level phase / audit MD files** + 4 mystery artifact files (`Path.html`, `CVision_Dashboard_Final.jsx`, `_write_ui.js`, `backend_test.py`, `codemod-report.json`, `ui-crawl-results.{json,md}`). Move `CVISION_AUDIT_REPORT.md` to `docs/cvision/`. Move `cvision Dark.svg` / `cvision Light.svg` to `public/brand/`.
2. **[30m] Update `CLAUDE.md`** — remove the entire Phase 0 / Syra mission section (long since done) and replace with current phase context.
3. **[1h] Remove the 10 stale `.claude/worktrees/<name>/`** — use `git worktree remove --force` not `rm -rf`. Frees several GB.
4. **[15m] Drop the only stash** after eyeballing: `git stash show -p stash@{0}`.
5. **[30m] Add `playwright-report/`, `test-results/`, `ui-routes.json`, `ui-routes.meta.json`, `ui-crawl-results.*` to `.gitignore`** and remove from working tree.
6. **[30m] Delete dead folders:** `core/` (3 files, 0 imports), `tests/` (1 empty Python file), `.emergent/`.
7. **[1h] Branch cleanup:** drop the ~30 fully merged `claude/<name>` branches; keep `phase-*` heads.

**Subtotal: ~5 hours.**

### P1 — Do this month / هذا الشهر

8. **[1h] Strip console.logs** in [app/owner/tenants/[tenantId]/page.tsx](app/owner/tenants/[tenantId]/page.tsx) and [app/(dashboard)/admin/structure-management/StructureManagement.tsx](app/\(dashboard\)/admin/structure-management/StructureManagement.tsx) and `app/api/imdad/approval/submit/route.ts`. Replace with `logger.info` where useful, delete the rest.
9. **[1h] Resolve the 3 SAM cleanup items:** drop legacy `embedding Json?` column on `SamPolicyChunk` (§4.1), delete or wire up `OperationLink` model (§14.4), rename `docs/SYRA_HEALTH_PLATFORM_KNOWLEDGE_BASE_AR.md` → `docs/THEA_HEALTH_PLATFORM_KNOWLEDGE_BASE_AR.md`.
10. **[2h] Run `npx depcheck`** and remove confirmed dead deps: `canvas`, `pdf-poppler`, `tesseract.js`, `fhir-kit-client`, `blob-stream` are top candidates. Frees significant `node_modules` space.
11. **[2h] Imdad model audit:** for each of the ~20 truly-dead models in §14.3, confirm no FK relations and drop with one migration.
12. **[30m] Archive one-shot codemods:** move `scripts/codemod-apply-auth-wrapper.ts`, `codemod-improved.ts`, `codemod-improved-v2.ts` into `scripts/archive/` and remove the `codemod:*` yarn scripts (or keep just `codemod:v2`).

**Subtotal: ~6.5 hours.**

### P2 — Someday / لاحقاً

13. **[6–weeks] Decide CVision DB story (§14.2)** — migrate the 246 routes to Prisma OR delete the 121 unused models. Either way, the current state is a strategic red flag, not just clutter.
14. **[2h] Edrac decision** — keep as roadmap stub (just add a comment) or remove all 142 references (§14.5). Deferred to product.
15. **[1h] Split `prisma/schema/imdad.prisma`** (161 KB) into `imdad-core.prisma`, `imdad-procurement.prisma`, `imdad-warehouse.prisma`, `imdad-finance.prisma` — mirrors the CVision split.
16. **[2h] Resolve the 11 actionable TODOs** in §8 (most are about creating Prisma models for Floor / OrgNode / FloorDepartment).
17. **[1h] Clean up `Thea-engine/` setup docs** — there are 13 separate setup MD files; consolidate to 1–2.

**Subtotal: ~12 hours of optional polish + the strategic CVision call.**

---

**Grand total to "spotless":** ~14 hours of P0+P1 work + the CVision decision (which dominates everything else if you go the migration route).
