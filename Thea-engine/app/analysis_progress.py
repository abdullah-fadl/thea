"""Analysis progress tracking"""
import json
import uuid
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime
from app.config import settings


# In-memory storage for analysis progress (can be moved to Redis in production)
_analysis_progress: Dict[str, Dict[str, Any]] = {}


def create_analysis(tenant_id: str, analysis_type: str) -> str:
    """Create a new analysis and return analysis_id"""
    analysis_id = str(uuid.uuid4())
    
    _analysis_progress[analysis_id] = {
        "analysisId": analysis_id,
        "tenantId": tenant_id,
        "type": analysis_type,
        "status": "running",
        "progress": {
            "total": 0,
            "completed": 0,
            "currentStep": "Initializing...",
            "percentage": 0,
        },
        "startedAt": datetime.utcnow().isoformat(),
        "updatedAt": datetime.utcnow().isoformat(),
    }
    
    return analysis_id


def update_analysis_progress(
    analysis_id: str,
    total: Optional[int] = None,
    completed: Optional[int] = None,
    current_step: Optional[str] = None,
    percentage: Optional[float] = None,
    status: Optional[str] = None,
):
    """Update analysis progress"""
    if analysis_id not in _analysis_progress:
        return
    
    progress = _analysis_progress[analysis_id]["progress"]
    
    if total is not None:
        progress["total"] = total
    if completed is not None:
        progress["completed"] = completed
    if current_step is not None:
        progress["currentStep"] = current_step
    if percentage is not None:
        progress["percentage"] = percentage
    elif total and completed:
        progress["percentage"] = min(100, int((completed / total) * 100))
    
    if status:
        _analysis_progress[analysis_id]["status"] = status
    
    _analysis_progress[analysis_id]["updatedAt"] = datetime.utcnow().isoformat()


def get_analysis_progress(analysis_id: str) -> Optional[Dict[str, Any]]:
    """Get analysis progress"""
    return _analysis_progress.get(analysis_id)


def complete_analysis(analysis_id: str, results: Optional[Dict[str, Any]] = None):
    """Mark analysis as completed and store results"""
    if analysis_id in _analysis_progress:
        _analysis_progress[analysis_id]["status"] = "completed"
        _analysis_progress[analysis_id]["progress"]["percentage"] = 100
        _analysis_progress[analysis_id]["updatedAt"] = datetime.utcnow().isoformat()
        _analysis_progress[analysis_id]["completedAt"] = datetime.utcnow().isoformat()
        if results:
            _analysis_progress[analysis_id]["results"] = results


def fail_analysis(analysis_id: str, error: str):
    """Mark analysis as failed"""
    if analysis_id in _analysis_progress:
        _analysis_progress[analysis_id]["status"] = "failed"
        _analysis_progress[analysis_id]["error"] = error
        _analysis_progress[analysis_id]["updatedAt"] = datetime.utcnow().isoformat()


def cleanup_old_analyses(max_age_hours: int = 24):
    """Remove old analysis progress (older than max_age_hours)"""
    now = datetime.utcnow()
    to_remove = []
    
    for analysis_id, analysis in _analysis_progress.items():
        updated_at = datetime.fromisoformat(analysis["updatedAt"])
        age_hours = (now - updated_at).total_seconds() / 3600
        if age_hours > max_age_hours:
            to_remove.append(analysis_id)
    
    for analysis_id in to_remove:
        del _analysis_progress[analysis_id]
