#!/usr/bin/env python3
"""
Delete all policies and return their paths
This script will:
1. List all policies
2. Delete all files (jobs, vector store, manifests, policy directories)
3. Return a report of what was deleted and where files were stored
"""

import sys
import json
import shutil
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import settings
from app.vector_store import delete_policy_chunks

def delete_all_policies(tenant_id: str = "default"):
    """Delete all policies for a tenant and return paths report"""
    
    data_dir = Path(settings.data_dir)
    jobs_dir = data_dir / "jobs"
    manifests_dir = data_dir / "manifests" / tenant_id
    tenant_dir = data_dir / tenant_id
    chroma_dir = data_dir / "chroma"
    
    report = {
        "data_directory": str(data_dir.absolute()),
        "tenant_id": tenant_id,
        "deleted_policies": [],
        "deleted_files": {
            "job_files": [],
            "policy_directories": [],
            "manifest_files": [],
            "global_manifest_entries": [],
        },
        "errors": [],
    }
    
    print(f"\n{'='*70}")
    print(f"🗑️  DELETING ALL POLICIES")
    print(f"   Data Directory: {data_dir.absolute()}")
    print(f"   Tenant ID: {tenant_id}")
    print(f"{'='*70}\n")
    
    # ============================================================
    # 1. GET ALL POLICIES (from jobs directory - source of truth)
    # ============================================================
    print("📋 Step 1: Listing all policies from job files...")
    
    all_jobs = []
    policy_ids = set()
    
    if jobs_dir.exists():
        for job_file in jobs_dir.glob("*.json"):
            try:
                with open(job_file, "r") as f:
                    job = json.load(f)
                    if tenant_id is None or job.get("tenantId") == tenant_id:
                        all_jobs.append(job)
                        policy_id = job.get('policyId')
                        if policy_id:
                            policy_ids.add(policy_id)
            except Exception as e:
                print(f"   ⚠ Failed to read {job_file.name}: {e}")
                continue
    
    print(f"   Found {len(policy_ids)} unique policy ID(s)")
    print(f"   Found {len(all_jobs)} job file(s)\n")
    
    if len(policy_ids) == 0:
        print("   ✅ No policies to delete\n")
        return report
    
    # ============================================================
    # 2. DELETE JOB FILES
    # ============================================================
    print("📋 Step 2: Deleting job files...")
    deleted_job_files = []
    
    if jobs_dir.exists():
        for job_file in jobs_dir.glob("*.json"):
            try:
                with open(job_file, "r") as f:
                    job = json.load(f)
                    job_tenant = job.get("tenantId")
                    if tenant_id is None or job_tenant == tenant_id:
                        job_id = job.get('jobId')
                        policy_id = job.get('policyId')
                        filename = job.get('filename', 'unknown')
                        
                        job_file_path = str(job_file.absolute())
                        job_file.unlink()
                        deleted_job_files.append({
                            "path": job_file_path,
                            "jobId": job_id,
                            "policyId": policy_id,
                            "filename": filename,
                        })
                        print(f"   ✓ Deleted: {job_file.name}")
            except Exception as e:
                print(f"   ⚠ Failed to process {job_file.name}: {e}")
                continue
    
    report["deleted_files"]["job_files"] = deleted_job_files
    print(f"   ✅ Deleted {len(deleted_job_files)} job file(s)\n")
    
    # ============================================================
    # 3. DELETE VECTOR STORE CHUNKS (ChromaDB)
    # ============================================================
    print("🔍 Step 3: Deleting chunks from vector store...")
    
    for policy_id in policy_ids:
        try:
            delete_policy_chunks(tenant_id, policy_id)
            print(f"   ✓ Deleted chunks for policy: {policy_id[:8]}...")
        except Exception as e:
            error_msg = f"Failed to delete chunks for {policy_id}: {e}"
            print(f"   ⚠ {error_msg}")
            report["errors"].append(error_msg)
    
    print()
    
    # ============================================================
    # 4. DELETE POLICY DIRECTORIES AND FILES
    # ============================================================
    print("📁 Step 4: Deleting policy directories and files...")
    deleted_policy_dirs = []
    
    for policy_id in policy_ids:
        policy_dir = tenant_dir / policy_id
        
        if policy_dir.exists() and policy_dir.is_dir():
            # List all files before deletion for report
            files_in_dir = []
            for file_path in policy_dir.rglob("*"):
                if file_path.is_file():
                    files_in_dir.append(str(file_path.absolute()))
            
            try:
                shutil.rmtree(policy_dir)
                deleted_policy_dirs.append({
                    "path": str(policy_dir.absolute()),
                    "policyId": policy_id,
                    "files": files_in_dir,
                })
                print(f"   ✓ Deleted directory: {policy_dir.name} ({len(files_in_dir)} files)")
            except Exception as e:
                error_msg = f"Failed to delete {policy_dir}: {e}"
                print(f"   ❌ {error_msg}")
                report["errors"].append(error_msg)
    
    report["deleted_files"]["policy_directories"] = deleted_policy_dirs
    print(f"   ✅ Deleted {len(deleted_policy_dirs)} policy directory/directories\n")
    
    # ============================================================
    # 5. DELETE MANIFEST FILES
    # ============================================================
    print("📄 Step 5: Deleting manifest files...")
    deleted_manifest_files = []
    
    # Delete per-policy manifest files
    if manifests_dir.exists():
        for manifest_file in manifests_dir.glob("*.json"):
            policy_id_from_file = manifest_file.stem
            if policy_id_from_file in policy_ids:
                try:
                    manifest_path = str(manifest_file.absolute())
                    manifest_file.unlink()
                    deleted_manifest_files.append({
                        "path": manifest_path,
                        "policyId": policy_id_from_file,
                    })
                    print(f"   ✓ Deleted manifest: {manifest_file.name}")
                except Exception as e:
                    error_msg = f"Failed to delete {manifest_file}: {e}"
                    print(f"   ❌ {error_msg}")
                    report["errors"].append(error_msg)
    
    report["deleted_files"]["manifest_files"] = deleted_manifest_files
    print(f"   ✅ Deleted {len(deleted_manifest_files)} manifest file(s)\n")
    
    # ============================================================
    # 6. UPDATE GLOBAL MANIFEST (remove entries)
    # ============================================================
    print("📄 Step 6: Updating global manifest...")
    global_manifest_path = tenant_dir / "manifest.json"
    
    if global_manifest_path.exists():
        try:
            with open(global_manifest_path, "r") as f:
                manifest = json.load(f)
            removed_entries = []
            
            for policy_id in policy_ids:
                if policy_id in manifest:
                    removed_entries.append({
                        "policyId": policy_id,
                        "filename": manifest[policy_id].get("filename", "unknown"),
                    })
                    del manifest[policy_id]
            
            if removed_entries:
                global_manifest_path.write_text(json.dumps(manifest, indent=2))
                report["deleted_files"]["global_manifest_entries"] = removed_entries
                print(f"   ✅ Removed {len(removed_entries)} entry/entries from global manifest")
            else:
                print(f"   ℹ️  No entries to remove from global manifest")
        except Exception as e:
            error_msg = f"Failed to update global manifest: {e}"
            print(f"   ⚠ {error_msg}")
            report["errors"].append(error_msg)
    else:
        print(f"   ℹ️  Global manifest not found")
    
    print()
    
    # ============================================================
    # 7. BUILD POLICY REPORT
    # ============================================================
    for job in all_jobs:
        policy_id = job.get('policyId')
        if policy_id and policy_id not in [p["policyId"] for p in report["deleted_policies"]]:
            report["deleted_policies"].append({
                "policyId": policy_id,
                "filename": job.get('filename', 'unknown'),
                "status": job.get('status', 'unknown'),
            })
    
    # ============================================================
    # FINAL REPORT
    # ============================================================
    print(f"{'='*70}")
    print(f"✅ DELETION COMPLETE")
    print(f"{'='*70}")
    print(f"\n📊 Summary:")
    print(f"   Policies deleted: {len(report['deleted_policies'])}")
    print(f"   Job files deleted: {len(deleted_job_files)}")
    print(f"   Policy directories deleted: {len(deleted_policy_dirs)}")
    print(f"   Manifest files deleted: {len(deleted_manifest_files)}")
    print(f"   Errors: {len(report['errors'])}")
    print(f"\n{'='*70}\n")
    
    return report


if __name__ == "__main__":
    import os
    
    tenant_id = os.getenv("POLICY_ENGINE_TENANT_ID", "default")
    
    # Confirm deletion
    print("\n⚠️  WARNING: This will delete ALL policies!")
    response = input("Are you sure you want to continue? (yes/no): ")
    
    if response.lower() != "yes":
        print("❌ Deletion cancelled")
        sys.exit(0)
    
    report = delete_all_policies(tenant_id)
    
    # Save report to file
    report_file = Path(__file__).parent.parent / "deletion_report.json"
    with open(report_file, "w") as f:
        json.dump(report, f, indent=2)
    
    print(f"📄 Detailed report saved to: {report_file.absolute()}\n")
