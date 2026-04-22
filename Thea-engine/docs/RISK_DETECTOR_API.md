# Risk Detector API Documentation

## Endpoint: POST /v1/risk-detector/analyze

Analyzes daily practices against policies to detect gaps and risks.

### Request

**URL:** `POST /v1/risk-detector/analyze`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "department": "string (department name)",
  "setting": "IPD" | "OPD" | "Corporate" | "Shared",
  "practices": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "frequency": "Rare" | "Occasional" | "Frequent" | "Daily" (optional)
    }
  ],
  "policies": [
    {
      "id": "string",
      "documentId": "string",
      "title": "string"
    }
  ],
  "tenantId": "string (optional, default: 'default')"
}
```

### Response

**200 OK:**
```json
{
  "practices": [
    {
      "practiceId": "string",
      "status": "Covered" | "Partial" | "NoPolicy" | "Conflict",
      "relatedPolicies": [
        {
          "policyId": "string",
          "title": "string",
          "documentId": "string",
          "citations": [
            {
              "pageNumber": 1,
              "snippet": "relevant text excerpt..."
            }
          ]
        }
      ],
      "severity": "Low" | "Med" | "High" | "Critical",
      "likelihood": 0.8,
      "riskScore": 75,
      "recommendations": [
        "Create a policy for...",
        "Clarify guidance on..."
      ]
    }
  ],
  "metadata": {
    "totalPractices": 1,
    "policiesAnalyzed": 5,
    "model": "gpt-4o-mini",
    "analyzedAt": "2025-01-02T01:00:00.000Z"
  }
}
```

### Manual Test

Test the endpoint locally:

```bash
curl -i -X POST http://localhost:8001/v1/risk-detector/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "department": "ICU",
    "setting": "IPD",
    "practices": [
      {
        "id": "practice-1",
        "title": "External breast milk handling",
        "description": "Family brings expressed breast milk from outside the hospital",
        "frequency": "Daily"
      }
    ],
    "policies": [
      {
        "id": "policy-1",
        "documentId": "POL-2025-001",
        "title": "Infection Control Policy"
      }
    ],
    "tenantId": "default"
  }'
```

Expected: `200 OK` with analysis results.

---

## Endpoint: POST /v1/policies/draft

Generates a draft policy based on practice and gap analysis findings.

### Request

**URL:** `POST /v1/policies/draft`

**Body:**
```json
{
  "practice": {
    "title": "string",
    "description": "string",
    "frequency": "string"
  },
  "findings": {
    "status": "NoPolicy",
    "recommendations": ["string"]
  },
  "department": "string",
  "setting": "IPD" | "OPD" | "Corporate" | "Shared",
  "tenantId": "string (optional)"
}
```

### Response

**200 OK:**
```json
{
  "draft": {
    "sections": [
      {
        "title": "Purpose",
        "content": "Full text content..."
      },
      {
        "title": "Scope",
        "content": "Full text content..."
      }
    ]
  }
}
```

### Manual Test

```bash
curl -i -X POST http://localhost:8001/v1/policies/draft \
  -H "Content-Type: application/json" \
  -d '{
    "practice": {
      "title": "External breast milk handling",
      "description": "Family brings expressed breast milk",
      "frequency": "Daily"
    },
    "findings": {
      "status": "NoPolicy",
      "recommendations": ["Create policy for external breast milk handling"]
    },
    "department": "ICU",
    "setting": "IPD",
    "tenantId": "default"
  }'
```

Expected: `200 OK` with draft policy sections.
