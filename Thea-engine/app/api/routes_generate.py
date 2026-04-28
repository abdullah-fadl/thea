"""Policy generation API routes"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.openai_client import get_openai_client
from app.config import settings


router = APIRouter()


class GenerateRequest(BaseModel):
    tenantId: str
    title: str
    context: str
    standard: str  # "CBAHI" | "JCI" | "Local"


class GenerateResponse(BaseModel):
    tenantId: str
    title: str
    policy: str


@router.post("/v1/generate", response_model=GenerateResponse)
async def generate_policy(request: GenerateRequest):
    """
    Generate new policy using OpenAI
    
    Args:
        request: Generate request
    """
    openai_client = get_openai_client()
    
    if not openai_client:
        raise HTTPException(
            status_code=503,
            detail="OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable."
        )
    
    # Build prompt based on standard
    standard_guidance = {
        "CBAHI": "Saudi Central Board for Accreditation of Healthcare Institutions (CBAHI) standards",
        "JCI": "Joint Commission International (JCI) accreditation standards",
        "Local": "local hospital policies and best practices"
    }
    
    standard_desc = standard_guidance.get(request.standard, request.standard)
    
    system_prompt = f"""You are an expert in hospital policy writing. Generate comprehensive, clear, and actionable policy documents that meet {standard_desc}.

Guidelines:
- Use clear, professional medical terminology
- Structure the policy with sections: Purpose, Scope, Definitions, Procedures, Responsibilities
- Include specific, actionable steps
- Reference relevant standards and best practices
- Ensure compliance with healthcare regulations
- Make it practical and implementable
"""
    
    user_prompt = f"""Generate a hospital policy document with the following specifications:

Title: {request.title}

Context: {request.context}

Standard: {request.standard}

Please generate a complete, well-structured policy document that addresses the context provided and follows the specified standard."""
    
    try:
        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=4000,
        )
        
        generated_policy = completion.choices[0].message.content or ""
        
        return GenerateResponse(
            tenantId=request.tenantId,
            title=request.title,
            policy=generated_policy
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate policy: {str(e)}"
        )
