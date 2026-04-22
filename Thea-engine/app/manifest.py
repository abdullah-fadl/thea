"""Manifest/checkpoint management"""
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
from app.config import settings


def load_manifest(tenant_id: str, policy_id: str) -> Dict[str, Any] | None:
    """Load manifest for a policy"""
    data_dir = Path(settings.data_dir)
    manifest_path = data_dir / "manifests" / tenant_id / f"{policy_id}.json"
    
    if not manifest_path.exists():
        return None
    
    try:
        with open(manifest_path, "r") as f:
            return json.load(f)
    except:
        return None


def save_manifest(tenant_id: str, policy_id: str, manifest: Dict[str, Any]):
    """Save manifest for a policy"""
    data_dir = Path(settings.data_dir)
    manifest_dir = data_dir / "manifests" / tenant_id
    manifest_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = manifest_dir / f"{policy_id}.json"
    
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)


def create_manifest(
    tenant_id: str,
    policy_id: str,
    filename: str,
    file_hash: str
) -> Dict[str, Any]:
    """Create new manifest"""
    return {
        "tenantId": tenant_id,
        "policyId": policy_id,
        "filename": filename,
        "fileHash": file_hash,
        "pages": [],
        "chunks": 0,
        "status": "INITIALIZING",
        "createdAt": datetime.utcnow().isoformat(),
        "lastUpdatedAt": datetime.utcnow().isoformat()
    }


def update_manifest_page(
    manifest: Dict[str, Any],
    page_number: int,
    status: str,
    text_path: str | None = None,
    ocr_used: bool = False,
    line_count: int = 0,
    error: str | None = None
):
    """Update manifest with page information"""
    # Find existing page or create new
    page_entry = None
    for page in manifest["pages"]:
        if page["pageNumber"] == page_number:
            page_entry = page
            break
    
    if page_entry is None:
        page_entry = {"pageNumber": page_number}
        manifest["pages"].append(page_entry)
    
    page_entry["status"] = status
    page_entry["updatedAt"] = datetime.utcnow().isoformat()
    
    if text_path:
        page_entry["textPath"] = text_path
    if ocr_used:
        page_entry["ocrUsed"] = True
    if line_count > 0:
        page_entry["lineCount"] = line_count
    if error:
        page_entry["error"] = error
    
    manifest["lastUpdatedAt"] = datetime.utcnow().isoformat()


def update_manifest_chunks(manifest: Dict[str, Any], chunks_count: int):
    """Update total chunks count in manifest"""
    manifest["chunks"] = chunks_count
    manifest["lastUpdatedAt"] = datetime.utcnow().isoformat()


def set_manifest_status(manifest: Dict[str, Any], status: str):
    """Set overall status of manifest"""
    manifest["status"] = status
    manifest["lastUpdatedAt"] = datetime.utcnow().isoformat()


def get_completed_pages(manifest: Dict[str, Any]) -> List[int]:
    """Get list of completed page numbers"""
    return [
        page["pageNumber"]
        for page in manifest.get("pages", [])
        if page.get("status") == "COMPLETED"
    ]


def should_skip_page(manifest: Dict[str, Any], page_number: int, current_hash: str) -> bool:
    """Check if page should be skipped (already processed with same hash)"""
    if manifest.get("fileHash") != current_hash:
        return False
    
    for page in manifest.get("pages", []):
        if page.get("pageNumber") == page_number and page.get("status") == "COMPLETED":
            return True
    
    return False
