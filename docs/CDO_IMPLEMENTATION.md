# CDO (Clinical Decision & Outcomes) Implementation

## Overview

This document describes the implementation of the Thea Clinical Decision & Outcomes (CDO) layer as specified in `/docs/specs/SIRA_CDO_LAYER.md`.

## Architecture

The CDO module is implemented as a **read-only analysis layer** within HospitalOS that:
- Reads clinical data from existing ER collections (read-only)
- Analyzes data using rule-based algorithms (no AI/LLM)
- Generates decision prompts, risk flags, and outcome metrics
- Provides governance-grade quality indicators

### Core Principles (Section 3)

1. **Decision ≠ Action**: The system prompts, warns, or flags. Humans decide, act, and document.
2. **Outcomes Over Activity**: Tracks what happened to the patient, not documentation volume.
3. **Context Awareness**: Same data means different things in ICU vs Ward vs ED, Adult vs Pediatric.

## Module Structure

```
lib/cdo/
├── models/cdo/           # Re-exports from lib/models/cdo/
├── repositories/
│   ├── ERRepository.ts   # Read-only access to ER collections
│   └── CDORepository.ts  # Read/write access to CDO collections
├── ingestion/
│   └── ERIngestionService.ts  # Ingests ER data for analysis
├── analysis/
│   └── ClinicalDeteriorationAnalyzer.ts  # Rule-based analysis engine
└── services/
    ├── CDOAnalysisService.ts      # Main analysis orchestration
    ├── CDOPromptService.ts        # Prompt management & acknowledgment
    └── CDODashboardService.ts     # Dashboard & quality indicators

app/api/cdo/
├── analysis/
│   ├── route.ts          # POST: Run analysis, GET: Get available domains
│   └── preview/route.ts  # GET: Preview analysis without saving
├── prompts/
│   ├── route.ts          # GET: Get prompts, POST: Acknowledge/resolve/dismiss
│   ├── unacknowledged/route.ts  # GET: Unacknowledged high-risk prompts
│   └── [promptId]/route.ts      # GET: Get prompt by ID
├── flags/route.ts        # GET: Get risk flags
├── outcomes/route.ts     # GET: Get outcome events
├── metrics/route.ts      # GET: Get response time metrics
├── dashboard/route.ts    # GET: Dashboard summary
└── quality-indicators/route.ts  # GET: Quality indicators
```

## Data Entities (Section 16)

The implementation includes **exactly 7 entities** as specified:

1. **ClinicalDecisionPrompt**: Decision support prompts/warnings
2. **OutcomeEvent**: Patient outcome events
3. **RiskFlag**: Risk indicators/flags
4. **ResponseTimeMetric**: Time-based metrics (recognition, escalation)
5. **TransitionOutcome**: Care transition outcomes
6. **ReadmissionEvent**: Readmission events
7. **QualityIndicator**: Aggregated quality indicators

All entities are defined in `lib/models/cdo/` with TypeScript interfaces.

## Database Collections

CDO creates **7 new collections** in MongoDB:

1. `clinical_decision_prompts`
2. `cdo_outcome_events`
3. `cdo_risk_flags`
4. `cdo_response_time_metrics`
5. `cdo_transition_outcomes`
6. `cdo_readmission_events`
7. `cdo_quality_indicators`

### Indexes

Run the index creation script:
```bash
node scripts/ensure-cdo-indexes.js
```

This creates optimized indexes for common query patterns.

## Supported Domains

Currently, **only one domain is fully supported** due to data availability:

### ✅ Available: Clinical Deterioration & Rescue (Section 5)

**Data Sources**: ER data (`er_registrations`, `er_triage`, `er_progress_notes`, `er_dispositions`)

**Analysis Capabilities**:
- Early warning signal detection (vital sign abnormalities)
- Response time tracking (time to recognition, time to escalation)
- Failure to rescue detection (ICU transfer after delay, cardiac arrest)
- Decision prompts generation

**Decision Prompts**:
- "Early deterioration detected - reassessment overdue"
- "Escalation delayed beyond policy threshold"

**Outcomes Tracked**:
- Time to recognition
- Time to escalation
- ICU transfer after delay
- Cardiac arrest occurrence

### ❌ Not Available (Missing Data Sources)

The following domains return `NOT_AVAILABLE_SOURCE_MISSING`:
- **Sepsis & Infection Outcomes**: Requires lab results, medications
- **Medication Effectiveness & Harm**: Requires medications data
- **Procedure & Surgical Outcomes**: Requires procedures data
- **ICU & High-Acuity Outcomes**: Requires ICU data
- **Transitions of Care Safety**: Requires transfers/discharges data (partially available)
- **Maternal & Neonatal Outcomes**: Requires OB/Gyne, NICU data
- **Readmission & Failure Patterns**: Requires readmission tracking (partially available)

## Usage

### 1. Initialize Indexes

```bash
node scripts/ensure-cdo-indexes.js
```

### 2. Run Analysis

Analyze a specific ER visit:
```bash
POST /api/cdo/analysis
{
  "erVisitId": "ER-1234567890-ABC12345"
}
```

Analyze active visits:
```bash
POST /api/cdo/analysis
{
  "activeOnly": true,
  "limit": 100
}
```

Preview analysis (without saving):
```bash
GET /api/cdo/analysis/preview?erVisitId=ER-1234567890-ABC12345
```

### 3. Get Decision Prompts

Get prompts for a visit:
```bash
GET /api/cdo/prompts?erVisitId=ER-1234567890-ABC12345
```

Get unacknowledged high-risk prompts:
```bash
GET /api/cdo/prompts/unacknowledged
```

### 4. Acknowledge a Prompt

```bash
POST /api/cdo/prompts
{
  "action": "acknowledge",
  "promptId": "prompt-uuid",
  "acknowledgedBy": "user-id",
  "acknowledgmentNotes": "Reviewed and addressed"
}
```

### 5. Get Dashboard Data

```bash
GET /api/cdo/dashboard?periodStart=2025-01-01&periodEnd=2025-01-31&careSetting=ED
```

### 6. Get Quality Indicators

```bash
GET /api/cdo/quality-indicators?periodStart=2025-01-01&periodEnd=2025-01-31&calculate=true
```

## Analysis Rules (Clinical Deterioration)

The `ClinicalDeteriorationAnalyzer` implements rule-based analysis:

### Vital Sign Thresholds

**Context-aware thresholds** based on age group:
- **Adult**: HR 60-100, RR 12-20, SpO2 ≥95%, Temp 36.1-37.2°C
- **Pediatric**: HR 70-120, RR 16-30, SpO2 ≥95%, Temp 36.5-37.5°C
- **Geriatric**: HR 55-95, RR 12-18, SpO2 ≥93%, Temp 36.0-37.0°C

### Time-Based Rules

- **Reassessment Overdue**: >120 minutes since last progress note
- **Escalation Delay**: >30 minutes for high-severity (CTAS 1-2) without escalation
- **Prolonged ED Stay**: >6 hours in ED without disposition

### Outcome Detection

- **ICU Transfer After Delay**: Disposition to ICU after escalation delay threshold
- **Cardiac Arrest**: Death disposition triggers cardiac arrest outcome

## Policy Thresholds

Configurable thresholds in `ClinicalDeteriorationAnalyzer`:

```typescript
const POLICY_THRESHOLDS = {
  REASSESSMENT_OVERDUE_MINUTES: 120,
  ESCALATION_DELAY_MINUTES: 30,
  PROLONGED_ED_STAY_HOURS: 6,
  // ... vital sign thresholds by age group
};
```

## Security & Authentication

All API endpoints require authentication via `requireAuth` middleware. The CDO module:
- **Reads only** from clinical collections (ER data)
- **Writes only** to CDO collections (the 7 entities)
- **Never modifies** clinical data
- **Never places orders** or diagnoses

## Limitations & Future Work

1. **Limited Domain Support**: Only Clinical Deterioration domain is fully supported due to data availability
2. **No UI Implementation**: This phase includes backend only. UI components are out of scope
3. **No Predictive AI**: System is rule-based only (as per specification)
4. **No Order Placement**: System only generates prompts/flags (read-only decision support)

## Testing

### Manual Testing

1. **Ensure ER data exists**: Register and triage some ER visits
2. **Run analysis**: `POST /api/cdo/analysis` with `activeOnly: true`
3. **Check prompts**: `GET /api/cdo/prompts?erVisitId=...`
4. **Acknowledge prompt**: `POST /api/cdo/prompts` with `action: "acknowledge"`
5. **View dashboard**: `GET /api/cdo/dashboard`

### Integration Points

The CDO module integrates with:
- **ER Module**: Reads from `er_registrations`, `er_triage`, `er_progress_notes`, `er_dispositions`
- **Authentication**: Uses `requireAuth` for API access control

## Compliance with Specification

✅ **Section 1-3**: Core principles implemented (Decision ≠ Action, Outcomes Over Activity, Context Awareness)
✅ **Section 4**: Only specified domains implemented (others return NOT_AVAILABLE)
✅ **Section 5**: Clinical Deterioration & Rescue fully implemented (ED context)
✅ **Section 6-12**: Other domains return NOT_AVAILABLE_SOURCE_MISSING
✅ **Section 13**: Communication rules followed (prompts/flags only, no orders)
✅ **Section 14**: User experience rules implemented (acknowledgment, severity prioritization)
✅ **Section 15**: Governance & quality outputs implemented (dashboards, indicators)
✅ **Section 16**: Exactly 7 entities implemented (no additional entities)
✅ **Section 17**: Prohibited behaviors avoided (no AI, no autonomous actions, no predictions)

## Next Steps

When additional data sources become available:
1. Implement ingestion services for new sources (e.g., `MedicationRepository`, `LabRepository`)
2. Implement analysis engines for new domains (e.g., `SepsisAnalyzer`, `MedicationAnalyzer`)
3. Update `CDOAnalysisService.getAvailableDomains()` to reflect new capabilities
4. No changes needed to entity models (they already support all domains)

