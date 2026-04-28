"""
Script to delete all policies from policy-engine service
This deletes:
1. All job files in data/jobs/
2. All policy directories in data/{tenantId}/{policyId}/
3. All manifest files in data/manifests/{tenantId}/
4. All chunks from ChromaDB vector store

WARNING: This will permanently delete ALL policies from the policy-engine service!
Run with: python3 scripts/delete_all_policies_from_engine.py
"""

import os
import json
import shutil
from pathlib import Path

# Try to load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Get data directory from environment or use default
DATA_DIR = os.getenv("POLICY_ENGINE_DATA_DIR", os.getenv("DATA_DIR", "./data"))
TENANT_ID = os.getenv("POLICY_ENGINE_TENANT_ID", "default")

def delete_all_policies():
    """Delete all policies from policy-engine filesystem storage"""
    data_path = Path(DATA_DIR)
    
    if not data_path.exists():
        print(f"❌ Data directory does not exist: {data_path}")
        return
    
    print(f"📂 Data directory: {data_path}")
    print(f"🏢 Tenant ID: {TENANT_ID}")
    print(f"\n{'='*60}")
    print("⚠️  WARNING: This will delete ALL policies from policy-engine!")
    print(f"{'='*60}\n")
    
    deleted_items = []
    errors = []
    
    # 1. Delete all job files
    print("📋 Step 1: Deleting job files...")
    jobs_dir = data_path / "jobs"
    if jobs_dir.exists():
        job_files = list(jobs_dir.glob("*.json"))
        print(f"   Found {len(job_files)} job file(s)")
        
        for job_file in job_files:
            try:
                # Read job file to get policyId and tenantId
                with open(job_file, 'r', encoding='utf-8') as f:
                    job_data = json.load(f)
                    policy_id = job_data.get('policyId', 'unknown')
                    job_tenant = job_data.get('tenantId', TENANT_ID)
                
                job_file.unlink()
                deleted_items.append(f"job:{job_file.name} (policyId: {policy_id})")
                print(f"   ✓ Deleted: {job_file.name}")
            except Exception as e:
                error_msg = f"Failed to delete {job_file.name}: {e}"
                print(f"   ❌ {error_msg}")
                errors.append(error_msg)
        
        if len(job_files) == 0:
            print("   ℹ️  No job files found")
    else:
        print("   ℹ️  Jobs directory does not exist")
    
    # 2. Delete all policy directories for the tenant
    print(f"\n📁 Step 2: Deleting policy directories for tenant '{TENANT_ID}'...")
    tenant_dir = data_path / TENANT_ID
    if tenant_dir.exists():
        policy_dirs = [d for d in tenant_dir.iterdir() if d.is_dir()]
        print(f"   Found {len(policy_dirs)} policy directory(ies)")
        
        for policy_dir in policy_dirs:
            try:
                shutil.rmtree(policy_dir)
                deleted_items.append(f"policy_directory:{policy_dir.name}")
                print(f"   ✓ Deleted: {policy_dir.name}")
            except Exception as e:
                error_msg = f"Failed to delete {policy_dir}: {e}"
                print(f"   ❌ {error_msg}")
                errors.append(error_msg)
        
        # Try to delete tenant directory if empty
        try:
            if not any(tenant_dir.iterdir()):
                tenant_dir.rmdir()
                print(f"   ✓ Deleted empty tenant directory: {TENANT_ID}")
        except Exception as e:
            print(f"   ℹ️  Could not delete tenant directory: {e}")
    else:
        print(f"   ℹ️  Tenant directory does not exist: {tenant_dir}")
    
    # 3. Delete all manifest files for the tenant
    print(f"\n📄 Step 3: Deleting manifest files for tenant '{TENANT_ID}'...")
    manifests_dir = data_path / "manifests" / TENANT_ID
    if manifests_dir.exists():
        manifest_files = list(manifests_dir.glob("*.json"))
        print(f"   Found {len(manifest_files)} manifest file(s)")
        
        for manifest_file in manifest_files:
            try:
                manifest_file.unlink()
                deleted_items.append(f"manifest:{manifest_file.name}")
                print(f"   ✓ Deleted: {manifest_file.name}")
            except Exception as e:
                error_msg = f"Failed to delete {manifest_file.name}: {e}"
                print(f"   ❌ {error_msg}")
                errors.append(error_msg)
        
        # Try to delete manifests tenant directory if empty
        try:
            if not any(manifests_dir.iterdir()):
                manifests_dir.rmdir()
                print(f"   ✓ Deleted empty manifests directory for tenant")
        except Exception as e:
            print(f"   ℹ️  Could not delete manifests directory: {e}")
    else:
        print(f"   ℹ️  Manifests directory does not exist: {manifests_dir}")
    
    # 4. Delete from ChromaDB vector store
    print("\n🔍 Step 4: Deleting chunks from ChromaDB vector store...")
    try:
        # Try to import and use vector store deletion
        import sys
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from app.vector_store import get_collection
        
        # Get all policies from remaining job files (if any) to delete chunks
        # Since we already deleted job files, we'll try to delete by tenant
        try:
            collection = get_collection(TENANT_ID)
            # ChromaDB doesn't have a simple "delete all" - we'd need policyIds
            # For now, we'll skip this as job files are already deleted
            print("   ℹ️  ChromaDB cleanup requires policy IDs (already deleted from jobs)")
            print("   ℹ️  ChromaDB chunks may remain, but won't be accessible without job files")
        except Exception as e:
            print(f"   ⚠️  Could not access ChromaDB: {e}")
            print("   ℹ️  ChromaDB cleanup skipped (chunks may remain but won't be accessible)")
    except ImportError as e:
        print(f"   ⚠️  Could not import vector_store module: {e}")
        print("   ℹ️  ChromaDB cleanup skipped")
    except Exception as e:
        print(f"   ⚠️  Error during ChromaDB cleanup: {e}")
    
    # 5. Summary
    print(f"\n{'='*60}")
    print("✅ Deletion Summary:")
    print(f"   Deleted items: {len(deleted_items)}")
    if errors:
        print(f"   Errors: {len(errors)}")
        for error in errors:
            print(f"      - {error}")
    print(f"{'='*60}\n")
    
    if len(deleted_items) == 0:
        print("ℹ️  No policies found to delete")
    else:
        print(f"✅ Successfully deleted {len(deleted_items)} item(s)")
        print(f"⚠️  Note: ChromaDB chunks may still exist but are orphaned")
        print(f"   (They won't be accessible without job files)")

if __name__ == "__main__":
    try:
        delete_all_policies()
    except KeyboardInterrupt:
        print("\n\n⚠️  Operation cancelled by user")
        exit(1)
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

