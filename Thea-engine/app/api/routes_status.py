"""Job status API routes"""
from fastapi import APIRouter, HTTPException, Query
from app.jobs import load_job


router = APIRouter()


@router.get("/v1/jobs/{job_id}")
async def get_job_status(job_id: str, tenantId: str = Query(...)):
    """
    Get job status
    
    Args:
        job_id: Job identifier
        tenantId: Tenant identifier (required for security)
    """
    job = load_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Verify tenant
    if job.get("tenantId") != tenantId:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return job
