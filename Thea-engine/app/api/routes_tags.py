"""Tags API routes"""
from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from app.openai_client import get_openai_client
from app.config import settings
import json


router = APIRouter()


class SuggestTagsRequest(BaseModel):
    filename: str
    sample_text: Optional[str] = None
    tenantId: str = "default"


class DepartmentSuggestion(BaseModel):
    id: str
    label: str
    confidence: float


class TagSuggestion(BaseModel):
    value: str
    confidence: float


class SuggestTagsResponse(BaseModel):
    departments: Optional[List[DepartmentSuggestion]] = None
    setting: Optional[TagSuggestion] = None
    type: Optional[TagSuggestion] = None
    scope: Optional[TagSuggestion] = None
    overallConfidence: Optional[float] = None
    model: Optional[str] = None


# Common department names (can be enhanced with actual department IDs from DB)
DEPARTMENT_KEYWORDS = {
    "cardiology": {"id": "dept-cardiology", "label": "Cardiology"},
    "cardiac": {"id": "dept-cardiology", "label": "Cardiology"},
    "nursing": {"id": "dept-nursing", "label": "Nursing"},
    "icu": {"id": "dept-icu", "label": "ICU"},
    "emergency": {"id": "dept-emergency", "label": "Emergency"},
    "er": {"id": "dept-emergency", "label": "Emergency"},
    "pharmacy": {"id": "dept-pharmacy", "label": "Pharmacy"},
    "radiology": {"id": "dept-radiology", "label": "Radiology"},
    "laboratory": {"id": "dept-lab", "label": "Laboratory"},
    "lab": {"id": "dept-lab", "label": "Laboratory"},
    "surgery": {"id": "dept-surgery", "label": "Surgery"},
    "pediatrics": {"id": "dept-pediatrics", "label": "Pediatrics"},
    "pediatric": {"id": "dept-pediatrics", "label": "Pediatrics"},
    "orthopedics": {"id": "dept-orthopedics", "label": "Orthopedics"},
    "oncology": {"id": "dept-oncology", "label": "Oncology"},
}


@router.post("/v1/tags/suggest", response_model=SuggestTagsResponse)
async def suggest_tags(request: SuggestTagsRequest):
    """
    Suggest tags for a policy document using AI.
    
    Analyzes filename and sample text to suggest:
    - Departments (multi-select)
    - Setting (IPD/OPD/Corporate/Shared)
    - Policy Type (Clinical/Admin/HR/Quality/IC/Medication/Other)
    - Scope (HospitalWide/DepartmentOnly/UnitSpecific)
    """
    try:
        client = get_openai_client()
        if not client:
            raise HTTPException(
                status_code=503,
                detail="OpenAI client not available. Check OPENAI_API_KEY."
            )

        # Combine filename and sample text for analysis
        text_to_analyze = f"Filename: {request.filename}"
        if request.sample_text:
            text_to_analyze += f"\n\nFirst page content:\n{request.sample_text[:2000]}"
        else:
            text_to_analyze += "\n\nNo content available (image-based PDF or empty)"

        # Create prompt for tag suggestion
        prompt = f"""Analyze the following policy document and suggest classification tags.

Document information:
{text_to_analyze}

Please provide:
1. **Departments**: List relevant departments (multi-select, max 5). Consider keywords like: Cardiology, Nursing, ICU, Emergency, Pharmacy, Radiology, Laboratory, Surgery, Pediatrics, Orthopedics, Oncology.

2. **Setting**: One of: IPD (Inpatient Department), OPD (Outpatient Department), Corporate, Shared, Unknown

3. **Policy Type**: One of: Clinical, Admin, HR, Quality, IC (Infection Control), Medication, Other, Unknown

4. **Scope**: One of: HospitalWide, DepartmentOnly, UnitSpecific, Unknown

Return JSON in this format:
{{
  "departments": [
    {{"id": "dept-cardiology", "label": "Cardiology", "confidence": 0.9}},
    {{"id": "dept-nursing", "label": "Nursing", "confidence": 0.7}}
  ],
  "setting": {{"value": "IPD", "confidence": 0.85}},
  "type": {{"value": "Clinical", "confidence": 0.9}},
  "scope": {{"value": "HospitalWide", "confidence": 0.8}}
}}

Provide confidence scores (0.0-1.0) for each suggestion. Use confidence < 0.6 for uncertain suggestions.
Only include departments if there's clear evidence in the text. Maximum 5 departments.
"""

        # Call OpenAI
        model = "gpt-4o-mini"  # Fast and cost-effective for tagging
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a healthcare policy classification assistant. Analyze policy documents and suggest accurate classification tags with confidence scores. Return only valid JSON."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,  # Lower temperature for more consistent tagging
            response_format={"type": "json_object"},
        )

        result_text = response.choices[0].message.content
        if not result_text:
            raise HTTPException(status_code=500, detail="Empty response from AI")

        # Parse JSON response
        try:
            result = json.loads(result_text)
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Invalid JSON response from AI: {str(e)}"
            )

        # Extract and validate results
        departments = []
        if "departments" in result and isinstance(result["departments"], list):
            for dept in result["departments"][:5]:  # Limit to 5
                if isinstance(dept, dict) and "id" in dept and "label" in dept:
                    confidence = dept.get("confidence", 0.5)
                    departments.append({
                        "id": dept["id"],
                        "label": dept["label"],
                        "confidence": float(confidence)
                    })

        setting = None
        if "setting" in result and isinstance(result["setting"], dict):
            setting_val = result["setting"].get("value", "Unknown")
            setting_conf = result["setting"].get("confidence", 0.5)
            # Validate setting value
            if setting_val in ["IPD", "OPD", "Corporate", "Shared", "Unknown"]:
                setting = {"value": setting_val, "confidence": float(setting_conf)}

        policy_type = None
        if "type" in result and isinstance(result["type"], dict):
            type_val = result["type"].get("value", "Unknown")
            type_conf = result["type"].get("confidence", 0.5)
            # Validate type value
            if type_val in ["Clinical", "Admin", "HR", "Quality", "IC", "Medication", "Other", "Unknown"]:
                policy_type = {"value": type_val, "confidence": float(type_conf)}

        scope = None
        if "scope" in result and isinstance(result["scope"], dict):
            scope_val = result["scope"].get("value", "Unknown")
            scope_conf = result["scope"].get("confidence", 0.5)
            # Validate scope value
            if scope_val in ["HospitalWide", "DepartmentOnly", "UnitSpecific", "Unknown"]:
                scope = {"value": scope_val, "confidence": float(scope_conf)}

        # Calculate overall confidence
        confidences = []
        if setting and "confidence" in setting:
            confidences.append(setting["confidence"])
        if policy_type and "confidence" in policy_type:
            confidences.append(policy_type["confidence"])
        if scope and "confidence" in scope:
            confidences.append(scope["confidence"])
        if departments:
            confidences.extend([d["confidence"] for d in departments])
        overall_conf = sum(confidences) / len(confidences) if confidences else 0.5

        return {
            "departments": departments if departments else None,
            "setting": setting,
            "type": policy_type,
            "scope": scope,
            "overallConfidence": overall_conf,
            "model": model,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in suggest_tags: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to suggest tags: {str(e)}"
        )
