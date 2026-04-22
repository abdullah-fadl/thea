# SAM Context Rules (v0)

## Inputs
- `orgProfile`: organization profile for the active tenant
- optional `departmentId` (future: department-specific overrides)

## Outputs
SAM derives a small ruleset used to tune analysis and prioritization:
- `strictnessLevel`: `lenient | balanced | strict`
- `tone`: `coaching | operational | audit`
- `preferReuse`: boolean
- `suppressAdvancedConflicts`: boolean
- `priorities`: string[]

## Default rules (current implementation)
Located in `lib/sam/contextRules.ts`.

### New organizations
- `strictnessLevel`: `lenient`
- `tone`: `coaching`
- `suppressAdvancedConflicts`: `true`
- Prioritize: foundational gaps, baseline controls

### Operating organizations
- `strictnessLevel`: `balanced`
- `tone`: `operational`
- Prioritize: operational gaps

### Mature organizations
- `strictnessLevel`: `strict`
- `tone`: `audit`
- Prioritize: audit readiness, conflict resolution

### Group membership
If `orgProfile.isPartOfGroup = true`, enable:
- `preferReuse = true`
- prioritize reuse suggestions before creation

## Traceability
For key workflows, SAM snapshots `orgProfile` and `contextRules`:
- with policy-engine requests (headers/body)
- on ingest (`policy_documents.orgProfileSnapshot/contextRulesSnapshot`)
- on integrity runs (`integrity_runs.orgProfileSnapshot/contextRulesSnapshot`)
- on draft creation/versioning (`draft_documents.*Snapshot` + version inputs)

