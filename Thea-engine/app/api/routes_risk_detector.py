"""Risk Detector API routes"""
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.openai_client import get_openai_client
from app.config import settings
import json
import math


router = APIRouter()


class PracticeInput(BaseModel):
    id: str
    title: str
    description: str
    frequency: Optional[str] = None


class PolicyInput(BaseModel):
    id: str
    documentId: str
    title: str


class AnalyzeRequest(BaseModel):
    department: str
    setting: str
    practices: List[PracticeInput]
    policies: List[PolicyInput]
    tenantId: str = "default"


class PolicyCitation(BaseModel):
    policyId: str
    title: str
    documentId: str
    citations: List[Dict[str, Any]]  # [{pageNumber, snippet}]


class TraceStep(BaseModel):
    step: str
    timestamp: Optional[str] = None


class RiskModel(BaseModel):
    severity: str  # "Low" | "Med" | "High" | "Critical"
    probability: float  # 0-1 (FMEA Probability/Occurrence)
    detectability: float  # 0-1 (FMEA Detectability, inverted: 1 = hard to detect)
    baseRPN: int  # Risk Priority Number = severity * probability * detectability (1-1000 scale)
    normalizedScore: float  # 0-100 normalized from RPN
    modifiersApplied: Dict[str, float]  # {"noPolicy": 0.25, "noTraining": 0.15, etc.}
    finalScore: float  # 0-100 after modifiers


class AccreditationReference(BaseModel):
    standard: str  # "ISO 31000", "ISO 14971", etc.
    clause: str
    description: str


class Evidence(BaseModel):
    policiesReviewed: List[Dict[str, str]]  # [{"id": "...", "title": "..."}]
    riskModel: RiskModel
    accreditationReferences: List[AccreditationReference]


class PracticeResult(BaseModel):
    practiceId: str
    status: str  # "Covered" | "Partial" | "NoPolicy" | "Conflict"
    relatedPolicies: List[PolicyCitation]
    severity: str  # "Low" | "Med" | "High" | "Critical"
    likelihood: float  # 0-1
    riskScore: int  # 0-100 (final score)
    recommendations: List[str]
    trace: Dict[str, Any]  # {"steps": ["step1", "step2", ...]}
    reason: List[str]  # ["reason1", "reason2", ...]
    evidence: Evidence


class AnalyzeResponse(BaseModel):
    practices: List[PracticeResult]
    metadata: Optional[Dict[str, Any]] = None


# FMEA Severity mapping (1-10 scale, mapped to Low/Med/High/Critical)
SEVERITY_MAPPING = {
    "Low": 3,
    "Med": 5,
    "High": 8,
    "Critical": 10
}

# Critical areas that get multiplier
CRITICAL_AREAS = ["ICU", "NICU", "PICU", "Medication", "Pharmacy", "Surgery", "ER", "Emergency"]

# Accreditation references database
ACCREDITATION_REFERENCES = {
    "ISO 31000": {
        "clause": "ISO 31000:2018 Risk Management",
        "description": "Framework for risk management processes and principles"
    },
    "ISO 14971": {
        "clause": "ISO 14971:2019 Medical Devices - Risk Management",
        "description": "Application of risk management to medical devices"
    },
    "WHO Patient Safety": {
        "clause": "WHO Patient Safety Framework",
        "description": "Global standards for patient safety and quality of care"
    },
    "JCI IPSG": {
        "clause": "Joint Commission International - International Patient Safety Goals",
        "description": "Core patient safety goals including medication safety, infection prevention"
    },
    "CBAHI Patient Safety Standards": {
        "clause": "CBAHI Standards - Patient Safety",
        "description": "Saudi healthcare accreditation standards for patient safety and quality"
    }
}


def calculate_fmea_score(
    severity_str: str,
    probability: float,
    setting: str,
    department: str,
    has_policy: bool,
    has_training: bool = False,
    has_monitoring: bool = False
) -> Dict[str, Any]:
    """
    Calculate FMEA-based risk score with governance modifiers.
    
    Returns:
        {
            "severity": str,
            "probability": float,
            "detectability": float,
            "baseRPN": int,
            "normalizedScore": float,
            "modifiersApplied": dict,
            "finalScore": float
        }
    """
    # Map severity to numeric (1-10 scale)
    severity_num = SEVERITY_MAPPING.get(severity_str, 5)
    
    # Probability is already 0-1, map to 1-10 scale for RPN
    probability_num = max(1, min(10, math.ceil(probability * 10)))
    
    # Detectability: inverse of how easy it is to detect the issue
    # No policy = harder to detect (higher detectability score = worse)
    # Critical areas = harder to detect complex issues
    detectability_base = 5  # Default medium detectability
    if not has_policy:
        detectability_base += 2  # Harder to detect without policy guidance
    if department in CRITICAL_AREAS or any(crit in department for crit in CRITICAL_AREAS):
        detectability_base += 1  # Critical areas have more complex detection
    detectability_num = max(1, min(10, detectability_base))
    
    # Calculate RPN (Risk Priority Number) = Severity × Probability × Detectability
    base_rpn = severity_num * probability_num * detectability_num
    
    # Normalize RPN (max 1000) to 0-100 scale
    normalized_score = (base_rpn / 1000.0) * 100
    
    # Apply governance modifiers (additive percentage increases)
    modifiers_applied = {}
    modifier_total = 0.0
    
    if not has_policy:
        modifiers_applied["noPolicy"] = 0.25  # +25%
        modifier_total += 0.25
    
    if not has_training:
        modifiers_applied["noTraining"] = 0.15  # +15%
        modifier_total += 0.15
    
    if not has_monitoring:
        modifiers_applied["noMonitoring"] = 0.10  # +10%
        modifier_total += 0.10
    
    # Critical area multiplier (additional 10% if in critical area)
    is_critical_area = department in CRITICAL_AREAS or any(crit in department for crit in CRITICAL_AREAS)
    if is_critical_area:
        modifiers_applied["criticalArea"] = 0.10  # +10%
        modifier_total += 0.10
    
    # Apply modifiers: increase score by percentage
    final_score = normalized_score * (1.0 + modifier_total)
    final_score = min(100.0, final_score)  # Cap at 100
    
    return {
        "severity": severity_str,
        "probability": probability,
        "detectability": detectability_num / 10.0,  # Return as 0-1 for consistency
        "baseRPN": base_rpn,
        "normalizedScore": round(normalized_score, 2),
        "modifiersApplied": modifiers_applied,
        "finalScore": round(final_score, 2)
    }


def generate_trace_steps(
    practice_title: str,
    policies_count: int,
    has_policy: bool,
    status: str
) -> Dict[str, Any]:
    """Generate trace steps for the analysis process."""
    from datetime import datetime
    steps = [
        f"Practice '{practice_title}' identified",
        f"{policies_count} relevant policies searched",
    ]
    
    if has_policy:
        if status == "Covered":
            steps.append("Applicable policy found - practice is covered")
        elif status == "Partial":
            steps.append("Partial policy coverage identified")
        elif status == "Conflict":
            steps.append("Conflicting policies detected")
    else:
        steps.append("No applicable policy found")
    
    steps.extend([
        "FMEA scoring applied (Severity × Probability × Detectability)",
        "Governance modifiers applied (no policy, no training, no monitoring, critical area)",
        "Risk score normalized to 0-100 scale",
        "Accreditation references identified"
    ])
    
    return {
        "steps": steps,
        "analyzedAt": datetime.utcnow().isoformat() + "Z"
    }


def generate_reason(
    practice: PracticeInput,
    setting: str,
    department: str,
    status: str,
    has_policy: bool,
    risk_model: Dict[str, Any]
) -> List[str]:
    """Generate reason array explaining why this score occurred."""
    reasons = []
    
    # Frequency and setting context
    if practice.frequency:
        reasons.append(f"Practice occurs {practice.frequency.lower()} in {setting} setting")
    else:
        reasons.append(f"Practice occurs in {setting} setting")
    
    # Department context
    if department in CRITICAL_AREAS or any(crit in department for crit in CRITICAL_AREAS):
        reasons.append(f"High-risk department ({department}) with vulnerable patient population")
    else:
        reasons.append(f"Department: {department}")
    
    # Policy status
    if not has_policy:
        reasons.append("No approved policy governing this practice")
    elif status == "Partial":
        reasons.append("Partial policy coverage - gaps exist")
    elif status == "Conflict":
        reasons.append("Conflicting policy guidance detected")
    
    # Risk factors from modifiers
    modifiers = risk_model.get("modifiersApplied", {})
    if "noPolicy" in modifiers:
        reasons.append("Governance gap: No documented policy requirement")
    if "noTraining" in modifiers:
        reasons.append("Governance gap: No training requirement documented")
    if "noMonitoring" in modifiers:
        reasons.append("Governance gap: No monitoring/audit process exists")
    if "criticalArea" in modifiers:
        reasons.append("Critical care multiplier applied - higher risk environment")
    
    # Severity context
    severity = risk_model.get("severity", "Med")
    if severity in ["High", "Critical"]:
        reasons.append(f"{severity} severity - significant potential impact on patient safety")
    
    return reasons


def get_applicable_accreditation_references(
    setting: str,
    department: str,
    status: str
) -> List[AccreditationReference]:
    """Get relevant accreditation references based on context."""
    references = []
    
    # Always include core risk management standards
    references.append(AccreditationReference(
        standard="ISO 31000",
        clause=ACCREDITATION_REFERENCES["ISO 31000"]["clause"],
        description=ACCREDITATION_REFERENCES["ISO 31000"]["description"]
    ))
    
    # Medical device/clinical practice context
    references.append(AccreditationReference(
        standard="ISO 14971",
        clause=ACCREDITATION_REFERENCES["ISO 14971"]["clause"],
        description=ACCREDITATION_REFERENCES["ISO 14971"]["description"]
    ))
    
    # Patient safety standards
    references.append(AccreditationReference(
        standard="WHO Patient Safety",
        clause=ACCREDITATION_REFERENCES["WHO Patient Safety"]["clause"],
        description=ACCREDITATION_REFERENCES["WHO Patient Safety"]["description"]
    ))
    
    # JCI for international standards
    references.append(AccreditationReference(
        standard="JCI IPSG",
        clause=ACCREDITATION_REFERENCES["JCI IPSG"]["clause"],
        description=ACCREDITATION_REFERENCES["JCI IPSG"]["description"]
    ))
    
    # CBAHI for Saudi context
    references.append(AccreditationReference(
        standard="CBAHI Patient Safety Standards",
        clause=ACCREDITATION_REFERENCES["CBAHI Patient Safety Standards"]["clause"],
        description=ACCREDITATION_REFERENCES["CBAHI Patient Safety Standards"]["description"]
    ))
    
    return references


@router.post("/v1/risk-detector/analyze", response_model=AnalyzeResponse)
async def analyze_gaps(request: AnalyzeRequest):
    """
    Analyze practices against policies to detect gaps.
    
    For each practice, determines:
    - status: Covered/Partial/NoPolicy/Conflict
    - relatedPolicies: Matching policies with citations
    - severity, likelihood, riskScore (FMEA-based with governance modifiers)
    - recommendations
    - trace: Analysis steps
    - reason: Why this score occurred
    - evidence: Policies reviewed, risk model details, accreditation references
    
    Manual test:
    curl -i -X POST http://localhost:8001/v1/risk-detector/analyze \\
      -H "Content-Type: application/json" \\
      -d '{"department":"ICU","setting":"IPD","practices":[{"id":"p1","title":"Test","description":"Test practice"}],"policies":[],"tenantId":"default"}'
    """
    try:
        client = get_openai_client()
        if not client:
            raise HTTPException(
                status_code=503,
                detail="OpenAI client not available. Check OPENAI_API_KEY."
            )

        results = []

        for practice in request.practices:
            # Build prompt for this practice
            policies_text = "\n".join([
                f"- {p.title} (ID: {p.documentId})" for p in request.policies[:20]  # Limit to 20 policies
            ])

            prompt = f"""You are a healthcare risk assessment assistant. Analyze if a daily practice is covered by existing policies.

**Department**: {request.department}
**Setting**: {request.setting}
**Practice**:
- Title: {practice.title}
- Description: {practice.description}
- Frequency: {practice.frequency or 'Unknown'}

**Available Policies** (relevant to department or hospital-wide):
{policies_text if policies_text else "No policies available"}

Analyze whether this practice is:
1. **Covered**: Fully addressed by existing policies
2. **Partial**: Partially addressed, but some gaps exist
3. **NoPolicy**: Not covered by any existing policy (risk)
4. **Conflict**: Conflicting guidance between policies

Return JSON in this format:
{{
  "status": "NoPolicy",
  "relatedPolicies": [
    {{
      "policyId": "policy-id-1",
      "title": "Policy Title",
      "documentId": "POL-2025-XXXXX",
      "citations": [
        {{"pageNumber": 1, "snippet": "relevant text excerpt..."}}
      ]
    }}
  ],
  "severity": "High",
  "likelihood": 0.8,
  "recommendations": [
    "Create a policy for...",
    "Clarify guidance on..."
  ],
  "hasTraining": false,
  "hasMonitoring": false
}}

Guidelines:
- status: "Covered" if practice fully addressed, "Partial" if partially, "NoPolicy" if not addressed, "Conflict" if contradictions
- severity: "Low", "Med", "High", or "Critical" based on impact
- likelihood: 0.0-1.0 (probability of issue occurring)
- recommendations: 2-4 actionable recommendations
- hasTraining: true if policy/documentation indicates training requirement exists
- hasMonitoring: true if policy/documentation indicates monitoring/audit process exists
- Include relatedPolicies only if status is "Covered", "Partial", or "Conflict"
- If status is "NoPolicy", relatedPolicies should be empty or minimal
"""

            # Call OpenAI
            model = "gpt-4o-mini"
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a healthcare risk assessment expert. Analyze practices against policies and provide structured JSON responses."
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                response_format={"type": "json_object"},
            )

            result_text = response.choices[0].message.content
            if not result_text:
                raise HTTPException(
                    status_code=500,
                    detail=f"Empty response from AI for practice {practice.id}"
                )

            # Parse JSON response
            try:
                result = json.loads(result_text)
            except json.JSONDecodeError as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Invalid JSON response from AI: {str(e)}"
                )

            # Validate and structure result
            status = result.get("status", "NoPolicy")
            if status not in ["Covered", "Partial", "NoPolicy", "Conflict"]:
                status = "NoPolicy"

            severity = result.get("severity", "Med")
            if severity not in ["Low", "Med", "High", "Critical"]:
                severity = "Med"

            likelihood = float(result.get("likelihood", 0.5))
            likelihood = max(0.0, min(1.0, likelihood))
            
            has_policy = status in ["Covered", "Partial", "Conflict"] and len(result.get("relatedPolicies", [])) > 0
            has_training = result.get("hasTraining", False)
            has_monitoring = result.get("hasMonitoring", False)

            # Calculate FMEA-based risk score with governance modifiers
            risk_model = calculate_fmea_score(
                severity_str=severity,
                probability=likelihood,
                setting=request.setting,
                department=request.department,
                has_policy=has_policy,
                has_training=has_training,
                has_monitoring=has_monitoring
            )
            
            final_risk_score = int(round(risk_model["finalScore"]))

            related_policies = []
            if "relatedPolicies" in result and isinstance(result["relatedPolicies"], list):
                for rp in result["relatedPolicies"][:10]:  # Limit to 10
                    if isinstance(rp, dict) and "policyId" in rp:
                        # Find matching policy to get documentId
                        matching_policy = next(
                            (p for p in request.policies if p.id == rp.get("policyId")),
                            None
                        )
                        if matching_policy:
                            citations = rp.get("citations", [])
                            if not isinstance(citations, list):
                                citations = []
                            related_policies.append({
                                "policyId": rp["policyId"],
                                "title": rp.get("title", matching_policy.title),
                                "documentId": matching_policy.documentId,
                                "citations": citations[:5],  # Limit citations
                            })

            recommendations = result.get("recommendations", [])
            if not isinstance(recommendations, list):
                recommendations = []
            recommendations = recommendations[:5]  # Limit to 5

            # Generate trace
            trace = generate_trace_steps(
                practice_title=practice.title,
                policies_count=len(request.policies),
                has_policy=has_policy,
                status=status
            )

            # Generate reason
            reason = generate_reason(
                practice=practice,
                setting=request.setting,
                department=request.department,
                status=status,
                has_policy=has_policy,
                risk_model=risk_model
            )

            # Generate evidence
            policies_reviewed = [
                {"id": p.id, "title": p.title} for p in request.policies[:20]
            ]
            
            accreditation_refs = get_applicable_accreditation_references(
                setting=request.setting,
                department=request.department,
                status=status
            )

            evidence = Evidence(
                policiesReviewed=policies_reviewed,
                riskModel=RiskModel(**risk_model),
                accreditationReferences=accreditation_refs
            )

            results.append(PracticeResult(
                practiceId=practice.id,
                status=status,
                relatedPolicies=related_policies,
                severity=severity,
                likelihood=likelihood,
                riskScore=final_risk_score,
                recommendations=recommendations,
                trace=trace,
                reason=reason,
                evidence=evidence.dict()
            ))

        from datetime import datetime
        metadata = {
            "totalPractices": len(request.practices),
            "policiesAnalyzed": len(request.policies),
            "model": model,
            "analyzedAt": datetime.utcnow().isoformat() + "Z",
        }

        return AnalyzeResponse(
            practices=results,
            metadata=metadata
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in analyze_gaps: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze gaps: {str(e)}"
        )


class DraftPolicyRequest(BaseModel):
    practice: Dict[str, Any]
    findings: Dict[str, Any]
    department: str
    setting: str
    tenantId: str = "default"


class PolicySection(BaseModel):
    title: str
    content: str


class DraftPolicyResponse(BaseModel):
    draft: Dict[str, Any]  # {sections: [PolicySection]}


@router.post("/v1/policies/draft", response_model=DraftPolicyResponse)
async def draft_policy(request: DraftPolicyRequest):
    """
    Generate a draft policy based on practice and findings.
    
    Creates policy sections for a practice that has no policy coverage.
    """
    try:
        client = get_openai_client()
        if not client:
            raise HTTPException(
                status_code=503,
                detail="OpenAI client not available. Check OPENAI_API_KEY."
            )

        practice = request.practice
        findings = request.findings

        prompt = f"""Generate a comprehensive healthcare policy draft for the following practice.

**Department**: {request.department}
**Setting**: {request.setting}
**Practice**:
- Title: {practice.get('title', 'Unknown')}
- Description: {practice.get('description', '')}
- Frequency: {practice.get('frequency', 'Unknown')}

**Findings from Gap Analysis**:
- Status: {findings.get('status', 'NoPolicy')}
- Recommendations: {', '.join(findings.get('recommendations', []))}
- Risk Score: {findings.get('riskScore', 'N/A')}

Create a structured policy document with the following sections:
1. **Purpose**: Why this policy exists
2. **Scope**: Who and what this policy applies to
3. **Definitions**: Key terms used in the policy
4. **Policy Statement**: Main policy content and requirements
5. **Procedures**: Step-by-step procedures for implementation
6. **Responsibilities**: Who is responsible for what
7. **Compliance and Monitoring**: How compliance is monitored
8. **References**: Related policies or standards (if applicable)

Return JSON in this format:
{{
  "sections": [
    {{
      "title": "Purpose",
      "content": "Full text content for this section..."
    }},
    {{
      "title": "Scope",
      "content": "Full text content..."
    }}
  ]
}}

Make the policy comprehensive, clear, and aligned with healthcare best practices. Each section should be detailed and actionable.
"""

        model = "gpt-4o-mini"
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a healthcare policy writer. Generate comprehensive, clear, and actionable policy documents."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            response_format={"type": "json_object"},
        )

        result_text = response.choices[0].message.content
        if not result_text:
            raise HTTPException(
                status_code=500,
                detail="Empty response from AI"
            )

        try:
            result = json.loads(result_text)
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Invalid JSON response from AI: {str(e)}"
            )

        # Validate and structure sections
        sections = result.get("sections", [])
        if not isinstance(sections, list):
            sections = []

        # Ensure sections are properly formatted
        formatted_sections = []
        for section in sections:
            if isinstance(section, dict) and "title" in section and "content" in section:
                formatted_sections.append({
                    "title": str(section["title"]),
                    "content": str(section["content"]),
                })

        return DraftPolicyResponse(
            draft={
                "sections": formatted_sections,
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in draft_policy: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate draft policy: {str(e)}"
        )
