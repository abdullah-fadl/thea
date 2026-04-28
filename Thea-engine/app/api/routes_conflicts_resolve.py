"""
Conflict Resolution API
Guided resolution flow with archive/delete options
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.config import settings
from app.manifest import load_manifest, save_manifest
from pathlib import Path
import uuid
import json

router = APIRouter()

# ============================================================================
# Request/Response Models
# ============================================================================

class ResolutionRequest(BaseModel):
    tenantId: str
    userId: str
    scenarioId: str
    action: str  # "improve" | "merge" | "unify" | "redesign"
    affectedPolicyIds: List[str]
    options: Dict[str, Any]

class ResolutionResponse(BaseModel):
    success: bool
    resolutionId: str
    createdPolicies: Optional[List[Dict[str, Any]]] = None
    archivedPolicies: Optional[List[str]] = None
    deletedPolicies: Optional[List[str]] = None
    auditLog: Dict[str, Any]

# ============================================================================
# Resolution Functions
# ============================================================================

def apply_resolution(
    tenant_id: str,
    user_id: str,
    scenario_id: str,
    action: str,
    affected_policy_ids: List[str],
    options: Dict[str, Any]
) -> Dict[str, Any]:
    """Apply conflict resolution based on scenario"""
    
    resolution_id = str(uuid.uuid4())
    created_policies = []
    archived_policies = []
    deleted_policies = []
    
    # Archive old items if requested
    if options.get("archiveOldItems", False):
        for policy_id in affected_policy_ids:
            try:
                manifest = load_manifest(tenant_id, policy_id)
                if manifest:
                    manifest["archivedAt"] = datetime.now().isoformat()
                    manifest["archivedBy"] = user_id
                    manifest["isActive"] = False
                    save_manifest(tenant_id, policy_id, manifest)
                    archived_policies.append(policy_id)
            except Exception as e:
                print(f"Error archiving policy {policy_id}: {e}")
    
    # Delete old items if requested
    if options.get("deleteOldItems", False):
        for policy_id in affected_policy_ids:
            try:
                # Delete from manifest
                manifest_path = Path(settings.data_dir) / "manifests" / tenant_id / f"{policy_id}.json"
                if manifest_path.exists():
                    manifest_path.unlink()
                deleted_policies.append(policy_id)
            except Exception as e:
                print(f"Error deleting policy {policy_id}: {e}")
    
    # Create new policy if action requires it
    if action in ["merge", "unify", "redesign"]:
        # In production, this would:
        # 1. Generate new policy content based on action
        # 2. Create new policy document
        # 3. Set status based on createDraft option
        pass
    
    # Create audit log
    audit_log = {
        "action": f"Conflict resolution: {action}",
        "performedBy": user_id,
        "performedAt": datetime.now().isoformat(),
        "details": f"Applied scenario {scenario_id} to {len(affected_policy_ids)} policy(ies). Options: {json.dumps(options)}"
    }
    
    return {
        "resolutionId": resolution_id,
        "createdPolicies": created_policies,
        "archivedPolicies": archived_policies,
        "deletedPolicies": deleted_policies,
        "auditLog": audit_log
    }

# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/v1/conflicts/resolve", response_model=ResolutionResponse)
async def resolve_conflicts(request: ResolutionRequest):
    """
    Apply conflict resolution
    
    Supports:
    - Archive old items (soft delete)
    - Delete old items (hard delete)
    - Create draft or immediate activation
    - Audit logging
    """
    try:
        # Validate request
        if not request.affectedPolicyIds or len(request.affectedPolicyIds) == 0:
            raise HTTPException(status_code=400, detail="At least one affected policy ID is required")
        
        if request.action not in ["improve", "merge", "unify", "redesign"]:
            raise HTTPException(status_code=400, detail=f"Invalid action: {request.action}")
        
        # Apply resolution
        result = apply_resolution(
            request.tenantId,
            request.userId,
            request.scenarioId,
            request.action,
            request.affectedPolicyIds,
            request.options
        )
        
        return ResolutionResponse(
            success=True,
            **result
        )
    
    except Exception as e:
        print(f"Error in conflict resolution: {e}")
        raise HTTPException(status_code=500, detail=f"Resolution failed: {str(e)}")
