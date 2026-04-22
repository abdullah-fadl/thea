# Risk Engine Implementation

## Overview

A scientific, auditable Risk Engine with trace, reason, evidence drawer, and multi-accreditation references has been implemented for the Policy & Risk Detector system.

## Features Implemented

### 1. FMEA-Based Risk Scoring Engine

- **Severity**: Low (3), Med (5), High (8), Critical (10) - mapped to 1-10 scale
- **Probability**: 0-1 normalized to 1-10 scale
- **Detectability**: 0-1 (inverse of how easy to detect)
- **Base RPN**: Severity × Probability × Detectability (1-1000 scale)
- **Normalized Score**: RPN / 1000 × 100 (0-100 scale)
- **Governance Modifiers**:
  - +25% if no governing policy exists
  - +15% if no training requirement documented
  - +10% if no monitoring/audit process exists
  - +10% critical-area multiplier (ICU/NICU/Medication/etc.)
- **Final Score**: Normalized score × (1 + sum of modifiers), capped at 100

### 2. Trace Object

For each analyzed practice, a `trace` object is returned:
```typescript
{
  steps: [
    "Practice 'X' identified",
    "N relevant policies searched",
    "No applicable policy found" | "Applicable policy found",
    "FMEA scoring applied",
    "Governance modifiers applied",
    "Risk score normalized to 0-100 scale",
    "Accreditation references identified"
  ],
  analyzedAt: "ISO timestamp"
}
```

### 3. Reason Object

A `reason` array explaining WHY the score occurred:
- Practice frequency and setting context
- Department context (critical area flags)
- Policy status (covered/partial/no policy/conflict)
- Governance gaps (no policy, no training, no monitoring)
- Critical area multiplier explanation
- Severity context

### 4. Evidence Drawer

Contains:
- **policiesReviewed**: Array of {id, title} for all policies reviewed
- **riskModel**: 
  - severity, probability, detectability
  - baseRPN, normalizedScore
  - modifiersApplied (object with modifier names and percentages)
  - finalScore
- **accreditationReferences**: Array of:
  - ISO 31000 (Risk Management)
  - ISO 14971 (Medical Devices Risk Management)
  - WHO Patient Safety Framework
  - JCI IPSG (International Patient Safety Goals)
  - CBAHI Patient Safety Standards (Saudi)

### 5. UI Integration

- **Risk Score Breakdown**: Display severity, probability, detectability, base RPN, modifiers
- **Expandable "Why this risk?" section**: Shows reason array
- **Expandable "Trace" section**: Shows analysis steps
- **Expandable "Evidence" drawer**: Shows policies reviewed, risk model details, accreditation references
- **Existing layout preserved**: No breaking changes

### 6. Draft Policy Generation

When no policy is found:
- "Generate Draft Policy" button enabled
- Pre-fills:
  - Title: "Policy: {practice title}"
  - Scope, Department, Setting
  - Risk addressed (risk score)
  - Linked practice ID
  - Accreditation references

### 7. Persistence

- Risk runs are saved to MongoDB `risk_runs` collection
- API route `/api/risk-detector/runs` retrieves saved runs
- On page load or department/setting change, the most recent run for that department/setting is automatically loaded
- Analysis results persist across page refreshes

## Files Modified

### FastAPI (Policy Engine)

1. **`policy-engine/app/api/routes_risk_detector.py`**:
   - Added FMEA risk scoring function `calculate_fmea_score()`
   - Added trace generation function `generate_trace_steps()`
   - Added reason generation function `generate_reason()`
   - Added accreditation references function `get_applicable_accreditation_references()`
   - Updated `PracticeResult` model to include `trace`, `reason`, `evidence`
   - Updated `AnalyzeResponse` to include new fields
   - Updated OpenAI prompt to request `hasTraining` and `hasMonitoring` flags

### Next.js API Routes

2. **`app/api/risk-detector/run/route.ts`**:
   - Handles new response structure with trace/reason/evidence
   - Stores complete results in `risk_runs` collection

3. **`app/api/risk-detector/runs/route.ts`** (NEW):
   - GET endpoint to retrieve saved risk runs
   - Filters by departmentId and setting
   - Returns most recent runs first

### TypeScript Models

4. **`lib/models/Practice.ts`**:
   - Added `Trace`, `RiskModel`, `AccreditationReference`, `Evidence` interfaces
   - Updated `PracticeResult` interface to include trace, reason, evidence
   - Updated `RiskRun` interface to use new `PracticeResult` structure

### UI Components

5. **`app/(dashboard)/policies/risk-detector/page.tsx`**:
   - Added state for expandable sections (`expandedSections`)
   - Added `toggleSection()` and `isSectionExpanded()` helper functions
   - Added `useEffect` to load saved runs on department/setting change
   - Updated UI to display:
     - Risk score breakdown with modifiers
     - Expandable "Why this risk?" section
     - Expandable "Trace" section
     - Expandable "Evidence" drawer
   - Updated draft policy generation to include risk score and accreditation references

## API Response Structure

```typescript
{
  practices: [
    {
      practiceId: string;
      status: "Covered" | "Partial" | "NoPolicy" | "Conflict";
      relatedPolicies: [...];
      severity: "Low" | "Med" | "High" | "Critical";
      likelihood: number; // 0-1
      riskScore: number; // 0-100 (final score)
      recommendations: string[];
      trace: {
        steps: string[];
        analyzedAt: string;
      };
      reason: string[];
      evidence: {
        policiesReviewed: Array<{id: string; title: string}>;
        riskModel: {
          severity: string;
          probability: number;
          detectability: number;
          baseRPN: number;
          normalizedScore: number;
          modifiersApplied: Record<string, number>;
          finalScore: number;
        };
        accreditationReferences: Array<{
          standard: string;
          clause: string;
          description: string;
        }>;
      };
    }
  ];
  metadata: {
    totalPractices: number;
    policiesAnalyzed: number;
    model: string;
    analyzedAt: string;
  };
}
```

## Testing

### Manual Test

```bash
curl -i -X POST http://localhost:8001/v1/risk-detector/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "department": "ICU",
    "setting": "IPD",
    "practices": [{
      "id": "practice-1",
      "title": "External breast milk handling",
      "description": "Family brings expressed breast milk from outside",
      "frequency": "Daily"
    }],
    "policies": [],
    "tenantId": "default"
  }'
```

Expected: Response includes `trace`, `reason`, `evidence` objects with complete risk analysis.

## Notes

- Risk scores are reproducible and explainable via trace/reason/evidence
- All governance modifiers are clearly documented
- Accreditation references support both global (ISO, WHO, JCI) and Saudi (CBAHI) standards
- UI maintains backward compatibility - existing features unchanged
- Risk runs persist automatically and are restored on page refresh/department change
