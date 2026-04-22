# Policy Tagging and Risk Detector - Implementation Guide

## Overview

This document describes the Policy Classification (Manual + AI Tagging), Bulk Upload Auto-tagging with Review Queue, and Risk Detector module features.

## Features

### 1. Policy Metadata & Classification

Policies can now be classified with:
- **Departments**: Multi-select department associations
- **Setting**: IPD, OPD, Corporate, Shared, or Unknown
- **Policy Type**: Clinical, Admin, HR, Quality, IC, Medication, Other, or Unknown
- **Scope**: HospitalWide, DepartmentOnly, UnitSpecific, or Unknown

### 2. AI-Powered Tagging

- **Single Upload**: Uses existing policy-engine ingest endpoint (no changes to workflow)
- **Bulk Upload**: Multiple PDFs uploaded, AI tagging runs in background, review queue page shows suggestions
- **Auto-approval**: Tags with confidence ≥ 0.85 are auto-approved
- **Review Queue**: Policies with confidence < 0.85 require manual review

### 3. Risk Detector Module

- **Practices Repository**: Store daily practices per department
- **AI Gap Analysis**: Compare practices against department + hospital-wide policies
- **Risk Scoring**: Each practice gets a risk score and recommendations
- **Policy Generation**: Generate draft policies for uncovered practices

## Database Models

### PolicyDocument Extensions

New fields added to `policy_documents` collection:

```typescript
{
  departmentIds?: string[]; // Array of department IDs
  setting?: 'IPD' | 'OPD' | 'Corporate' | 'Shared' | 'Unknown';
  policyType?: 'Clinical' | 'Admin' | 'HR' | 'Quality' | 'IC' | 'Medication' | 'Other' | 'Unknown';
  scope?: 'HospitalWide' | 'DepartmentOnly' | 'UnitSpecific' | 'Unknown';
  aiTags?: {
    departments?: Array<{ id: string; label: string; confidence: number }>;
    setting?: { value: string; confidence: number };
    type?: { value: string; confidence: number };
    scope?: { value: string; confidence: number };
    overallConfidence?: number;
    model?: string;
    createdAt?: string;
  };
  tagsStatus?: 'auto-approved' | 'needs-review' | 'approved';
}
```

### Practice Model

New collection: `practices`

```typescript
{
  id: string; // UUID
  tenantId: string;
  departmentId: string;
  setting: 'IPD' | 'OPD' | 'Corporate' | 'Shared';
  title: string;
  description: string;
  frequency: 'Rare' | 'Occasional' | 'Frequent' | 'Daily';
  ownerRole?: string;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}
```

### RiskRun Model

New collection: `risk_runs`

```typescript
{
  id: string; // UUID
  tenantId: string;
  departmentId: string;
  setting: 'IPD' | 'OPD' | 'Corporate' | 'Shared';
  createdBy: string; // userId
  inputPracticeIds: string[];
  resultsJson: {
    practices: Array<{
      practiceId: string;
      status: 'Covered' | 'Partial' | 'NoPolicy' | 'Conflict';
      relatedPolicies: Array<{
        policyId: string;
        title: string;
        documentId: string;
        citations: Array<{
          pageNumber: number;
          snippet: string;
        }>;
      }>;
      severity: 'Low' | 'Med' | 'High' | 'Critical';
      likelihood: number; // 0-1
      riskScore: number; // 0-100
      recommendations: string[];
    }>;
    metadata?: {
      totalPractices: number;
      policiesAnalyzed: number;
      model?: string;
      analyzedAt: string;
    };
  };
  createdAt: Date;
}
```

## API Endpoints

### Next.js API Routes

#### POST /api/policies/[id]/suggest-tags
Suggests tags for a policy using AI.

**Request:**
- URL params: `id` (policy document ID)
- Body: (optional metadata override)

**Response:**
```json
{
  "aiTags": {
    "departments": [{"id": "...", "label": "...", "confidence": 0.9}],
    "setting": {"value": "IPD", "confidence": 0.85},
    "type": {"value": "Clinical", "confidence": 0.88},
    "scope": {"value": "HospitalWide", "confidence": 0.92},
    "overallConfidence": 0.89,
    "model": "gpt-4o",
    "createdAt": "2025-01-01T12:00:00Z"
  },
  "tagsStatus": "auto-approved"
}
```

#### POST /api/policies/[id]/update-metadata
Updates policy metadata (classification fields).

**Request Body:**
```json
{
  "departmentIds": ["dept-id-1", "dept-id-2"],
  "setting": "IPD",
  "policyType": "Clinical",
  "scope": "HospitalWide",
  "tagsStatus": "approved"
}
```

#### POST /api/policies/bulk-upload
Bulk upload multiple PDFs.

**Request:** FormData with `files[]` (multiple files)

**Response:**
```json
{
  "success": true,
  "policies": [
    {
      "id": "...",
      "documentId": "POL-2025-XXXXXX",
      "filename": "...",
      "status": "uploaded",
      "tagsStatus": "needs-review"
    }
  ],
  "reviewQueueCount": 3
}
```

#### GET /api/policies/tag-review-queue
Get policies needing tag review.

**Query Params:**
- `lowConfidenceOnly`: boolean (filter to confidence < 0.85)
- `status`: 'needs-review' | 'auto-approved'

**Response:**
```json
{
  "policies": [
    {
      "id": "...",
      "documentId": "...",
      "title": "...",
      "filename": "...",
      "aiTags": {...},
      "tagsStatus": "needs-review",
      "uploadedAt": "..."
    }
  ],
  "total": 5
}
```

#### POST /api/policies/[id]/rerun-tagging
Re-run AI tagging for a policy.

### Risk Detector Endpoints

#### GET /api/risk-detector/practices
List practices for a department/setting.

**Query Params:**
- `departmentId`: string (required)
- `setting`: 'IPD' | 'OPD' | 'Corporate' | 'Shared'
- `status`: 'active' | 'archived'

#### POST /api/risk-detector/practices
Create a practice.

**Request Body:**
```json
{
  "departmentId": "...",
  "setting": "IPD",
  "title": "Daily medication rounds",
  "description": "...",
  "frequency": "Daily",
  "ownerRole": "Nurse"
}
```

#### PUT /api/risk-detector/practices/[id]
Update a practice.

#### DELETE /api/risk-detector/practices/[id]
Archive a practice (soft delete).

#### POST /api/risk-detector/run
Run AI gap analysis.

**Request Body:**
```json
{
  "departmentId": "...",
  "setting": "IPD",
  "practiceIds": ["practice-id-1", "practice-id-2"]
}
```

**Response:**
```json
{
  "runId": "...",
  "results": {
    "practices": [
      {
        "practiceId": "...",
        "status": "NoPolicy",
        "relatedPolicies": [],
        "severity": "High",
        "likelihood": 0.8,
        "riskScore": 75,
        "recommendations": ["Create policy for..."]
      }
    ],
    "metadata": {...}
  }
}
```

#### GET /api/risk-detector/runs/[id]
Get a specific risk run.

#### POST /api/policies/draft
Generate draft policy from practice and findings.

**Request Body:**
```json
{
  "practice": {
    "title": "...",
    "description": "...",
    "frequency": "Daily"
  },
  "findings": {
    "status": "NoPolicy",
    "recommendations": ["Create policy..."]
  },
  "department": "Cardiology",
  "setting": "IPD"
}
```

**Response:**
```json
{
  "success": true,
  "draft": {
    "sections": [
      {
        "title": "Purpose",
        "content": "..."
      }
    ]
  }
}
```

### Policy Engine (FastAPI) Endpoints

#### POST /v1/tags/suggest
Suggest tags for a policy.

**Request Body:**
```json
{
  "filename": "policy.pdf",
  "sample_text": "First page text...",
  "tenantId": "default"
}
```

**Response:**
```json
{
  "departments": [{"id": "...", "label": "...", "confidence": 0.9}],
  "setting": {"value": "IPD", "confidence": 0.85},
  "type": {"value": "Clinical", "confidence": 0.88},
  "scope": {"value": "HospitalWide", "confidence": 0.92},
  "overallConfidence": 0.89,
  "model": "gpt-4o-mini"
}
```

#### POST /v1/risk-detector/analyze
Run gap analysis.

**Request Body:**
```json
{
  "department": "Cardiology",
  "setting": "IPD",
  "practices": [
    {
      "id": "...",
      "title": "Daily medication rounds",
      "description": "..."
    }
  ],
  "policies": [
    {
      "id": "...",
      "documentId": "...",
      "title": "..."
    }
  ],
  "tenantId": "default"
}
```

**Response:**
```json
{
  "practices": [
    {
      "practiceId": "...",
      "status": "NoPolicy",
      "relatedPolicies": [],
      "severity": "High",
      "likelihood": 0.8,
      "riskScore": 75,
      "recommendations": ["Create policy for..."]
    }
  ],
  "metadata": {
    "totalPractices": 1,
    "policiesAnalyzed": 5,
    "model": "gpt-4o-mini",
    "analyzedAt": "2025-01-01T12:00:00Z"
  }
}
```

#### POST /v1/policies/draft
Generate draft policy.

**Request Body:**
```json
{
  "practice": {
    "title": "...",
    "description": "...",
    "frequency": "Daily"
  },
  "findings": {
    "status": "NoPolicy",
    "recommendations": ["Create policy..."]
  },
  "department": "Cardiology",
  "setting": "IPD",
  "tenantId": "default"
}
```

**Response:**
```json
{
  "draft": {
    "sections": [
      {
        "title": "Purpose",
        "content": "..."
      },
      {
        "title": "Scope",
        "content": "..."
      }
    ]
  }
}
```

## Environment Variables

No new environment variables required. Uses existing:
- `POLICY_ENGINE_URL` - Policy Engine service URL (default: http://localhost:8001)
- `POLICY_ENGINE_TENANT_ID` - Tenant ID for policy-engine (default: default)
- `OPENAI_API_KEY` - For AI features (used by policy-engine)

## Workflow

### Single Policy Upload

1. User uploads PDF via "Upload Policy" button
2. File is processed by policy-engine `/v1/ingest` endpoint
3. Policy appears in library (existing workflow, unchanged)

### Bulk Upload with Review Queue

1. User clicks "Bulk Upload" button
2. Selects multiple PDF files
3. Files are uploaded via `/api/policies/bulk-upload`
4. Each file is saved to MongoDB
5. AI tagging is triggered in background for each file
6. User is redirected to `/policies/tag-review-queue`
7. Queue shows policies with suggested tags + confidence
8. User can:
   - Approve tags (auto-approve if confidence ≥ 0.85)
   - Edit tags manually
   - Re-run AI tagging
9. Approved policies appear in main library

### Risk Detector Workflow

1. User navigates to `/policies/risk-detector`
2. Select Department + Setting
3. View/Manage practices (CRUD)
4. Click "Run AI Gap Analysis"
5. System:
   - Loads practices for department
   - Loads relevant policies (department-tagged OR HospitalWide scope)
   - Calls policy-engine `/v1/risk-detector/analyze`
   - Stores results in RiskRun
6. Results displayed:
   - Per-practice status (Covered/Partial/NoPolicy/Conflict)
   - Related policies with citations
   - Risk scores and recommendations
7. For NoPolicy practices:
   - "Generate Draft Policy" button
   - Opens New Policy Creator at `/ai/new-policy-from-scratch?draft=...`
   - Draft data is prefilled in form

## UI Components

### New Pages

- `/policies/tag-review-queue` - Tag review queue page
- `/policies/risk-detector` - Risk Detector module page

### Updated Pages

- `/policies` - Added "Bulk Upload" button (separate from single upload)
- `/ai/new-policy-from-scratch` - Accepts draft parameter, prefills form

### Navigation

- Policy Quick Nav includes:
  - Library (existing)
  - Conflicts & Issues (existing)
  - Policy Assistant (existing)
  - New Policy Creator (existing)
  - Policy Harmonization (existing)
  - **Risk Detector** (new)
  - **Tag Review Queue** (new)

## Tenant Isolation

All endpoints enforce tenant isolation:
- `tenantId` from session (via `requireAuth`)
- Never accept `tenantId` from query params or body
- All database queries filter by `tenantId`

## Graceful Degradation

When Policy Engine is unavailable:
- API routes return `200` with `{serviceUnavailable: true}` instead of `503`
- UI shows neutral banner: "Policy Engine is offline. Policy AI features are disabled."
- Manual tagging and classification still work
- Risk Detector shows message when AI analysis unavailable
- Bulk upload still saves files, but AI tagging will fail gracefully

## Migration Notes

Existing policies:
- New classification fields are optional
- Existing policies remain functional
- Can be tagged retrospectively via review queue or manual edit

Database indexes (recommended):
- `policy_documents.departmentIds` - Array index
- `policy_documents.setting` - Index
- `policy_documents.tagsStatus` - Index
- `practices.tenantId` + `practices.departmentId` - Compound index
- `risk_runs.tenantId` + `risk_runs.departmentId` - Compound index

## Testing

### Test Tag Suggestions
```bash
curl -X POST http://localhost:3000/api/policies/{policy-id}/suggest-tags \
  -H "Cookie: auth-token=..."
```

### Test Bulk Upload
```bash
curl -X POST http://localhost:3000/api/policies/bulk-upload \
  -F "files[]=@policy1.pdf" \
  -F "files[]=@policy2.pdf" \
  -H "Cookie: auth-token=..."
```

### Test Risk Detector
```bash
# Create practice
curl -X POST http://localhost:3000/api/risk-detector/practices \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=..." \
  -d '{
    "departmentId": "...",
    "setting": "IPD",
    "title": "Daily rounds",
    "description": "...",
    "frequency": "Daily"
  }'

# Run analysis
curl -X POST http://localhost:3000/api/risk-detector/run \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=..." \
  -d '{
    "departmentId": "...",
    "setting": "IPD",
    "practiceIds": ["practice-id"]
  }'
```
