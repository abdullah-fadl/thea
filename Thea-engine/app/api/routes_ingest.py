"""Ingestion API routes"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List
import uuid
from app.jobs import create_job, start_job_processing, get_all_jobs
from app.storage import save_uploaded_file, get_file_hash
from app.storage import delete_policy_files
from app.vector_store import delete_policy_chunks
from app.config import settings
from pathlib import Path
import json
from app.file_types import detect_file_type


router = APIRouter()


@router.post("/v1/ingest")
async def ingest_files(
    tenantId: str = Form(...),
    uploaderUserId: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """
    Ingest multiple files
    
    Args:
        tenantId: Tenant identifier (required)
        uploaderUserId: User ID who uploaded (required)
        files: List of files to upload
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    # Check for duplicate filenames before processing
    all_jobs = get_all_jobs(tenantId)
    existing_filenames = set()
    for job in all_jobs:
        filename = job.get("filename")
        if filename:
            existing_filenames.add(filename.lower())  # Case-insensitive comparison
    
    duplicate_files = []
    new_files = []
    duplicate_policy_ids: List[str] = []
    
    for file in files:
        filename = file.filename or "unknown"
        if filename.lower() in existing_filenames:
            duplicate_files.append(filename)
        else:
            new_files.append(file)
    
    # If there are duplicates, delete existing policies and continue (replace behavior)
    if duplicate_files:
        # Find matching policyIds from jobs
        for job in all_jobs:
            filename = job.get("filename")
            policy_id = job.get("policyId")
            if filename and policy_id and filename.lower() in {f.lower() for f in duplicate_files}:
                duplicate_policy_ids.append(policy_id)
        
        if duplicate_policy_ids:
            data_dir = Path(settings.data_dir)
            jobs_dir = data_dir / "jobs"
            jobs_dir.mkdir(parents=True, exist_ok=True)
            for policy_id in duplicate_policy_ids:
                # Delete job files for this policy
                for job in all_jobs:
                    if job.get("policyId") == policy_id:
                        job_id = job.get("jobId")
                        if job_id:
                            job_file = jobs_dir / f"{job_id}.json"
                            if job_file.exists():
                                job_file.unlink()
                
                # Delete vector store chunks
                delete_policy_chunks(tenantId, policy_id)
                
                # Delete per-policy manifest
                manifest_file = data_dir / "manifests" / tenantId / f"{policy_id}.json"
                if manifest_file.exists():
                    manifest_file.unlink()
                
                # Remove from global manifest.json if present
                global_manifest_path = data_dir / tenantId / "manifest.json"
                if global_manifest_path.exists():
                    try:
                        manifest = json.loads(global_manifest_path.read_text())
                        if policy_id in manifest:
                            del manifest[policy_id]
                            global_manifest_path.write_text(json.dumps(manifest, indent=2))
                    except Exception:
                        pass
                
                # Delete policy files on disk
                delete_policy_files(tenantId, policy_id, data_dir)
        
        # After cleanup, allow re-upload of all files (including duplicates)
        new_files = list(files)
        duplicate_files = []
    
    jobs = []
    rejected_files = []
    
    for file in new_files:
        filename = file.filename or "unknown"
        try:
            file_info = detect_file_type(filename, file.content_type)
        except ValueError as error:
            rejected_files.append({"filename": filename, "error": str(error)})
            continue

        # Read file content
        file_content = await file.read()
        
        if len(file_content) == 0:
            continue
        
        # Generate policy ID
        policy_id = str(uuid.uuid4())
        
        # Save file
        file_path = save_uploaded_file(
            tenantId,
            policy_id,
            filename,
            file_content,
            Path(settings.data_dir)
        )
        
        # Create job
        job_id = create_job(
            tenantId,
            policy_id,
            filename,
            content_type=file_info.mime_type,
            file_type=file_info.file_type,
            extension=file_info.extension,
        )
        
        # Start processing in background (non-blocking)
        import asyncio
        asyncio.create_task(start_job_processing(job_id))
        
        jobs.append({
            "jobId": job_id,
            "policyId": policy_id,
            "filename": filename,
            "status": "QUEUED"
        })
    
    if rejected_files and not jobs:
        raise HTTPException(status_code=400, detail={"error": "Unsupported files", "files": rejected_files})

    return {
        "tenantId": tenantId,
        "jobs": jobs,
        "rejected": rejected_files
    }
