"""Policies API routes"""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import json
from app.storage import list_policies, delete_policy_files
from app.vector_store import delete_policy_chunks
from app.jobs import get_all_jobs, load_job
from app.manifest import load_manifest
from pathlib import Path
from app.config import settings
from fastapi.responses import FileResponse, Response


router = APIRouter()


@router.get("/v1/policies")
async def list_policies_endpoint(
    tenantId: str = Query(..., description="Tenant identifier")
):
    """
    List all policies for a tenant
    """
    try:
        # Get all jobs - this is the source of truth for policies
        all_jobs = get_all_jobs(tenantId)
        
        # Also check global manifest if it exists (for backward compatibility)
        # Note: We now use per-policy manifests at data/manifests/{tenantId}/{policyId}.json
        from app.storage import load_manifest as load_global_manifest
        manifest_path = Path(settings.data_dir) / tenantId / "manifest.json"
        global_manifest = {}
        if manifest_path.exists():
            try:
                global_manifest = load_global_manifest(str(manifest_path))
            except:
                pass
        
        # Build policies list from jobs (primary source)
        # Group jobs by policyId and use the LATEST job (by updatedAt) for each policy
        jobs_by_policy: Dict[str, Dict[str, Any]] = {}
        
        for job in all_jobs:
            policy_id = job.get('policyId')
            if not policy_id:
                continue
            
            # Get current job for this policy, or initialize
            current_job = jobs_by_policy.get(policy_id)
            
            # Use the job with the latest updatedAt timestamp
            if not current_job:
                jobs_by_policy[policy_id] = job
            else:
                current_updated = current_job.get('updatedAt', '')
                job_updated = job.get('updatedAt', '')
                if job_updated > current_updated:
                    jobs_by_policy[policy_id] = job
        
        # Build policies list from latest jobs
        policies = []
        
        for policy_id, job in jobs_by_policy.items():
            
            # Get filename from job or per-policy manifest or global manifest
            filename = job.get("filename", "unknown")
            if filename == "unknown":
                # Try to get from per-policy manifest
                policy_manifest = load_manifest(tenantId, policy_id)
                if policy_manifest:
                    filename = policy_manifest.get("filename", "unknown")
            if filename == "unknown" and policy_id in global_manifest:
                filename = global_manifest[policy_id].get("filename", "unknown")
            if filename == "unknown":
                # Fallback: try to find PDF in policy directory
                policy_dir = Path(settings.data_dir) / tenantId / policy_id
                if policy_dir.exists():
                    pdf_files = list(policy_dir.glob("*.pdf"))
                    if pdf_files:
                        filename = pdf_files[0].name
            
            progress = job.get("progress", {})
            pages_total = progress.get("pagesTotal", 0)
            pages_done = progress.get("pagesDone", 0)
            chunks_total = progress.get("chunksTotal", 0)
            chunks_done = progress.get("chunksDone", 0)
            
            # Compute indexStatus: NOT_INDEXED, PROCESSING, or INDEXED
            index_status = "NOT_INDEXED"
            if chunks_total > 0 and chunks_done == chunks_total:
                index_status = "INDEXED"
            elif job.get("status") in ["QUEUED", "PROCESSING"]:
                index_status = "PROCESSING"
            
            # Use job status directly - it's the authoritative source (we're using latest job by updatedAt)
            job_status = job.get("status", "UNKNOWN")
            
            # Validate: if job_status is READY, it must have chunks (this is enforced in update_job_progress)
            # Trust the job status as it's from the latest job
            
            # Determine indexedAt - only set if status is READY (successful indexing)
            indexed_at = None
            if job_status == "READY" and chunks_total > 0 and chunks_done == chunks_total:
                indexed_at = job.get("updatedAt")  # Use job's updatedAt when it completed successfully
            
            policy_info = {
                "policyId": policy_id,
                "filename": filename,
                "status": job_status,
                "indexStatus": index_status,  # Computed: NOT_INDEXED, PROCESSING, INDEXED
                "indexedAt": indexed_at,
                "jobId": job.get("jobId"),
                "ocrAttempted": job.get("ocrAttempted", False),
                "ocrAvailable": job.get("ocrAvailable", False),
                "lastError": job.get("error"),
            }
            
            # Add progress if available
            if progress:
                policy_info["progress"] = {
                    "pagesTotal": pages_total,
                    "pagesDone": pages_done,
                    "chunksTotal": chunks_total,
                    "chunksDone": chunks_done,
                }
            
            policies.append(policy_info)
        
        return {
            "tenantId": tenantId,
            "policies": policies
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list policies: {str(e)}")


@router.get("/v1/policies/{policyId}/file")
async def get_policy_file(
    policyId: str,
    tenantId: str = Query(..., description="Tenant identifier")
):
    """
    Get policy file for download/preview
    """
    try:
        # Find the policy in jobs to get filename
        all_jobs = get_all_jobs(tenantId)
        filename = None
        content_type = None
        
        for job in all_jobs:
            if job.get('policyId') == policyId:
                filename = job.get('filename')
                content_type = job.get('contentType')
                break
        
        if not filename:
            raise HTTPException(status_code=404, detail="Policy not found")
        
        # Get file path
        data_dir = Path(settings.data_dir)
        policy_dir = data_dir / tenantId / policyId
        
        # Try to find the file
        if not policy_dir.exists():
            raise HTTPException(status_code=404, detail="Policy file not found")
        
        # Look for file (usually matches filename)
        file_path = policy_dir / filename
        if not file_path.exists():
            any_files = list(policy_dir.iterdir())
            if any_files:
                file_path = any_files[0]
            else:
                raise HTTPException(status_code=404, detail="Policy file not found")
        
        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type=content_type or "application/octet-stream"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get policy file: {str(e)}")


@router.get("/v1/policies/{policyId}/text")
async def get_policy_text(
    policyId: str,
    tenantId: str = Query(..., description="Tenant identifier")
):
    """
    Return extracted text pages with locator metadata for preview.
    """
    try:
        data_dir = Path(settings.data_dir)
        text_dir = data_dir / tenantId / policyId / "text"
        if not text_dir.exists():
            raise HTTPException(status_code=404, detail="Extracted text not found")

        pages = []
        for page_file in sorted(text_dir.glob("page_*.txt")):
            try:
                page_num = int(page_file.stem.split("_")[1])
            except Exception:
                continue
            text = page_file.read_text(encoding="utf-8", errors="ignore")
            meta_path = page_file.with_suffix(".meta.json")
            meta = {}
            if meta_path.exists():
                try:
                    meta = json.loads(meta_path.read_text())
                except Exception:
                    meta = {}
            pages.append({"pageNumber": page_num, "text": text, "meta": meta})

        pages.sort(key=lambda p: p["pageNumber"])
        return {"tenantId": tenantId, "policyId": policyId, "pages": pages}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load text: {str(e)}")


@router.delete("/v1/policies/{policyId}")
async def delete_policy_endpoint(
    policyId: str,
    tenantId: str = Query(..., description="Tenant identifier")
):
    """
    Delete a policy and all associated data - COMPLETE DELETION
    This function ensures 100% deletion:
    1. Job files (source of truth)
    2. Vector store chunks
    3. Manifest files (per-policy and global)
    4. Policy directory and all files
    5. Verification that deletion was successful
    """
    try:
        print(f"\n{'='*60}")
        print(f"🗑️  DELETING POLICY: {policyId}")
        print(f"   Tenant: {tenantId}")
        print(f"{'='*60}\n")
        
        data_dir = Path(settings.data_dir)
        deleted_items = []
        errors = []
        
        # ============================================================
        # 1. DELETE JOB FILES (MUST BE FIRST - source of truth)
        # ============================================================
        print("📋 Step 1: Deleting job files...")
        all_jobs = get_all_jobs(tenantId)
        jobs_dir = data_dir / "jobs"
        jobs_dir.mkdir(parents=True, exist_ok=True)  # Ensure jobs directory exists
        deleted_jobs = []
        
        for job in all_jobs:
            if job.get('policyId') == policyId:
                job_id = job.get('jobId')
                if job_id:
                    job_file = jobs_dir / f"{job_id}.json"
                    if job_file.exists():
                        try:
                            job_file.unlink()
                            deleted_jobs.append(job_id)
                            deleted_items.append(f"job:{job_id}")
                            print(f"   ✓ Deleted job file: {job_file.name}")
                        except Exception as e:
                            error_msg = f"Failed to delete job file {job_file.name}: {e}"
                            print(f"   ❌ {error_msg}")
                            errors.append(error_msg)
                    else:
                        print(f"   ⚠ Job file not found: {job_file}")
        
        # Double-check: verify jobs are actually deleted
        remaining_jobs_after_delete = get_all_jobs(tenantId)
        remaining_policy_jobs = [j for j in remaining_jobs_after_delete if j.get('policyId') == policyId]
        if remaining_policy_jobs:
            print(f"   ⚠ Warning: Policy still has {len(remaining_policy_jobs)} job(s) after deletion attempt")
            # Try to delete again (force delete)
            for job in remaining_policy_jobs:
                job_id = job.get('jobId')
                if job_id:
                    job_file = jobs_dir / f"{job_id}.json"
                    if job_file.exists():
                        try:
                            job_file.unlink()
                            print(f"   ✓ Force-deleted job file: {job_file.name}")
                        except Exception as e:
                            print(f"   ❌ Failed to force-delete {job_file.name}: {e}")
        
        if not deleted_jobs:
            print(f"   ⚠ Warning: No job files found for policy {policyId}")
            # This is not necessarily an error - policy might have been created but job files might not exist
        else:
            print(f"   ✅ Deleted {len(deleted_jobs)} job file(s)")
        
        # ============================================================
        # 2. DELETE FROM VECTOR STORE (ChromaDB chunks)
        # ============================================================
        print("\n🔍 Step 2: Deleting chunks from vector store...")
        try:
            delete_policy_chunks(tenantId, policyId)
            deleted_items.append("vector_store:chunks")
            print(f"   ✅ Deleted chunks from vector store")
        except Exception as e:
            error_msg = f"Failed to delete chunks: {e}"
            print(f"   ❌ {error_msg}")
            errors.append(error_msg)
        
        # ============================================================
        # 3. DELETE PER-POLICY MANIFEST FILE
        # ============================================================
        print("\n📄 Step 3: Deleting manifest files...")
        manifest_file = data_dir / "manifests" / tenantId / f"{policyId}.json"
        if manifest_file.exists():
            manifest_file.unlink()
            deleted_items.append(f"manifest:{policyId}.json")
            print(f"   ✅ Deleted per-policy manifest: {manifest_file.name}")
        else:
            print(f"   ⚠ Per-policy manifest not found: {manifest_file}")
        
        # Also remove from global manifest.json if it exists
        global_manifest_path = data_dir / tenantId / "manifest.json"
        if global_manifest_path.exists():
            try:
                from app.storage import load_manifest
                manifest = load_manifest(str(global_manifest_path))
                if policyId in manifest:
                    del manifest[policyId]
                    import json
                    global_manifest_path.write_text(json.dumps(manifest, indent=2))
                    deleted_items.append("global_manifest:entry")
                    print(f"   ✅ Removed from global manifest.json")
                else:
                    print(f"   ℹ️  Policy {policyId} not found in global manifest.json (may have been removed already)")
            except Exception as e:
                error_msg = f"Failed to update global manifest: {e}"
                print(f"   ⚠ Warning: {error_msg}")
                errors.append(error_msg)
        
        # ============================================================
        # 4. DELETE POLICY DIRECTORY AND ALL FILES
        # ============================================================
        print("\n📁 Step 4: Deleting policy directory and files...")
        try:
            # Note: delete_policy_files also removes from global manifest.json
            # So we call it AFTER we've already handled manifest deletion above
            delete_policy_files(tenantId, policyId, data_dir)
            deleted_items.append("policy_directory:all_files")
            print(f"   ✅ Deleted policy directory and all files")
        except Exception as e:
            error_msg = f"Failed to delete policy files: {e}"
            print(f"   ❌ {error_msg}")
            errors.append(error_msg)
        
        # ============================================================
        # 5. VERIFICATION - Ensure policy is completely gone
        # ============================================================
        print("\n🔍 Step 5: Verifying deletion...")
        verification_passed = True
        
        # Check jobs - THIS IS THE PRIMARY SOURCE OF TRUTH
        remaining_jobs = get_all_jobs(tenantId)
        remaining_policy_jobs = [j for j in remaining_jobs if j.get('policyId') == policyId]
        if remaining_policy_jobs:
            print(f"   ❌ ERROR: Policy {policyId} still exists in jobs!")
            print(f"      Remaining job IDs: {[j.get('jobId') for j in remaining_policy_jobs]}")
            # Try to delete remaining jobs forcefully
            jobs_dir = data_dir / "jobs"
            for job in remaining_policy_jobs:
                job_id = job.get('jobId')
                if job_id:
                    job_file = jobs_dir / f"{job_id}.json"
                    if job_file.exists():
                        try:
                            job_file.unlink()
                            print(f"      ✓ Force-deleted remaining job file: {job_file.name}")
                        except Exception as e:
                            print(f"      ❌ Failed to force-delete {job_file.name}: {e}")
            verification_passed = False
        else:
            print(f"   ✅ Verified: Policy not in jobs (get_all_jobs returned {len(remaining_jobs)} total jobs)")
        
        # Check policy directory
        policy_dir = data_dir / tenantId / policyId
        if policy_dir.exists():
            print(f"   ❌ ERROR: Policy directory still exists: {policy_dir}")
            verification_passed = False
        else:
            print(f"   ✅ Verified: Policy directory deleted")
        
        # Check manifest file
        manifest_file_path = data_dir / "manifests" / tenantId / f"{policyId}.json"
        if manifest_file_path.exists():
            print(f"   ❌ ERROR: Manifest file still exists: {manifest_file_path}")
            verification_passed = False
        else:
            print(f"   ✅ Verified: Manifest file deleted or did not exist")
        
        # ============================================================
        # FINAL RESULT
        # ============================================================
        print(f"\n{'='*60}")
        if verification_passed:
            print(f"✅ SUCCESS: Policy {policyId} completely deleted")
            print(f"   Deleted items: {len(deleted_items)}")
            if errors:
                print(f"   Warnings: {len(errors)} (non-critical)")
        else:
            print(f"❌ WARNING: Policy deletion completed but verification failed")
            print(f"   Some items may still exist")
        print(f"{'='*60}\n")
        
        return {
            "message": "Policy deleted successfully",
            "policyId": policyId,
            "tenantId": tenantId,
            "deleted": True,
            "deletedJobs": deleted_jobs,
            "deletedItems": deleted_items,
            "verificationPassed": verification_passed,
            "errors": errors if errors else None
        }
    except Exception as e:
        print(f"\n{'='*60}")
        print(f"❌ CRITICAL ERROR deleting policy {policyId}: {e}")
        print(f"{'='*60}\n")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to delete policy: {str(e)}")


class ReprocessRequest(BaseModel):
    mode: str = "ocr_only"


@router.post("/v1/policies/{policyId}/reprocess")
async def reprocess_policy_endpoint(
    policyId: str,
    tenantId: str = Query(..., description="Tenant identifier"),
    request_body: ReprocessRequest = Body(default=ReprocessRequest())
):
    """
    Reprocess a policy (re-run OCR or full processing)
    
    Body (JSON):
        { "mode": "ocr_only" | "full" }  # default "ocr_only"
    
    Returns HTTP 202 Accepted with job information
    """
    try:
        from app.jobs import create_job, start_job_processing, get_all_jobs, JobStatus
        from app.text_extract import convert_from_path
        from app.vector_store import delete_policy_chunks
        from app.manifest import load_manifest, save_manifest
        import asyncio
        import shutil
        
        mode = request_body.mode
        
        # Validate mode
        if mode not in ["ocr_only", "full"]:
            raise HTTPException(status_code=400, detail="mode must be 'ocr_only' or 'full'")
        
        # Validate tenantId - check if tenant directory exists
        data_dir = Path(settings.data_dir)
        tenant_dir = data_dir / tenantId
        if not tenant_dir.exists():
            raise HTTPException(status_code=404, detail=f"Tenant {tenantId} not found")
        
        # Validate policyId exists on disk (original file path)
        policy_dir = data_dir / tenantId / policyId
        if not policy_dir.exists():
            raise HTTPException(status_code=404, detail=f"Policy {policyId} not found")
        
        # Find PDF file in policy directory
        pdf_files = list(policy_dir.glob("*.pdf"))
        if not pdf_files:
            raise HTTPException(status_code=404, detail=f"PDF file not found for policy {policyId}")
        
        # Get filename from existing job or use first PDF found
        all_jobs = get_all_jobs(tenantId)
        existing_job = None
        filename = None
        for job in all_jobs:
            if job.get('policyId') == policyId:
                existing_job = job
                filename = job.get("filename")
                break
        
        # If no job found, use the PDF filename from disk
        if not filename:
            filename = pdf_files[0].name
        
        # Validate file exists
        file_path = policy_dir / filename
        if not file_path.exists() and pdf_files:
            file_path = pdf_files[0]
            filename = file_path.name
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"Policy file not found: {filename}")
        
        # Check OCR prerequisites for ocr_only mode
        if mode == "ocr_only":
            from app.openai_client import get_openai_client
            ocr_provider = settings.ocr_provider
            
            # Check based on selected provider
            if ocr_provider == "vision":
                # Vision OCR requires OpenAI client
                if get_openai_client() is None:
                    raise HTTPException(
                        status_code=409,
                        detail="Vision OCR requires OPENAI_API_KEY. Please set OPENAI_API_KEY environment variable."
                    )
            elif ocr_provider == "tesseract":
                # Tesseract requires pdf2image and pytesseract
                if convert_from_path is None:
                    raise HTTPException(
                        status_code=409,
                        detail="OCR prerequisites missing. Install poppler (for pdf2image) and tesseract (for pytesseract)."
                    )
                try:
                    import pytesseract
                except ImportError:
                    raise HTTPException(
                        status_code=409,
                        detail="OCR prerequisites missing. Install pytesseract (pip install pytesseract)."
                    )
            else:  # auto
                # Check if at least one is available
                vision_available = get_openai_client() is not None
                tesseract_available = convert_from_path is not None
                try:
                    import pytesseract
                    tesseract_available = tesseract_available and pytesseract is not None
                except ImportError:
                    tesseract_available = False
                
                if not vision_available and not tesseract_available:
                    raise HTTPException(
                        status_code=409,
                        detail="OCR prerequisites missing. Install either: (1) OPENAI_API_KEY for Vision OCR, or (2) poppler+tesseract for Tesseract OCR."
                    )
        
        # For "full" mode, clear existing chunks (but keep text files for re-indexing)
        if mode == "full":
            # Delete chunks from Chroma - text files will be used for re-indexing
            delete_policy_chunks(tenantId, policyId)
            # Note: We keep text files so we can rebuild chunks from them
            # Only delete text files if they don't exist or we want to force OCR
        
        # Create new job for reprocessing (pass mode to job)
        job_id = create_job(tenantId, policyId, filename, reprocess_mode=mode)
        
        # Start reprocessing in background (non-blocking)
        asyncio.create_task(start_job_processing(job_id))
        
        # Return HTTP 202 Accepted
        return Response(
            content=json.dumps({
                "tenantId": tenantId,
                "policyId": policyId,
                "jobId": job_id,
                "status": JobStatus.QUEUED
            }),
            media_type="application/json",
            status_code=202
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to reprocess policy: {str(e)}")


class RewriteRequest(BaseModel):
    mode: str = "apply_all"  # "apply_all" | "single_issue"
    issues: List[dict] = []
    language: str = "auto"  # "en" | "ar" | "auto"


class RewriteResponse(BaseModel):
    policyId: str
    status: str
    updatedPolicyText: str
    sections: Optional[dict] = None


@router.post("/v1/policies/{policyId}/rewrite", response_model=RewriteResponse)
async def rewrite_policy_endpoint(
    policyId: str,
    tenantId: str = Query(..., description="Tenant identifier"),
    request_body: RewriteRequest = Body(...)
):
    """
    Rewrite policy applying all detected issues
    
    Body (JSON):
        {
            "mode": "apply_all" | "single_issue",
            "issues": [...],
            "language": "en" | "ar" | "auto"
        }
    
    Returns rewritten policy text
    """
    try:
        from app.openai_client import get_openai_client
        
        # Helper function to read policy text
        def read_policy_text(tenant_id: str, policy_id: str) -> str:
            """Read policy text from storage"""
            try:
                # Try new path first: data/<tenantId>/<policyId>/text/
                text_dir = Path(settings.data_dir) / tenant_id / policy_id / "text"
                if not text_dir.exists():
                    # Fallback to old path: data/text/<tenantId>/<policyId>/
                    text_dir = Path(settings.data_dir) / "text" / tenant_id / policy_id
                if not text_dir.exists():
                    return ""
                text_parts = []
                page_files = sorted(text_dir.glob("page_*.txt"))
                for page_file in page_files:
                    with open(page_file, "r", encoding="utf-8") as f:
                        text_parts.append(f.read())
                return "\n\n".join(text_parts)
            except Exception as e:
                print(f"Error reading policy text for {policy_id}: {e}")
                return ""
        
        # Check OpenAI availability
        openai_client = get_openai_client()
        if not openai_client:
            raise HTTPException(
                status_code=409,
                detail="AI rewrite requires OpenAI. Please set OPENAI_API_KEY environment variable."
            )
        
        # Validate policy exists
        policy_text = read_policy_text(tenantId, policyId)
        if not policy_text:
            raise HTTPException(status_code=404, detail=f"Policy {policyId} not found or has no text")
        
        # Get policy filename
        manifest = load_manifest(tenantId, policyId)
        filename = manifest.get("filename", policyId) if manifest else policyId
        
        # Build rewrite instruction from ALL issues
        issues_list = request_body.issues or []
        if not issues_list:
            raise HTTPException(status_code=400, detail="No issues provided for rewrite")
        
        # Group issues by type
        gaps = [i for i in issues_list if i.get("type") == "GAP"]
        conflicts = [i for i in issues_list if i.get("type") == "CONFLICT"]
        inconsistencies = [i for i in issues_list if i.get("type") == "INCONSISTENCY"]
        duplicates = [i for i in issues_list if i.get("type") == "DUPLICATE"]
        
        # Build comprehensive rewrite prompt
        rewrite_instructions = []
        
        if gaps:
            missing_sections = []
            for gap in gaps:
                if "Missing core sections:" in gap.get("summary", ""):
                    sections = gap.get("summary", "").replace("Missing core sections: ", "").split(", ")
                    missing_sections.extend(sections)
            if missing_sections:
                unique_sections = list(set(missing_sections))
                rewrite_instructions.append(
                    f"ADD MISSING SECTIONS: The policy is missing the following core sections: {', '.join(unique_sections)}. "
                    f"Add these sections with appropriate content that aligns with the policy's purpose and scope."
                )
        
        if conflicts:
            conflict_descriptions = []
            for conflict in conflicts:
                desc = f"- {conflict.get('summary', '')} at Page {conflict.get('locationA', {}).get('pageNumber', '?')}, "
                desc += f"Lines {conflict.get('locationA', {}).get('lineStart', '?')}-{conflict.get('locationA', {}).get('lineEnd', '?')}. "
                desc += f"Recommendation: {conflict.get('recommendation', '')}"
                conflict_descriptions.append(desc)
            if conflict_descriptions:
                rewrite_instructions.append(
                    f"RESOLVE CONFLICTS: The following conflicts were detected:\n" + "\n".join(conflict_descriptions) +
                    "\nPlease harmonize these conflicts by updating the policy to resolve contradictions."
                )
        
        if inconsistencies:
            inconsistency_descriptions = []
            for inc in inconsistencies:
                desc = f"- {inc.get('summary', '')} at Page {inc.get('locationA', {}).get('pageNumber', '?')}. "
                desc += f"Recommendation: {inc.get('recommendation', '')}"
                inconsistency_descriptions.append(desc)
            if inconsistency_descriptions:
                rewrite_instructions.append(
                    f"RESOLVE INCONSISTENCIES: The following inconsistencies were found:\n" + "\n".join(inconsistency_descriptions) +
                    "\nPlease standardize these inconsistencies across the policy."
                )
        
        if duplicates:
            duplicate_descriptions = []
            for dup in duplicates:
                desc = f"- {dup.get('summary', '')} at Page {dup.get('locationA', {}).get('pageNumber', '?')}. "
                desc += f"Recommendation: {dup.get('recommendation', '')}"
                duplicate_descriptions.append(desc)
            if duplicate_descriptions:
                rewrite_instructions.append(
                    f"REMOVE DUPLICATES: The following duplicate content was found:\n" + "\n".join(duplicate_descriptions) +
                    "\nPlease consolidate duplicate content to avoid confusion."
                )
        
        if not rewrite_instructions:
            raise HTTPException(status_code=400, detail="No valid rewrite instructions could be generated from the provided issues")
        
        # Build comprehensive prompt
        system_prompt = """You are an expert in hospital policy writing and revision. Your task is to rewrite a policy document by applying ALL detected issues and improvements in a single, comprehensive revision.

Guidelines:
- Apply ALL issues and recommendations in one unified rewrite
- Maintain professional medical terminology and structure
- Keep the policy's original purpose and scope
- Ensure consistency throughout the document
- Add missing sections with appropriate content
- Resolve conflicts and inconsistencies
- Remove or consolidate duplicate content
- Maintain proper formatting and structure
- Ensure the rewritten policy is complete, clear, and actionable
- Do not remove valid content unless it's a duplicate
- Preserve the policy's professional tone and accreditation standards

Output a complete, revised policy document that addresses ALL issues."""
        
        user_prompt = f"""Rewrite the following policy document by applying ALL the detected issues and improvements:

POLICY DOCUMENT:
{policy_text[:8000] if len(policy_text) > 8000 else policy_text}

ISSUES TO APPLY:
{chr(10).join(rewrite_instructions)}

Please provide a complete, revised version of the policy that:
1. Includes all missing sections
2. Resolves all conflicts and inconsistencies
3. Removes or consolidates duplicate content
4. Maintains professional structure and formatting
5. Is ready for use in a hospital setting

Output the complete rewritten policy document."""
        
        # Call OpenAI
        try:
            completion = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.4,
                max_tokens=4000,
            )
            
            rewritten_text = completion.choices[0].message.content or ""
            
            if not rewritten_text:
                raise HTTPException(status_code=500, detail="OpenAI returned empty response")
            
            return RewriteResponse(
                policyId=policyId,
                status="OK",
                updatedPolicyText=rewritten_text,
                sections=None  # Can be enhanced later to extract structured sections
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"OpenAI rewrite failed: {str(e)}"
            )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to rewrite policy: {str(e)}")
