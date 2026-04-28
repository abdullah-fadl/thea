"""Harmonization API routes"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from pathlib import Path
from app.openai_client import get_openai_client
from app.manifest import load_manifest
from app.config import settings


router = APIRouter()


class HarmonizeRequest(BaseModel):
    tenantId: str
    topic: str
    policyIds: List[str]


class HarmonizeResponse(BaseModel):
    tenantId: str
    topic: str
    unifiedPolicy: str
    sources: List[str]


def read_policy_text(tenant_id: str, policy_id: str) -> str:
    """Read policy text from storage"""
    try:
        data_dir = Path(settings.data_dir)
        # Try new path first: data/<tenantId>/<policyId>/text/
        text_dir = data_dir / tenant_id / policy_id / "text"
        if not text_dir.exists():
            # Fallback to old path: data/text/<tenantId>/<policyId>/
            text_dir = data_dir / "text" / tenant_id / policy_id
        
        if not text_dir.exists():
            return ""
        
        # Read all page text files
        text_parts = []
        page_files = sorted(text_dir.glob("page_*.txt"))
        
        for page_file in page_files:
            with open(page_file, "r", encoding="utf-8") as f:
                text_parts.append(f.read())
        
        return "\n\n".join(text_parts)
    except Exception as e:
        print(f"Error reading policy text for {policy_id}: {e}")
        return ""


@router.post("/v1/harmonize", response_model=HarmonizeResponse)
async def harmonize_policies(request: HarmonizeRequest):
    """
    Harmonize policies using OpenAI
    
    Args:
        request: Harmonize request
    """
    openai_client = get_openai_client()
    
    if not openai_client:
        raise HTTPException(
            status_code=503,
            detail="OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable."
        )
    
    # Load policy texts
    policy_contexts = []
    for policy_id in request.policyIds:
        manifest = load_manifest(request.tenantId, policy_id)
        if not manifest:
            continue
        
        filename = manifest.get("filename", policy_id)
        text_content = read_policy_text(request.tenantId, policy_id)
        
        if text_content:
            policy_contexts.append({
                "id": policy_id,
                "filename": filename,
                "content": text_content
            })
    
    if not policy_contexts:
        raise HTTPException(
            status_code=404,
            detail="No policy content found for the provided policy IDs"
        )
    
    # Build context string
    context_parts = []
    for i, policy in enumerate(policy_contexts, 1):
        context_parts.append(f"Policy {i}: {policy['filename']} (ID: {policy['id']})\n{policy['content']}\n---")
    
    context_string = "\n\n".join(context_parts)
    
    system_prompt = """You are an expert in hospital policy harmonization. Your task is to create a unified, comprehensive policy that combines the best elements from multiple policy documents while resolving conflicts and inconsistencies.

Guidelines:
- Merge similar content from different policies
- Resolve contradictions by choosing the most appropriate or comprehensive approach
- Maintain clear structure and organization
- Preserve important details from all sources
- Ensure the unified policy is coherent and actionable
- Note any significant differences or choices made
"""
    
    user_prompt = f"""Harmonize the following policies on the topic: {request.topic}

Policies to harmonize:
{context_string}

Please generate a unified policy document that combines the best elements from these policies, resolving any conflicts or inconsistencies."""
    
    try:
        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.5,
            max_tokens=4000,
        )
        
        unified_policy = completion.choices[0].message.content or ""
        
        return HarmonizeResponse(
            tenantId=request.tenantId,
            topic=request.topic,
            unifiedPolicy=unified_policy,
            sources=request.policyIds
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to harmonize policies: {str(e)}"
        )
