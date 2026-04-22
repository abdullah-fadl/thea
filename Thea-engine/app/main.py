"""FastAPI application entry point"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import routes_ingest, routes_status, routes_search, routes_conflicts, routes_harmonize, routes_generate, routes_policies, routes_issues, routes_tags, routes_risk_detector
from app.api import routes_conflicts_analyze, routes_conflicts_resolve, routes_preview_classify
from app.analysis_progress import cleanup_old_analyses
from app.jobs import get_all_jobs
from app.config import settings


app = FastAPI(title="Thea API", version="1.0.0")

# CORS configuration
# Parse ALLOWED_ORIGINS from environment variable (comma-separated)
# Defaults to allowing all origins in development, restricted in production
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
if allowed_origins_env == "*":
    allowed_origins = ["*"]
else:
    # Parse comma-separated origins and strip whitespace
    allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(routes_ingest.router)
app.include_router(routes_preview_classify.router)
app.include_router(routes_status.router)
app.include_router(routes_search.router)
app.include_router(routes_policies.router)
app.include_router(routes_conflicts.router)
app.include_router(routes_conflicts_analyze.router)
app.include_router(routes_conflicts_resolve.router)
app.include_router(routes_harmonize.router)
app.include_router(routes_generate.router)
app.include_router(routes_issues.router)
app.include_router(routes_tags.router)
app.include_router(routes_risk_detector.router)


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok"}


@app.on_event("startup")
async def startup_event():
    """Startup event - validate configuration and resume any pending jobs"""
    # Validate embeddings provider configuration
    print(f"[Config] EMBEDDINGS_PROVIDER: {settings.embeddings_provider}")
    
    if settings.embeddings_provider == "openai":
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required when EMBEDDINGS_PROVIDER='openai'")
        print("[Config] OpenAI embeddings enabled")
        
        # Test OpenAI client
        from app.openai_client import get_openai_client
        client = get_openai_client()
        if client is None:
            raise ValueError("Failed to initialize OpenAI client. Check OPENAI_API_KEY.")
        print("[Config] OpenAI client initialized successfully")
    elif settings.embeddings_provider == "local":
        print(f"[Config] Local embeddings enabled (model: {settings.embedding_model})")
    else:
        raise ValueError(f"Invalid EMBEDDINGS_PROVIDER: {settings.embeddings_provider}")
    
    # Check Vision OCR dependencies (pdf2image + poppler)
    print("[Config] Checking Vision OCR dependencies...")
    
    # Check pdf2image
    try:
        import pdf2image
        print("[Config] ✓ pdf2image is installed")
    except ImportError:
        print("[Config] ⚠️ WARNING: pdf2image is not installed")
        print("[Config]    Install in venv: cd policy-engine && source .venv/bin/activate && python -m pip install pdf2image pillow")
        print("[Config]    Vision OCR will return OCR_DEPS_MISSING error when used")
        print("[Config]    NOTE: PEP 668 on macOS requires using venv - never install globally")
    
    # Check poppler (pdftoppm)
    import subprocess
    try:
        result = subprocess.run(
            ['pdftoppm', '-v'],
            capture_output=True,
            text=True,
            timeout=5
        )
        poppler_available = result.returncode == 0 or 'pdftoppm' in result.stderr or 'pdftoppm' in result.stdout
        if poppler_available:
            print("[Config] ✓ Poppler (pdftoppm) is available")
        else:
            print("[Config] ⚠️ WARNING: Poppler (pdftoppm) not found in PATH")
            print("[Config]    Install with: brew install poppler")
            print("[Config]    Vision OCR will return POPPLER_MISSING error when used")
    except (FileNotFoundError, subprocess.TimeoutExpired):
        print("[Config] ⚠️ WARNING: Poppler (pdftoppm) not found in PATH")
        print("[Config]    Install with: brew install poppler")
        print("[Config]    Vision OCR will return POPPLER_MISSING error when used")
    
    # Get all jobs that are QUEUED or PROCESSING
    import asyncio
    from app.jobs import JobStatus, get_all_jobs, start_job_processing
    
    all_jobs = get_all_jobs()
    
    for job in all_jobs:
        if job.get("status") in [JobStatus.QUEUED, JobStatus.PROCESSING]:
            # Resume job processing (non-blocking)
            asyncio.create_task(start_job_processing(job["jobId"]))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
