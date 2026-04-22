# AI-Powered Policy Issues & Conflicts Implementation

## Overview

This document describes the AI-powered "Policy Issues & Conflicts" feature that uses vector search and LLM analysis to automatically detect issues, conflicts, gaps, ambiguities, duplications, outdated content, and risks in policy documents.

## Architecture

### Backend Endpoint

**POST `/v1/issues/ai`**

**Request Body:**
```json
{
  "query": "Find conflicts, gaps, and risks in these policies",
  "policyIds": ["policy-id-1", "policy-id-2"] | null,
  "topK": 20,
  "includeEvidence": true
}
```

**Response:**
```json
{
  "issues": [
    {
      "type": "CONTRADICTION",
      "severity": "HIGH",
      "title": "Brief title",
      "summary": "Description",
      "recommendation": "Actionable recommendation",
      "evidence": [
        {
          "policyId": "policy-id",
          "filename": "file.pdf",
          "page": 5,
          "chunkId": "chunk-id",
          "quote": "Relevant quote..."
        }
      ]
    }
  ],
  "meta": {
    "retrievedChunks": 20,
    "model": "gpt-4o"
  }
}
```

### Implementation Flow

1. **Vector Search**: Uses existing ChromaDB search to retrieve topK relevant chunks
2. **Policy Filtering**: If `policyIds` provided, filters chunks using ChromaDB `where` clause with `$in` operator
3. **LLM Analysis**: Sends retrieved chunks to GPT-4o with structured prompt
4. **JSON Parsing**: Parses LLM response, validates structure, retries once if JSON invalid
5. **Evidence Formatting**: Maps LLM evidence references to actual chunks with page numbers
6. **Caching**: Caches results for 30 minutes (keyed by tenantId + policyIds + query hash)

### Issue Types

- **CONTRADICTION**: Conflicting statements or requirements
- **GAP**: Missing information or incomplete procedures
- **AMBIGUITY**: Unclear or vague language
- **DUPLICATION**: Repeated or redundant content
- **OUTDATED**: Potentially outdated information or references
- **RISK**: Potential risks or compliance issues

### Severity Levels

- **LOW**: Minor issues that may need attention
- **MEDIUM**: Issues that should be addressed
- **HIGH**: Critical issues requiring immediate attention

## Frontend Integration

### AI Review Section

Added to `/policies/conflicts` page:

1. **Query Input**: Textarea with default suggestion
2. **Policy Multi-Select**: Optional checkbox list to filter by specific policies
3. **Run Button**: Triggers AI analysis
4. **Results Display**: Cards showing:
   - Issue type and severity badges
   - Title and summary
   - Evidence quotes with filename and page numbers
   - Recommendation with copy button
   - Expandable details dialog

### Evidence Display

Each issue shows:
- Policy filename
- Page number (if available)
- Quote snippet (first 500 chars)
- Chunk ID reference

## Metadata Requirements

Chunks already include page numbers in metadata:
- `page`: Page number (from `page_<n>.txt` filename)
- `pageNumber`: Same as `page` (for compatibility)
- `filename`: Policy filename
- `policyId`: Policy identifier
- `chunkId`: Unique chunk identifier

This is handled by `build_clean_chunks_from_pages()` in `app/chunking_enhanced.py`.

## Caching

- **TTL**: 30 minutes
- **Key Format**: `{tenantId}:{sorted(policyIds)}:{queryHash}`
- **Storage**: In-memory dictionary (simple, sufficient for single-server deployment)

## Error Handling

1. **Insufficient Context**: Returns empty issues array if < 3 chunks retrieved
2. **JSON Parse Errors**: Retries once with "fix JSON" prompt
3. **OpenAI API Errors**: Returns 503 with clear error message
4. **No Chunks Found**: Returns empty issues array with message in meta

## Testing

### Smoke Test Script

```bash
cd policy-engine
./app/scripts/test_ai_issues.sh [tenantId] [query]
```

### Manual Test

1. Upload a policy PDF
2. Wait for indexing to complete
3. Go to `/policies/conflicts`
4. Scroll to "AI Review" section
5. Enter query: "Find conflicts, gaps, and risks"
6. Optionally select specific policies
7. Click "Run AI Review"
8. Verify issues appear with evidence quotes and page numbers

## Files Created/Modified

### Created
- `policy-engine/app/api/routes_issues.py` - AI issues endpoint
- `app/api/policy-engine/issues/ai/route.ts` - Next.js proxy route
- `policy-engine/app/scripts/test_ai_issues.sh` - Smoke test script

### Modified
- `policy-engine/app/main.py` - Registered `routes_issues` router
- `policy-engine/app/vector_store.py` - Added `policy_ids` parameter to `search()` function
- `app/(dashboard)/policies/conflicts/page.tsx` - Added AI Review UI section

## Verification Checklist

1. ✅ Upload policy → index
2. ✅ Open Policy Conflicts & Issues → run query
3. ✅ See multiple issues (not only 1 chunk)
4. ✅ Evidence shows correct pages
5. ✅ Page numbers are accurate
6. ✅ Copy recommendation works
7. ✅ Details dialog shows all evidence items

## Notes

- Chunk metadata already includes page numbers (no changes needed)
- Vector search supports policy filtering via ChromaDB `$in` operator
- LLM prompt instructs model to ONLY use provided context
- JSON parsing includes retry logic for robustness
- Caching reduces API costs for repeated queries

