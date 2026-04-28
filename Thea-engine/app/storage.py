"""File storage utilities"""
import json
import hashlib
from pathlib import Path
from typing import Dict, Optional
import shutil


def get_file_hash(file_content: bytes) -> str:
    """Calculate SHA256 hash of file content"""
    return hashlib.sha256(file_content).hexdigest()


def save_uploaded_file(
    tenant_id: str,
    policy_id: str,
    filename: str,
    file_content: bytes,
    data_dir: Path
) -> Path:
    """
    Save uploaded file to storage
    
    Args:
        tenant_id: Tenant identifier
        policy_id: Policy identifier
        filename: Original filename
        file_content: File content bytes
        data_dir: Base data directory
    
    Returns:
        Path to saved file
    """
    tenant_dir = data_dir / tenant_id
    tenant_dir.mkdir(parents=True, exist_ok=True)
    
    policy_dir = tenant_dir / policy_id
    policy_dir.mkdir(parents=True, exist_ok=True)
    
    # Save original file
    file_path = policy_dir / filename
    file_path.write_bytes(file_content)
    
    # Update manifest
    update_manifest(tenant_id, policy_id, filename, data_dir)
    
    return file_path


def update_manifest(tenant_id: str, policy_id: str, filename: str, data_dir: Path):
    """Update manifest.json with policy information"""
    tenant_dir = data_dir / tenant_id
    manifest_path = tenant_dir / "manifest.json"
    
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
    else:
        manifest = {}
    
    manifest[policy_id] = {
        "filename": filename,
        "indexedAt": None,  # Will be updated when indexing completes
    }
    
    manifest_path.write_text(json.dumps(manifest, indent=2))


def load_manifest(manifest_path: str) -> Dict:
    """Load manifest.json"""
    path = Path(manifest_path)
    if not path.exists():
        return {}
    
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        # If manifest is corrupted, return empty dict and log warning
        print(f"Warning: Failed to parse manifest.json at {manifest_path}: {e}")
        return {}


def list_policies(tenant_id: str, data_dir: Path) -> list:
    """List all policies for a tenant"""
    tenant_dir = data_dir / tenant_id
    manifest_path = tenant_dir / "manifest.json"
    
    if not manifest_path.exists():
        return []
    
    manifest = load_manifest(str(manifest_path))
    return list(manifest.keys())


def delete_policy_files(tenant_id: str, policy_id: str, data_dir: Path):
    """
    Delete all files and data associated with a policy
    
    Args:
        tenant_id: Tenant identifier
        policy_id: Policy identifier
        data_dir: Base data directory
    """
    tenant_dir = data_dir / tenant_id
    policy_dir = tenant_dir / policy_id
    
    # Delete policy directory (contains original file, text, etc.)
    if policy_dir.exists() and policy_dir.is_dir():
        try:
            shutil.rmtree(policy_dir)
            print(f"Deleted policy directory: {policy_dir}")
        except Exception as e:
            print(f"Warning: Failed to delete policy directory {policy_dir}: {e}")
            raise  # Re-raise to let caller handle
    
    # Remove from manifest
    manifest_path = tenant_dir / "manifest.json"
    if manifest_path.exists():
        try:
            manifest = load_manifest(str(manifest_path))
            if policy_id in manifest:
                del manifest[policy_id]
                manifest_path.write_text(json.dumps(manifest, indent=2))
                print(f"Removed {policy_id} from manifest.json")
            else:
                print(f"Warning: {policy_id} not found in manifest.json")
        except Exception as e:
            # If manifest is corrupted, just log and continue (deletion of files is more important)
            print(f"Warning: Failed to update manifest.json (may be corrupted): {e}")
    else:
        print(f"Warning: manifest.json not found at {manifest_path}")
