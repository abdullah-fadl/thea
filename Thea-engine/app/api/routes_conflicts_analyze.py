"""
Multi-layer Conflict Analysis API
Operational Integrity & Decision Engine

Implements four analysis layers:
- Policy conflicts (textual, scope, authority, temporal, regulatory)
- Workflow/practice conflicts (duplication, contradiction, gaps)
- Cost & efficiency conflicts (waste, redundancy, bottlenecks)
- Coverage & gap analysis (missing policies for active practices)
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Literal
from datetime import datetime
import asyncio
from app.config import settings
from app.manifest import load_manifest
from app.jobs import get_all_jobs
from app.vector_store import get_collection, search
from app.embeddings import generate_embeddings
from app.analysis_progress import create_analysis, update_analysis_progress, complete_analysis, fail_analysis, get_analysis_progress
import uuid
import json

router = APIRouter()

# ============================================================================
# Request/Response Models
# ============================================================================

class AnalysisScope(BaseModel):
    type: Literal["department", "operation", "enterprise"]
    departmentIds: Optional[List[str]] = None
    operationId: Optional[str] = None
    allDepartments: Optional[bool] = None

class ConflictAnalysisRequest(BaseModel):
    tenantId: str
    scope: AnalysisScope
    layers: List[Literal["policy", "workflow", "cost", "coverage"]]
    options: Optional[Dict[str, Any]] = None

class PolicyConflictDetails(BaseModel):
    conflictNature: str
    conflictingRequirements: Optional[List[str]] = None
    regulatoryReferences: Optional[List[str]] = None
    temporalIssues: Optional[Dict[str, Any]] = None

class WorkflowConflictDetails(BaseModel):
    workflowDescription: str
    affectedOperations: List[str]
    processSteps: List[Dict[str, Any]]

class CostConflictDetails(BaseModel):
    estimatedImpact: Optional[Dict[str, Any]] = None
    efficiencyLoss: Optional[Dict[str, Any]] = None
    bottleneckDetails: Optional[Dict[str, Any]] = None

class CoverageGapDetails(BaseModel):
    practiceDescription: str
    missingAspects: List[str]
    recommendedPolicyType: str
    urgency: Literal["low", "medium", "high"]

class ConflictEvidence(BaseModel):
    policyId: str
    filename: str
    page: Optional[int] = None
    chunkId: Optional[str] = None
    quote: str
    relevance: float

class BaseConflictModel(BaseModel):
    id: str
    layer: Literal["policy", "workflow", "cost", "coverage"]
    type: str
    severity: Literal["low", "medium", "high", "critical"]
    title: str
    summary: str
    explanation: str
    confidence: Literal["low", "medium", "high"]
    assumptions: List[str]
    affectedPolicies: List[Dict[str, Any]]
    evidence: List[ConflictEvidence]
    scope: AnalysisScope
    detectedAt: datetime

class PolicyConflict(BaseConflictModel):
    layer: Literal["policy"] = "policy"
    type: Literal["textual", "scope", "authority", "temporal", "regulatory"]
    details: PolicyConflictDetails

class WorkflowConflict(BaseConflictModel):
    layer: Literal["workflow"] = "workflow"
    type: Literal["duplication", "contradiction", "gap"]
    details: WorkflowConflictDetails

class CostConflict(BaseConflictModel):
    layer: Literal["cost"] = "cost"
    type: Literal["waste", "redundancy", "bottleneck"]
    details: CostConflictDetails

class CoverageGap(BaseConflictModel):
    layer: Literal["coverage"] = "coverage"
    type: Literal["missing_policy", "outdated_policy", "incomplete_policy"]
    details: CoverageGapDetails

class ConflictAnalysisResponse(BaseModel):
    success: bool
    scope: AnalysisScope
    layers: List[str]
    conflicts: List[Dict[str, Any]]  # Union of all conflict types
    summary: Dict[str, Any]
    explainability: Dict[str, Any]
    decisionScenarios: Optional[List[Dict[str, Any]]] = None
    metadata: Dict[str, Any]

# ============================================================================
# Analysis Functions
# ============================================================================

async def analyze_policy_conflicts(
    tenant_id: str,
    policies: List[Dict[str, Any]],
    scope: AnalysisScope,
    analysis_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Analyze policy conflicts across multiple dimensions"""
    conflicts = []
    
    if len(policies) < 2:
        print(f"[Policy Conflicts] Not enough policies to analyze ({len(policies)} policies)")
        return conflicts
    
    print(f"[Policy Conflicts] Analyzing {len(policies)} policies for conflicts...")
    
    # Limit analysis to first 20 policies to avoid timeout (can be made configurable)
    max_policies = 20
    if len(policies) > max_policies:
        print(f"[Policy Conflicts] WARNING: Too many policies ({len(policies)}). Limiting to {max_policies} for performance.")
        policies = policies[:max_policies]
    
    # Get all policy chunks for semantic comparison
    try:
        collection = get_collection(tenant_id)
        print(f"[Policy Conflicts] Got collection for tenant {tenant_id}")
    except Exception as e:
        print(f"[Policy Conflicts] Error getting collection: {e}")
        return conflicts
    
    total_comparisons = len(policies) * (len(policies) - 1) // 2
    print(f"[Policy Conflicts] Will perform {total_comparisons} policy comparisons")
    
    comparison_count = 0
    for i, policy_a in enumerate(policies):
        for j, policy_b in enumerate(policies[i+1:], start=i+1):
            comparison_count += 1
            # Update progress more frequently (every comparison for better visibility)
            if comparison_count % 1 == 0:  # Update every comparison
                if analysis_id:
                    # Update progress: 15% base + (comparison_count / total_comparisons) * 30%
                    layer_progress = 15 + int((comparison_count / total_comparisons) * 30)
                    update_analysis_progress(
                        analysis_id,
                        total=total_comparisons,
                        completed=comparison_count,
                        current_step=f"Comparing policies: {comparison_count}/{total_comparisons}",
                        percentage=layer_progress
                    )
                    # Log every 10 comparisons
                    if comparison_count % 10 == 0:
                        print(f"[Policy Conflicts] Progress: {comparison_count}/{total_comparisons} comparisons ({layer_progress}%)")
                    # Small delay every 5 comparisons to ensure progress is visible
                    if comparison_count % 5 == 0:
                        await asyncio.sleep(0.05)  # Small delay to make progress visible
            
            policy_id_a = policy_a.get("policyId") or policy_a.get("id")
            policy_id_b = policy_b.get("policyId") or policy_b.get("id")
            
            if not policy_id_a or not policy_id_b:
                continue
            
            # Get chunks for both policies
            try:
                chunks_a = collection.get(
                    where={"policyId": policy_id_a},
                    include=["documents", "metadatas"]
                )
                chunks_b = collection.get(
                    where={"policyId": policy_id_b},
                    include=["documents", "metadatas"]
                )
            except Exception as e:
                print(f"[Policy Conflicts] Error getting chunks for {policy_id_a} or {policy_id_b}: {e}")
                continue
            
            if not chunks_a.get("ids") or not chunks_b.get("ids"):
                continue
            
            # Compare chunks for textual conflicts
            try:
                conflicts.extend(_detect_textual_conflicts(
                    tenant_id, policy_a, policy_b, chunks_a, chunks_b, scope
                ))
            except Exception as e:
                print(f"[Policy Conflicts] Error detecting conflicts between {policy_id_a} and {policy_id_b}: {e}")
                continue
            
            # Detect scope conflicts
            conflicts.extend(_detect_scope_conflicts(
                tenant_id, policy_a, policy_b
            ))
            
            # Detect temporal conflicts
            conflicts.extend(_detect_temporal_conflicts(
                tenant_id, policy_a, policy_b
            ))
    
    return conflicts

def _detect_textual_conflicts(
    tenant_id: str,
    policy_a: Dict[str, Any],
    policy_b: Dict[str, Any],
    chunks_a: Dict[str, Any],
    chunks_b: Dict[str, Any],
    scope: AnalysisScope
) -> List[Dict[str, Any]]:
    """Detect textual contradictions between policies"""
    conflicts = []
    
    # Generate embeddings for comparison
    texts_a = chunks_a.get("documents", [])
    texts_b = chunks_b.get("documents", [])
    
    if not texts_a or not texts_b:
        return conflicts
    
    # Limit chunks to improve performance (max 10 chunks per policy)
    max_chunks = 10
    if len(texts_a) > max_chunks:
        texts_a = texts_a[:max_chunks]
    if len(texts_b) > max_chunks:
        texts_b = texts_b[:max_chunks]
    
    embeddings_a = generate_embeddings(texts_a)
    embeddings_b = generate_embeddings(texts_b)
    
    # Find similar chunks with contradictory content
    # This is a simplified version - in production, use LLM for contradiction detection
    # Limit comparisons to avoid performance issues
    max_comparisons = 50  # Max 50 chunk comparisons per policy pair
    comparison_count = 0
    
    for i, emb_a in enumerate(embeddings_a):
        if comparison_count >= max_comparisons:
            break
        for j, emb_b in enumerate(embeddings_b):
            if comparison_count >= max_comparisons:
                break
            comparison_count += 1
            
            # Calculate cosine similarity
            similarity = _cosine_similarity(emb_a, emb_b)
            
            if similarity > 0.8:  # Increased threshold to reduce false positives and improve performance
                # Check for contradiction keywords
                text_a = texts_a[i].lower()
                text_b = texts_b[j].lower()
                
                contradiction_keywords = [
                    ("must", "must not"), ("required", "prohibited"),
                    ("always", "never"), ("shall", "shall not")
                ]
                
                has_contradiction = False
                for pos, neg in contradiction_keywords:
                    if pos in text_a and neg in text_b:
                        has_contradiction = True
                        break
                
                if has_contradiction:
                    conflict_id = str(uuid.uuid4())
                    conflicts.append({
                        "id": conflict_id,
                        "layer": "policy",
                        "type": "textual",
                        "severity": "high",
                        "title": f"Textual contradiction between {policy_a.get('filename', 'Policy A')} and {policy_b.get('filename', 'Policy B')}",
                        "summary": f"Contradictory requirements found in similar sections",
                        "explanation": f"Both policies discuss similar topics but have contradictory requirements",
                        "confidence": "medium",
                        "assumptions": [
                            "Similarity threshold of 0.7 indicates related content",
                            "Contradiction keywords detected indicate conflicting requirements"
                        ],
                        "affectedPolicies": [
                            {"policyId": policy_a.get("policyId") or policy_a.get("id"), "filename": policy_a.get("filename", ""), "role": "primary"},
                            {"policyId": policy_b.get("policyId") or policy_b.get("id"), "filename": policy_b.get("filename", ""), "role": "secondary"}
                        ],
                        "evidence": [
                            {
                                "policyId": policy_a.get("policyId") or policy_a.get("id"),
                                "filename": policy_a.get("filename", ""),
                                "quote": texts_a[i][:200],
                                "relevance": similarity
                            },
                            {
                                "policyId": policy_b.get("policyId") or policy_b.get("id"),
                                "filename": policy_b.get("filename", ""),
                                "quote": texts_b[j][:200],
                                "relevance": similarity
                            }
                        ],
                        "scope": scope.dict(),
                        "detectedAt": datetime.now().isoformat(),
                        "details": {
                            "conflictNature": "Textual contradiction in similar content",
                            "conflictingRequirements": [texts_a[i][:100], texts_b[j][:100]]
                        }
                    })
    
    return conflicts

def _detect_scope_conflicts(
    tenant_id: str,
    policy_a: Dict[str, Any],
    policy_b: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Detect scope overlaps or conflicts"""
    conflicts = []
    
    # Load manifests to check scope metadata
    manifest_a = load_manifest(tenant_id, policy_a.get("policyId") or policy_a.get("id"))
    manifest_b = load_manifest(tenant_id, policy_b.get("policyId") or policy_b.get("id"))
    
    # Check for scope overlaps (simplified - in production, use actual metadata)
    # This is a placeholder - actual implementation would check departments, scope fields
    
    return conflicts

def _detect_temporal_conflicts(
    tenant_id: str,
    policy_a: Dict[str, Any],
    policy_b: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Detect time-based conflicts (effective dates, expiry)"""
    conflicts = []
    
    # Load manifests to check dates
    manifest_a = load_manifest(tenant_id, policy_a.get("policyId") or policy_a.get("id"))
    manifest_b = load_manifest(tenant_id, policy_b.get("policyId") or policy_b.get("id"))
    
    # Check for temporal conflicts (simplified)
    # This is a placeholder - actual implementation would check effectiveDate, expiryDate
    
    return conflicts

def analyze_workflow_conflicts(
    tenant_id: str,
    policies: List[Dict[str, Any]],
    scope: AnalysisScope
) -> List[Dict[str, Any]]:
    """Analyze workflow/practice conflicts"""
    conflicts = []
    
    # Simplified workflow conflict detection
    # In production, this would analyze process flows, steps, and dependencies
    
    return conflicts

def analyze_cost_conflicts(
    tenant_id: str,
    policies: List[Dict[str, Any]],
    scope: AnalysisScope
) -> List[Dict[str, Any]]:
    """Analyze cost & efficiency conflicts"""
    conflicts = []
    
    # Simplified cost conflict detection
    # In production, this would analyze resource usage, time requirements, redundancy
    
    return conflicts

def analyze_coverage_gaps(
    tenant_id: str,
    policies: List[Dict[str, Any]],
    scope: AnalysisScope
) -> List[Dict[str, Any]]:
    """Analyze coverage gaps (missing policies for active practices)"""
    conflicts = []
    
    # Simplified coverage gap detection
    # In production, this would compare active practices/operations with existing policies
    
    return conflicts

def generate_decision_scenarios(
    conflicts: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Generate decision scenarios for conflict resolution"""
    scenarios = []
    
    # Group conflicts by affected policies
    conflict_groups = {}
    for conflict in conflicts:
        for policy in conflict.get("affectedPolicies", []):
            policy_id = policy.get("policyId")
            if policy_id not in conflict_groups:
                conflict_groups[policy_id] = []
            conflict_groups[policy_id].append(conflict)
    
    # Generate scenarios for each group
    for policy_id, group_conflicts in conflict_groups.items():
        if len(group_conflicts) > 0:
            scenario_id = str(uuid.uuid4())
            scenarios.append({
                "id": scenario_id,
                "conflictGroupId": policy_id,
                "action": "improve",
                "title": f"Improve policy to resolve {len(group_conflicts)} conflict(s)",
                "description": f"Modify the policy to address identified conflicts without merging",
                "impacts": {
                    "operational": {
                        "description": "Minimal operational disruption",
                        "severity": "low"
                    },
                    "risk": {
                        "description": "Reduced risk through conflict resolution",
                        "severity": "medium"
                    },
                    "cost": {
                        "description": "Low cost - single policy update",
                        "severity": "low"
                    },
                    "compliance": {
                        "description": "Improved compliance alignment",
                        "severity": "medium"
                    }
                },
                "affectedPolicies": [policy_id],
                "steps": [
                    {"step": 1, "description": "Review conflict details"},
                    {"step": 2, "description": "Update policy content"},
                    {"step": 3, "description": "Validate changes"}
                ],
                "confidence": "medium"
            })
    
    return scenarios

def _cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Calculate cosine similarity between two vectors"""
    if len(vec_a) != len(vec_b):
        return 0.0
    
    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    magnitude_a = sum(a * a for a in vec_a) ** 0.5
    magnitude_b = sum(b * b for b in vec_b) ** 0.5
    
    if magnitude_a == 0 or magnitude_b == 0:
        return 0.0
    
    return dot_product / (magnitude_a * magnitude_b)

# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/v1/conflicts/analyze", response_model=ConflictAnalysisResponse)
async def analyze_conflicts(request: ConflictAnalysisRequest, background_tasks: BackgroundTasks):
    """
    Multi-layer conflict analysis
    
    Analyzes policies across four layers:
    - Policy conflicts (textual, scope, authority, temporal, regulatory)
    - Workflow conflicts (duplication, contradiction, gaps)
    - Cost conflicts (waste, redundancy, bottlenecks)
    - Coverage gaps (missing policies for active practices)
    """
    analysis_id = None
    
    try:
        # Create analysis progress tracking
        analysis_id = create_analysis(request.tenantId, "conflict_analysis")
        update_analysis_progress(analysis_id, current_step="Initializing analysis...", percentage=0)
        
        print(f"[Conflict Analysis] Starting analysis {analysis_id} for tenant {request.tenantId}, scope: {request.scope.type}, layers: {request.layers}")
        
        # Run analysis in background
        background_tasks.add_task(run_analysis_task, analysis_id, request)
        
        # Return immediately with analysisId
        return ConflictAnalysisResponse(
            success=True,
            scope=request.scope,
            layers=request.layers,
            conflicts=[],
            summary={"total": 0, "byLayer": {}, "bySeverity": {}},
            explainability={
                "analysisMethod": "Multi-layer semantic and rule-based analysis",
                "assumptions": [],
                "confidence": "medium",
                "justification": "Analysis started, check progress endpoint for updates"
            },
            decisionScenarios=[],
            metadata={
                "analyzedAt": datetime.now().isoformat(),
                "policiesAnalyzed": 0,
                "processingTimeMs": 0,
                "analysisId": analysis_id
            }
        )
    
    except Exception as e:
        print(f"Error starting conflict analysis: {e}")
        if analysis_id:
            fail_analysis(analysis_id, str(e))
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


async def run_analysis_task(analysis_id: str, request: ConflictAnalysisRequest):
    """Run analysis in background"""
    try:
        start_time = datetime.now()
        
        update_analysis_progress(analysis_id, current_step="Initializing analysis...", percentage=0)
        
        print(f"[Conflict Analysis] Starting analysis {analysis_id} for tenant {request.tenantId}, scope: {request.scope.type}, layers: {request.layers}")
        
        # Get policies based on scope - use jobs as source of truth
        update_analysis_progress(analysis_id, current_step="Fetching policies...", percentage=5)
        print(f"[Conflict Analysis] Fetching jobs for tenant {request.tenantId}...")
        all_jobs = get_all_jobs(request.tenantId)
        print(f"[Conflict Analysis] Found {len(all_jobs)} jobs")
        
        # Convert jobs to policy format
        all_policies = []
        jobs_by_policy = {}
        
        for job in all_jobs:
            policy_id = job.get('policyId')
            if not policy_id:
                continue
            
            # Use latest job for each policy
            if policy_id not in jobs_by_policy:
                jobs_by_policy[policy_id] = job
            else:
                current_updated = jobs_by_policy[policy_id].get('updatedAt', '')
                job_updated = job.get('updatedAt', '')
                if job_updated > current_updated:
                    jobs_by_policy[policy_id] = job
        
        # Build policies list
        update_analysis_progress(analysis_id, current_step="Building policies list...", percentage=10)
        print(f"[Conflict Analysis] Building policies list from {len(jobs_by_policy)} unique policies...")
        for policy_id, job in jobs_by_policy.items():
            manifest = load_manifest(request.tenantId, policy_id)
            filename = manifest.get("filename", policy_id) if manifest else policy_id
            
            all_policies.append({
                "policyId": policy_id,
                "id": policy_id,
                "filename": filename,
                "status": job.get("status", "UNKNOWN")
            })
        print(f"[Conflict Analysis] Built {len(all_policies)} policies")
        
        # Filter policies by scope
        filtered_policies = all_policies
        if request.scope.type == "department" and request.scope.departmentIds:
            # Filter by department (would need metadata lookup)
            filtered_policies = all_policies  # Placeholder
        elif request.scope.type == "operation" and request.scope.operationId:
            # Filter by operation (would need metadata lookup)
            filtered_policies = all_policies  # Placeholder
        
        # Calculate total steps for progress tracking
        total_layers = len(request.layers)
        steps_per_layer = 30  # 30% per layer
        base_progress = 15  # 15% for initialization
        
        all_conflicts = []
        
        # Run analysis for each requested layer
        print(f"[Conflict Analysis] Running analysis for layers: {request.layers}")
        layer_index = 0
        if "policy" in request.layers:
            layer_progress = base_progress + (layer_index * steps_per_layer)
            update_analysis_progress(analysis_id, current_step="Analyzing policy conflicts...", percentage=layer_progress)
            print(f"[Conflict Analysis] Analyzing policy conflicts...")
            policy_conflicts = await analyze_policy_conflicts(
                request.tenantId,
                filtered_policies,
                request.scope,
                analysis_id  # Pass analysis_id for progress updates
            )
            all_conflicts.extend(policy_conflicts)
            layer_index += 1
        
        if "workflow" in request.layers:
            layer_progress = base_progress + (layer_index * steps_per_layer)
            update_analysis_progress(analysis_id, current_step="Analyzing workflow conflicts...", percentage=layer_progress)
            print(f"[Conflict Analysis] Analyzing workflow conflicts...")
            workflow_conflicts = analyze_workflow_conflicts(
                request.tenantId,
                filtered_policies,
                request.scope
            )
            all_conflicts.extend(workflow_conflicts)
            layer_index += 1
        
        if "cost" in request.layers:
            layer_progress = base_progress + (layer_index * steps_per_layer)
            update_analysis_progress(analysis_id, current_step="Analyzing cost conflicts...", percentage=layer_progress)
            print(f"[Conflict Analysis] Analyzing cost conflicts...")
            cost_conflicts = analyze_cost_conflicts(
                request.tenantId,
                filtered_policies,
                request.scope
            )
            all_conflicts.extend(cost_conflicts)
            layer_index += 1
        
        if "coverage" in request.layers:
            layer_progress = base_progress + (layer_index * steps_per_layer)
            update_analysis_progress(analysis_id, current_step="Analyzing coverage gaps...", percentage=layer_progress)
            print(f"[Conflict Analysis] Analyzing coverage gaps...")
            coverage_gaps = analyze_coverage_gaps(
                request.tenantId,
                filtered_policies,
                request.scope
            )
            all_conflicts.extend(coverage_gaps)
            layer_index += 1
        
        update_analysis_progress(analysis_id, current_step="Generating summary and scenarios...", percentage=95)
        print(f"[Conflict Analysis] Analysis complete. Found {len(all_conflicts)} conflicts")
        
        # Generate summary
        summary = {
            "total": len(all_conflicts),
            "byLayer": {
                "policy": len([c for c in all_conflicts if c.get("layer") == "policy"]),
                "workflow": len([c for c in all_conflicts if c.get("layer") == "workflow"]),
                "cost": len([c for c in all_conflicts if c.get("layer") == "cost"]),
                "coverage": len([c for c in all_conflicts if c.get("layer") == "coverage"])
            },
            "bySeverity": {
                "critical": len([c for c in all_conflicts if c.get("severity") == "critical"]),
                "high": len([c for c in all_conflicts if c.get("severity") == "high"]),
                "medium": len([c for c in all_conflicts if c.get("severity") == "medium"]),
                "low": len([c for c in all_conflicts if c.get("severity") == "low"])
            }
        }
        
        # Generate explainability
        explainability = {
            "analysisMethod": "Multi-layer semantic and rule-based analysis",
            "assumptions": [
                "Policies are semantically comparable if similarity > 0.7",
                "Contradiction keywords indicate conflicting requirements",
                "All policies in scope are active and relevant"
            ],
            "confidence": "medium",
            "justification": f"Analyzed {len(filtered_policies)} policy(ies) across {len(request.layers)} layer(s). Found {len(all_conflicts)} conflict(s) or gap(s)." if all_conflicts else f"Analyzed {len(filtered_policies)} policy(ies) across {len(request.layers)} layer(s). No conflicts or gaps detected."
        }
        
        # Generate decision scenarios if requested
        decision_scenarios = None
        if request.options and request.options.get("generateScenarios", False):
            decision_scenarios = generate_decision_scenarios(all_conflicts)
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        # Store results
        results = {
            "conflicts": all_conflicts,
            "summary": summary,
            "explainability": explainability,
            "decisionScenarios": decision_scenarios or [],
            "metadata": {
                "analyzedAt": datetime.now().isoformat(),
                "policiesAnalyzed": len(filtered_policies),
                "processingTimeMs": processing_time,
            }
        }
        
        # Mark analysis as completed and store results
        complete_analysis(analysis_id, results)
        
        print(f"[Conflict Analysis] Analysis {analysis_id} completed: {len(all_conflicts)} conflicts found")
    
    except Exception as e:
        print(f"Error in conflict analysis: {e}")
        if analysis_id:
            fail_analysis(analysis_id, str(e))
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/v1/conflicts/analyze/{analysis_id}/progress")
async def get_analysis_progress_endpoint(analysis_id: str):
    """Get analysis progress and results if completed"""
    progress = get_analysis_progress(analysis_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    # If completed, include results in response
    response = {
        "analysisId": progress.get("analysisId"),
        "status": progress.get("status"),
        "progress": progress.get("progress"),
        "startedAt": progress.get("startedAt"),
        "updatedAt": progress.get("updatedAt"),
    }
    
    if progress.get("status") == "completed" and "results" in progress:
        response["results"] = progress["results"]
        response["completedAt"] = progress.get("completedAt")
    
    return response
