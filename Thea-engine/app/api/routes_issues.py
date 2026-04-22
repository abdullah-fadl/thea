"""
AI-powered Policy Issues & Conflicts API routes
"""
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import hashlib
import time
from app.config import settings
from app.embeddings import generate_embeddings
from app.vector_store import search, get_collection
from app.openai_client import get_openai_client


router = APIRouter()

# Simple in-memory cache (key: str, value: (result, timestamp))
_cache: Dict[str, tuple] = {}
CACHE_TTL = 30 * 60  # 30 minutes


class AIIssuesRequest(BaseModel):
    query: str
    policyIds: Optional[List[str]] = None
    topK: int = 20
    includeEvidence: bool = True


class EvidenceItem(BaseModel):
    policyId: str
    filename: str
    page: Optional[int] = None
    chunkId: str
    quote: str


class Issue(BaseModel):
    type: str  # "CONTRADICTION" | "GAP" | "AMBIGUITY" | "DUPLICATION" | "OUTDATED" | "RISK"
    severity: str  # "LOW" | "MEDIUM" | "HIGH"
    title: str
    summary: str
    recommendation: str
    evidence: List[EvidenceItem]


class AIIssuesResponse(BaseModel):
    issues: List[Issue]
    meta: Dict[str, Any]


def _get_cache_key(tenant_id: str, query: str, policy_ids: Optional[List[str]]) -> str:
    """Generate cache key"""
    policy_ids_str = ",".join(sorted(policy_ids or []))
    query_hash = hashlib.md5(query.encode()).hexdigest()[:8]
    return f"{tenant_id}:{policy_ids_str}:{query_hash}"


def _get_cached_result(cache_key: str) -> Optional[Dict[str, Any]]:
    """Get cached result if not expired"""
    if cache_key not in _cache:
        return None
    
    result, timestamp = _cache[cache_key]
    if time.time() - timestamp > CACHE_TTL:
        del _cache[cache_key]
        return None
    
    return result


def _cache_result(cache_key: str, result: Dict[str, Any]):
    """Cache result"""
    _cache[cache_key] = (result, time.time())


def _filter_chunks_by_policy(chunks: List[Dict[str, Any]], policy_ids: List[str]) -> List[Dict[str, Any]]:
    """Filter chunks to only include specified policy IDs"""
    if not policy_ids:
        return chunks
    
    filtered = []
    for chunk in chunks:
        metadata = chunk.get("metadata", {})
        chunk_policy_id = metadata.get("policyId")
        if chunk_policy_id in policy_ids:
            filtered.append(chunk)
    
    return filtered


def _format_evidence(chunk: Dict[str, Any]) -> EvidenceItem:
    """Format chunk as evidence item"""
    metadata = chunk.get("metadata", {})
    text = chunk.get("text", "")
    
    # Extract page number (try both 'page' and 'pageNumber')
    page = metadata.get("page") or metadata.get("pageNumber")
    if isinstance(page, str):
        try:
            page = int(page)
        except:
            page = None
    
    return EvidenceItem(
        policyId=metadata.get("policyId", ""),
        filename=metadata.get("filename", "unknown"),
        page=page,
        chunkId=chunk.get("chunk_id", ""),
        quote=text[:500]  # Limit quote length
    )


def _build_llm_prompt(query: str, chunks: List[Dict[str, Any]]) -> str:
    """Build prompt for LLM to analyze policy issues"""
    
    # Format chunks as context
    context_parts = []
    for i, chunk in enumerate(chunks):
        metadata = chunk.get("metadata", {})
        text = chunk.get("text", "")
        page = metadata.get("page") or metadata.get("pageNumber", "?")
        policy_id = metadata.get("policyId", "?")
        filename = metadata.get("filename", "?")
        
        context_parts.append(
            f"[Chunk {i+1}]\n"
            f"Policy: {filename} (ID: {policy_id})\n"
            f"Page: {page}\n"
            f"Text: {text}\n"
        )
    
    context = "\n---\n".join(context_parts)
    
    prompt = f"""You are a policy analysis expert. Analyze the following policy document chunks and identify issues, conflicts, gaps, ambiguities, duplications, outdated content, and risks.

Query/Question: {query}

Policy Chunks (Context):
{context}

Instructions:
1. ONLY use information from the provided chunks above. Do NOT use external knowledge.
2. Identify issues such as:
   - CONTRADICTION: Conflicting statements or requirements
   - GAP: Missing information or incomplete procedures
   - AMBIGUITY: Unclear or vague language
   - DUPLICATION: Repeated or redundant content
   - OUTDATED: Potentially outdated information or references
   - RISK: Potential risks or compliance issues
3. For each issue, provide:
   - type: One of CONTRADICTION, GAP, AMBIGUITY, DUPLICATION, OUTDATED, RISK
   - severity: LOW, MEDIUM, or HIGH
   - title: Brief title (max 50 chars)
   - summary: Clear description of the issue
   - recommendation: Actionable recommendation
   - evidence: List of evidence items, each with:
     * policyId: The policy ID from the chunk
     * filename: The filename from the chunk
     * page: The page number from the chunk (or null if not available)
     * chunkId: The chunk ID
     * quote: A relevant quote from the chunk text (max 200 chars)
4. If there is insufficient context to identify meaningful issues, return an empty issues array.
5. Return ONLY valid JSON matching this schema:
{{
  "issues": [
    {{
      "type": "CONTRADICTION",
      "severity": "HIGH",
      "title": "Brief title",
      "summary": "Description",
      "recommendation": "What to do",
      "evidence": [
        {{
          "policyId": "policy-id",
          "filename": "file.pdf",
          "page": 5,
          "chunkId": "chunk-id",
          "quote": "Relevant quote..."
        }}
      ]
    }}
  ]
}}

Return the JSON now:"""
    
    return prompt


def _parse_llm_response(response_text: str) -> Dict[str, Any]:
    """Parse LLM response and extract JSON"""
    # Try to extract JSON from response
    response_text = response_text.strip()
    
    # Remove markdown code blocks if present
    if response_text.startswith("```json"):
        response_text = response_text[7:]
    if response_text.startswith("```"):
        response_text = response_text[3:]
    if response_text.endswith("```"):
        response_text = response_text[:-3]
    response_text = response_text.strip()
    
    try:
        return json.loads(response_text)
    except json.JSONDecodeError as e:
        # Try to find JSON object in the text
        start_idx = response_text.find("{")
        end_idx = response_text.rfind("}")
        if start_idx >= 0 and end_idx > start_idx:
            try:
                return json.loads(response_text[start_idx:end_idx+1])
            except:
                pass
        raise ValueError(f"Failed to parse JSON from LLM response: {e}")


def _fix_json_prompt(original_prompt: str, error: str) -> str:
    """Create a prompt to fix JSON errors"""
    return f"""{original_prompt}

The previous response had a JSON parsing error: {error}

Please fix the JSON and return ONLY valid JSON matching the schema. Do not include any explanation or markdown formatting."""


@router.post("/v1/issues/ai", response_model=AIIssuesResponse)
async def ai_issues_endpoint(
    tenantId: str = Query(..., description="Tenant identifier"),
    request_body: AIIssuesRequest = Body(...)
):
    """
    AI-powered policy issues and conflicts detection
    
    Uses vector search to retrieve relevant chunks, then LLM analysis to identify
    issues, conflicts, gaps, ambiguities, duplications, outdated content, and risks.
    """
    try:
        query = request_body.query.strip()
        if not query:
            raise HTTPException(status_code=400, detail="Query cannot be empty")
        
        # Check cache
        cache_key = _get_cache_key(tenantId, query, request_body.policyIds)
        cached_result = _get_cached_result(cache_key)
        if cached_result:
            return AIIssuesResponse(**cached_result)
        
        # Get OpenAI client
        openai_client = get_openai_client()
        if not openai_client:
            raise HTTPException(
                status_code=503,
                detail="OpenAI client not available. Please set OPENAI_API_KEY environment variable."
            )
        
        # Generate query embedding
        query_embedding = generate_embeddings([query])[0]
        
        # Search for relevant chunks
        top_k = min(request_body.topK, 50)  # Cap at 50
        search_results = search(tenantId, query, query_embedding, top_k=top_k, policy_ids=request_body.policyIds)
        
        if not search_results:
            return AIIssuesResponse(
                issues=[],
                meta={
                    "retrievedChunks": 0,
                    "model": "gpt-4o",
                    "message": "No chunks found in vector store"
                }
            )
        
        # Note: Filtering by policyIds is now done in search() function via where clause
        # But we still filter here as a safeguard
        if request_body.policyIds and search_results:
            search_results = _filter_chunks_by_policy(search_results, request_body.policyIds)
        
        if not search_results:
            return AIIssuesResponse(
                issues=[],
                meta={
                    "retrievedChunks": 0,
                    "model": "gpt-4o",
                    "message": "No chunks found matching specified policy IDs"
                }
            )
        
        # Check if we have enough context (at least 3 chunks)
        if len(search_results) < 3:
            return AIIssuesResponse(
                issues=[],
                meta={
                    "retrievedChunks": len(search_results),
                    "model": "gpt-4o",
                    "message": "Insufficient context (less than 3 chunks retrieved)"
                }
            )
        
        # Build prompt
        prompt = _build_llm_prompt(query, search_results)
        
        # Call OpenAI
        model = "gpt-4o"  # Use gpt-4o for better analysis
        max_retries = 2
        llm_response = None
        
        for attempt in range(max_retries):
            try:
                response = openai_client.chat.completions.create(
                    model=model,
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a policy analysis expert. Always return valid JSON only."
                        },
                        {
                            "role": "user",
                            "content": prompt if attempt == 0 else _fix_json_prompt(prompt, str(llm_response))
                        }
                    ],
                    temperature=0.3,
                    max_tokens=4000
                )
                
                response_text = response.choices[0].message.content or ""
                parsed = _parse_llm_response(response_text)
                
                # Validate structure
                if "issues" not in parsed:
                    parsed = {"issues": []}
                
                # Format issues with evidence
                formatted_issues = []
                for issue_data in parsed.get("issues", []):
                    # Ensure evidence is properly formatted
                    evidence_list = []
                    if request_body.includeEvidence:
                        for ev in issue_data.get("evidence", []):
                            # Find matching chunk
                            chunk_id = ev.get("chunkId", "")
                            matching_chunk = next(
                                (c for c in search_results if c.get("chunk_id") == chunk_id),
                                None
                            )
                            if matching_chunk:
                                evidence_list.append(_format_evidence(matching_chunk))
                            else:
                                # Use evidence data directly if chunk not found
                                evidence_list.append(EvidenceItem(
                                    policyId=ev.get("policyId", ""),
                                    filename=ev.get("filename", "unknown"),
                                    page=ev.get("page"),
                                    chunkId=chunk_id,
                                    quote=ev.get("quote", "")[:500]
                                ))
                    
                    formatted_issue = Issue(
                        type=issue_data.get("type", "RISK"),
                        severity=issue_data.get("severity", "MEDIUM"),
                        title=issue_data.get("title", "Untitled Issue"),
                        summary=issue_data.get("summary", ""),
                        recommendation=issue_data.get("recommendation", ""),
                        evidence=evidence_list
                    )
                    formatted_issues.append(formatted_issue)
                
                result = {
                    "issues": [issue.dict() for issue in formatted_issues],
                    "meta": {
                        "retrievedChunks": len(search_results),
                        "model": model
                    }
                }
                
                # Cache result
                _cache_result(cache_key, result)
                
                return AIIssuesResponse(**result)
                
            except (ValueError, json.JSONDecodeError) as e:
                if attempt < max_retries - 1:
                    continue  # Retry with fix JSON prompt
                else:
                    # Last attempt failed, return empty issues
                    print(f"[AI Issues] Failed to parse LLM response after {max_retries} attempts: {e}")
                    return AIIssuesResponse(
                        issues=[],
                        meta={
                            "retrievedChunks": len(search_results),
                            "model": model,
                            "error": f"Failed to parse LLM response: {str(e)}"
                        }
                    )
            except Exception as e:
                print(f"[AI Issues] Error calling OpenAI: {e}")
                raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to analyze issues: {str(e)}")

