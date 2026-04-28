"""Job management and background processing"""
import json
import uuid
import asyncio
import hashlib
import os

try:
    import pytesseract  # type: ignore
except Exception:
    pytesseract = None

from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

from app.storage import get_file_hash
from app.config import settings
from app.manifest import (
    load_manifest, save_manifest, create_manifest,
    update_manifest_page, update_manifest_chunks, set_manifest_status,
    should_skip_page
)
from app.text_extract import extract_text_from_pdf, convert_from_path
from app.text_extractors import (
    extract_text_from_txt,
    extract_text_from_docx,
    extract_text_from_xlsx,
    extract_text_from_xls,
    extract_text_from_pptx,
    extract_text_from_image,
)
from app.ocr_hybrid import extract_all_pages_hybrid
from app.ocr_vision import vision_ocr_pdf_page
from app.chunking_enhanced import build_clean_chunks_from_pages
from app.embeddings import generate_embeddings
from app.vector_store import upsert_chunks, delete_policy_chunks
from app.openai_client import get_openai_client
from app.ocr import extract_text_from_pdf_page


def _normalize_text_for_comparison(text: str) -> str:
    """Normalize text for similarity comparison (lowercase, remove extra whitespace)"""
    return " ".join(text.lower().split())


def _text_similarity_hash(text: str) -> str:
    """Compute hash of normalized text for quick comparison"""
    normalized = _normalize_text_for_comparison(text)
    return hashlib.md5(normalized.encode("utf-8")).hexdigest()


def _detect_duplicate_ocr_pages(text_pages: List[str], similarity_threshold: int = 3) -> tuple[bool, str]:
    """
    Detect if OCR produced duplicate/repeated pages
    Returns: (is_duplicate, error_message)
    """
    if len(text_pages) < similarity_threshold:
        return False, ""

    page_hashes = [_text_similarity_hash(text) for text in text_pages]

    consecutive_count = 1
    max_consecutive = 1
    current_hash = page_hashes[0] if page_hashes else None

    for i in range(1, len(page_hashes)):
        if page_hashes[i] == current_hash:
            consecutive_count += 1
            max_consecutive = max(max_consecutive, consecutive_count)
        else:
            consecutive_count = 1
            current_hash = page_hashes[i]

    if max_consecutive >= similarity_threshold:
        error_msg = (
            f"OCR produced repeated pages; likely table/scanned issue; "
            f"try table_ocr preset (found {max_consecutive} consecutive identical pages)"
        )
        return True, error_msg

    return False, ""


def build_chunks_from_pages(
    tenant_id: str,
    policy_id: str,
    filename: str,
    chunk_size_chars: int = 2000,
    overlap_chars: int = 300
) -> List[Dict[str, Any]]:
    """
    Build chunks from saved text pages with duplicate header removal and cleaning
    """
    return build_clean_chunks_from_pages(
        tenant_id, policy_id, filename, chunk_size_chars, overlap_chars
    )


def _write_text_pages(
    tenant_id: str,
    policy_id: str,
    pages: List[tuple[int, str, dict]],
):
    data_dir = Path(settings.data_dir)
    text_dir = data_dir / tenant_id / policy_id / "text"
    text_dir.mkdir(parents=True, exist_ok=True)

    for page_num, text, meta in pages:
        text_path = text_dir / f"page_{page_num}.txt"
        meta_path = text_dir / f"page_{page_num}.meta.json"
        with open(text_path, "w", encoding="utf-8") as f:
            f.write(text or "")
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta or {}, f, indent=2)


# Job executor pool
executor = ThreadPoolExecutor(max_workers=2)


class JobStatus:
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    READY = "READY"
    OCR_NEEDED = "OCR_NEEDED"
    OCR_FAILED = "OCR_FAILED"
    FAILED = "FAILED"


def create_job(
    tenant_id: str,
    policy_id: str,
    filename: str,
    content_type: str | None = None,
    file_type: str | None = None,
    extension: str | None = None,
    reprocess_mode: str | None = None,
    ocr_preset: str | None = None
) -> str:
    """Create a new job and return job_id"""
    job_id = str(uuid.uuid4())

    # Check OCR availability (pdf2image/poppler)
    ocr_available = convert_from_path is not None

    # Default OCR preset from env var
    if ocr_preset is None:
        ocr_preset = os.getenv("OCR_PRESET", "normal_ocr")
    if ocr_preset not in ["normal_ocr", "table_ocr"]:
        ocr_preset = "normal_ocr"

    job_data = {
        "jobId": job_id,
        "tenantId": tenant_id,
        "policyId": policy_id,
        "filename": filename,
        "contentType": content_type,
        "fileType": file_type,
        "extension": extension,
        "status": JobStatus.QUEUED,
        "progress": {"pagesTotal": 0, "pagesDone": 0, "chunksTotal": 0, "chunksDone": 0},
        "ocrAttempted": False,
        "ocrAvailable": ocr_available,
        "ocrPreset": ocr_preset,
        "error": None,
        "reprocessMode": reprocess_mode,  # "ocr_only" | "full" | None
        "createdAt": datetime.utcnow().isoformat(),
        "updatedAt": datetime.utcnow().isoformat(),
    }

    save_job(job_id, job_data)
    return job_id


def save_job(job_id: str, job_data: Dict[str, Any]):
    """Save job data to disk"""
    jobs_dir = Path(settings.data_dir) / "jobs"
    jobs_dir.mkdir(parents=True, exist_ok=True)
    job_path = jobs_dir / f"{job_id}.json"
    job_data["updatedAt"] = datetime.utcnow().isoformat()

    with open(job_path, "w") as f:
        json.dump(job_data, f, indent=2)


def load_job(job_id: str) -> Dict[str, Any] | None:
    """Load job data from disk"""
    jobs_dir = Path(settings.data_dir) / "jobs"
    job_path = jobs_dir / f"{job_id}.json"
    if not job_path.exists():
        return None
    try:
        with open(job_path, "r") as f:
            return json.load(f)
    except Exception:
        return None


def update_job_progress(
    job_id: str,
    pages_total: int | None = None,
    pages_done: int | None = None,
    chunks_total: int | None = None,
    chunks_done: int | None = None,
    status: str | None = None,
    error: str | None = None,
    ocr_attempted: bool | None = None,
    ocr_available: bool | None = None,
):
    """Update job progress with optional fields"""
    job = load_job(job_id)
    if not job:
        return

    if pages_total is not None:
        job["progress"]["pagesTotal"] = pages_total
    if pages_done is not None:
        job["progress"]["pagesDone"] = pages_done
    if chunks_total is not None:
        job["progress"]["chunksTotal"] = chunks_total
    if chunks_done is not None:
        job["progress"]["chunksDone"] = chunks_done
    if status:
        job["status"] = status
    if error is not None:
        job["error"] = error
    if ocr_attempted is not None:
        job["ocrAttempted"] = ocr_attempted
    if ocr_available is not None:
        job["ocrAvailable"] = ocr_available

    if status == JobStatus.READY and job["progress"].get("chunksTotal", 0) == 0:
        print("[Job] WARNING: Cannot set READY status with chunksTotal=0")
        job["status"] = JobStatus.FAILED
        if not job.get("error"):
            job["error"] = "No chunks created"

    save_job(job_id, job)


def process_job(job_id: str):
    """Process a job (runs in background thread)"""
    try:
        job = load_job(job_id)
        if not job:
            print(f"[Job] ERROR: Job {job_id} not found")
            return

        tenant_id = job["tenantId"]
        policy_id = job["policyId"]
        filename = job["filename"]
        reprocess_mode = job.get("reprocessMode")  # "ocr_only" | "full" | None

        update_job_progress(job_id, status=JobStatus.PROCESSING)

        data_dir = Path(settings.data_dir)
        policy_dir = data_dir / tenant_id / policy_id
        file_path = policy_dir / filename

        if not file_path.exists():
            raise Exception(f"File not found: {filename}")

        with open(file_path, "rb") as f:
            file_hash = get_file_hash(f.read())

        manifest = load_manifest(tenant_id, policy_id)

        if reprocess_mode is None:
            if manifest and manifest.get("fileHash") == file_hash:
                all_completed = all(p.get("status") == "COMPLETED" for p in manifest.get("pages", []))
                if all_completed:
                    update_job_progress(job_id, status=JobStatus.READY)
                    return

        if not manifest:
            manifest = create_manifest(tenant_id, policy_id, filename, file_hash)
        else:
            if manifest.get("fileHash") != file_hash:
                delete_policy_chunks(tenant_id, policy_id)
                manifest = create_manifest(tenant_id, policy_id, filename, file_hash)

        file_type = job.get("fileType") or "pdf"

        if file_type != "pdf":
            try:
                if file_type == "txt":
                    pages = extract_text_from_txt(file_path)
                elif file_type == "docx":
                    pages = extract_text_from_docx(file_path)
                elif file_type == "xlsx":
                    pages = extract_text_from_xlsx(file_path)
                elif file_type == "xls":
                    pages = extract_text_from_xls(file_path)
                elif file_type == "pptx":
                    pages = extract_text_from_pptx(file_path)
                elif file_type == "ppt":
                    pages = extract_text_from_pptx(file_path)
                elif file_type in ["jpg", "jpeg", "png"]:
                    pages = extract_text_from_image(file_path)
                else:
                    raise Exception(f"Unsupported file type: {file_type}")

                pages_total = len(pages)
                update_job_progress(job_id, pages_total=pages_total, pages_done=0)
                set_manifest_status(manifest, "PROCESSING")
                save_manifest(tenant_id, policy_id, manifest)

                _write_text_pages(tenant_id, policy_id, pages)

                pages_done = 0
                for page_num, text, _meta in pages:
                    line_count = len((text or "").splitlines())
                    text_path = (Path(settings.data_dir) / tenant_id / policy_id / "text" / f"page_{page_num}.txt")
                    update_manifest_page(manifest, page_num, "COMPLETED", str(text_path), False, line_count)
                    save_manifest(tenant_id, policy_id, manifest)
                    pages_done += 1
                    update_job_progress(job_id, pages_done=pages_done)

                all_chunks = build_chunks_from_pages(tenant_id, policy_id, filename, 2000, 300)
                total_chunks = len(all_chunks)
                update_job_progress(job_id, chunks_total=total_chunks, chunks_done=0)

                if total_chunks == 0:
                    update_job_progress(job_id, status=JobStatus.FAILED, error="No chunks created")
                    set_manifest_status(manifest, "FAILED")
                    save_manifest(tenant_id, policy_id, manifest)
                    return

                embedding_batch_size = 50
                chunks_done = 0
                for batch_start in range(0, len(all_chunks), embedding_batch_size):
                    batch = all_chunks[batch_start: batch_start + embedding_batch_size]
                    batch_texts = [c["text"] for c in batch]
                    batch_embeddings = generate_embeddings(batch_texts)

                    chunks_to_upsert = []
                    for chunk_dict, emb in zip(batch, batch_embeddings):
                        chunk_dict["embedding"] = emb
                        chunks_to_upsert.append(chunk_dict)

                    upsert_chunks(tenant_id, policy_id, chunks_to_upsert, batch_size=200)
                    chunks_done += len(chunks_to_upsert)
                    update_job_progress(job_id, chunks_done=chunks_done)
                    update_manifest_chunks(manifest, chunks_done)
                    save_manifest(tenant_id, policy_id, manifest)

                set_manifest_status(manifest, "READY")
                save_manifest(tenant_id, policy_id, manifest)
                update_job_progress(
                    job_id,
                    status=JobStatus.READY,
                    pages_total=pages_total,
                    pages_done=pages_total,
                    chunks_total=total_chunks,
                    chunks_done=chunks_done,
                    error=None,
                )
                return
            except Exception as error:
                update_job_progress(job_id, status=JobStatus.FAILED, error=str(error))
                set_manifest_status(manifest, "FAILED")
                save_manifest(tenant_id, policy_id, manifest)
                return

        # If full reprocess and text pages exist => skip OCR and rebuild chunks
        text_dir = data_dir / tenant_id / policy_id / "text"
        text_pages_list = list(text_dir.glob("page_*.txt")) if text_dir.exists() else []
        n_text_pages = len(text_pages_list)
        text_pages_exist = n_text_pages > 0

        print(f"[REPROCESS] mode={reprocess_mode or 'regular'} policyId={policy_id} text_pages={n_text_pages}")

        if reprocess_mode == "full" and text_pages_exist:
            print(f"[REPROCESS] mode=full policyId={policy_id} text_pages={n_text_pages} - skipping OCR, rebuilding chunks")

            ocr_available = convert_from_path is not None
            delete_policy_chunks(tenant_id, policy_id)

            pages_total = n_text_pages
            update_job_progress(job_id, pages_total=pages_total, pages_done=pages_total)

            all_chunks = build_chunks_from_pages(tenant_id, policy_id, filename, 2000, 300)
            total_chunks = len(all_chunks)
            print(f"[REPROCESS] Built {total_chunks} chunks from {pages_total} text pages")

            if total_chunks == 0:
                update_job_progress(job_id, status=JobStatus.FAILED, chunks_total=0, error="No chunks created from text pages")
                return

            update_job_progress(job_id, chunks_total=total_chunks, chunks_done=0)

            embedding_batch_size = 50
            chunks_done = 0
            for batch_start in range(0, len(all_chunks), embedding_batch_size):
                batch = all_chunks[batch_start: batch_start + embedding_batch_size]
                batch_texts = [c["text"] for c in batch]

                print(f"[REPROCESS] Generating embeddings for batch {batch_start // embedding_batch_size + 1} ({len(batch_texts)} chunks)")
                batch_embeddings = generate_embeddings(batch_texts)

                chunks_to_upsert = []
                for chunk_dict, emb in zip(batch, batch_embeddings):
                    chunk_dict["embedding"] = emb
                    chunks_to_upsert.append(chunk_dict)

                upsert_chunks(tenant_id, policy_id, chunks_to_upsert, batch_size=200)
                chunks_done += len(chunks_to_upsert)

                update_job_progress(job_id, chunks_done=chunks_done)
                update_manifest_chunks(manifest, chunks_done)
                save_manifest(tenant_id, policy_id, manifest)

                print(f"[REPROCESS] Indexed {chunks_done}/{total_chunks} chunks")

            set_manifest_status(manifest, "READY")
            save_manifest(tenant_id, policy_id, manifest)

            update_job_progress(
                job_id,
                status=JobStatus.READY,
                pages_total=pages_total,
                pages_done=pages_total,
                chunks_total=total_chunks,
                chunks_done=chunks_done,
                error=None,
                ocr_available=ocr_available,
            )
            return

        # OCR provider selection
        ocr_provider_config = settings.ocr_provider  # "vision" | "tesseract" | "auto"
        tesseract_available = pytesseract is not None and convert_from_path is not None
        vision_available = get_openai_client() is not None

        if ocr_provider_config == "vision":
            selected_ocr_provider = "vision"
            ocr_available = vision_available
            if not vision_available:
                raise Exception("OCR_PROVIDER=vision but OpenAI client not available (check OPENAI_API_KEY)")
        elif ocr_provider_config == "tesseract":
            selected_ocr_provider = "tesseract"
            ocr_available = tesseract_available
            if not tesseract_available:
                raise Exception("OCR_PROVIDER=tesseract but prerequisites missing (pytesseract/pdf2image)")
        else:
            if vision_available:
                selected_ocr_provider = "vision"
                ocr_available = True
            elif tesseract_available:
                selected_ocr_provider = "tesseract"
                ocr_available = True
            else:
                selected_ocr_provider = None
                ocr_available = False

        print(f"[OCR] Provider: {selected_ocr_provider} (config={ocr_provider_config}, vision_available={vision_available}, tesseract_available={tesseract_available})")

        ocr_attempted = False
        update_job_progress(job_id, ocr_available=ocr_available)

        pages_info = extract_text_from_pdf(file_path)
        total_pages = len(pages_info)
        any_needs_ocr = any(needs_ocr for _, _, needs_ocr in pages_info)

        print(f"[REPROCESS] mode={reprocess_mode or 'regular'} policyId={policy_id} pagesTotal={total_pages}")
        update_job_progress(job_id, pages_total=total_pages)

        set_manifest_status(manifest, "PROCESSING")
        save_manifest(tenant_id, policy_id, manifest)

        total_chunks_processed = 0
        pages_done = 0
        pages_needing_ocr: List[int] = []
        ocr_text_pages: List[str] = []

        # Hybrid OCR (Tesseract only)
        hybrid_ocr_results = None
        if any_needs_ocr and ocr_available and selected_ocr_provider == "tesseract":
            try:
                print(f"[Hybrid OCR] Detected {sum(1 for _, _, n in pages_info if n)} pages needing OCR, using hybrid OCR pipeline...")
                ocr_attempted = True
                hybrid_text_pages, hybrid_metadata = extract_all_pages_hybrid(file_path, total_pages, dpi=200, lang="eng+ara")
                hybrid_ocr_results = {"text_pages": hybrid_text_pages, "metadata": hybrid_metadata}
                print(f"[Hybrid OCR] Completed: {len(hybrid_text_pages)} pages extracted")
                if hybrid_metadata.get("fallback_used"):
                    print("[Hybrid OCR] GPT-4 Vision fallback was used due to quality issues")
            except Exception as hybrid_error:
                print(f"[Hybrid OCR] Failed: {hybrid_error}, falling back to page-by-page OCR")
                hybrid_ocr_results = None
        elif any_needs_ocr and ocr_available and selected_ocr_provider == "vision":
            ocr_attempted = True
            print(f"[Vision OCR] Will process {sum(1 for _, _, n in pages_info if n)} pages using Vision OCR")

        # ✅ ✅ ✅ FIXED: Force OCR threshold is defined ONCE, before the loop
        MIN_TEXT_BEFORE_FORCE_OCR = int(os.getenv("MIN_TEXT_BEFORE_FORCE_OCR", "800"))

        # ✅ ✅ ✅ FIXED: for-loop + try are correctly scoped
        for page_num, text, needs_ocr in pages_info:
            # Force OCR if extracted text is too small (usually header-only)
            if len((text or "").strip()) < MIN_TEXT_BEFORE_FORCE_OCR:
                needs_ocr = True

            try:
                if reprocess_mode is None:
                    if should_skip_page(manifest, page_num, file_hash):
                        if needs_ocr:
                            page_entry = next((p for p in manifest.get("pages", []) if p.get("pageNumber") == page_num), None)
                            if page_entry and page_entry.get("status") == "COMPLETED" and page_entry.get("ocrUsed"):
                                pages_done += 1
                                update_job_progress(job_id, pages_done=pages_done)
                                continue
                        else:
                            pages_done += 1
                            update_job_progress(job_id, pages_done=pages_done)
                            continue

                # Use hybrid OCR output if exists
                if hybrid_ocr_results is not None and page_num <= len(hybrid_ocr_results["text_pages"]):
                    page_text = hybrid_ocr_results["text_pages"][page_num - 1]
                    ocr_used = True
                    pages_needing_ocr.append(page_num)
                    if needs_ocr:
                        ocr_text_pages.append(page_text)
                else:
                    page_text = text
                    ocr_used = False

                    if needs_ocr:
                        pages_needing_ocr.append(page_num)
                        ocr_attempted = True

                        if not ocr_available:
                            error_msg = f"OCR prerequisites missing (provider={selected_ocr_provider})"
                            print(f"[OCR] page={page_num} ERROR: {error_msg}")
                            update_manifest_page(manifest, page_num, "FAILED", None, False, 0, error_msg)
                            save_manifest(tenant_id, policy_id, manifest)
                            pages_done += 1  # Count failed pages too
                            update_job_progress(job_id, pages_done=pages_done)
                            continue

                        try:
                            if selected_ocr_provider == "vision":
                                print(f"[OCR] page={page_num} using Vision OCR")
                                page_text = vision_ocr_pdf_page(file_path, page_num, dpi=225, lang_hint="en")
                            else:
                                print(f"[OCR] page={page_num} using Tesseract OCR")
                                page_text = extract_text_from_pdf_page(file_path, page_num, dpi=200, lang="eng+ara", preset="normal_ocr")

                            text_len = len(page_text.strip())
                            print(f"[OCR] page={page_num} text_len={text_len} provider={selected_ocr_provider}")

                            if text_len == 0:
                                error_msg = f"OCR produced no text (provider={selected_ocr_provider})"
                                print(f"[OCR] page={page_num} ERROR: {error_msg}")
                                update_manifest_page(manifest, page_num, "FAILED", None, True, 0, error_msg)
                                save_manifest(tenant_id, policy_id, manifest)
                                pages_done += 1  # Count failed pages too
                                update_job_progress(job_id, pages_done=pages_done)
                                continue

                            ocr_used = True
                            ocr_text_pages.append(page_text)

                        except Exception as ocr_error:
                            error_msg = f"OCR failed ({selected_ocr_provider}): {str(ocr_error)}"
                            print(f"[OCR] page={page_num} EXCEPTION: {error_msg}")
                            update_manifest_page(manifest, page_num, "FAILED", None, True, 0, error_msg)
                            save_manifest(tenant_id, policy_id, manifest)
                            pages_done += 1  # Count failed pages too
                            update_job_progress(job_id, pages_done=pages_done)
                            continue

                line_count = len(page_text.splitlines())

                text_dir = data_dir / tenant_id / policy_id / "text"
                text_dir.mkdir(parents=True, exist_ok=True)
                text_path = text_dir / f"page_{page_num}.txt"

                print(f"[OCR] saving -> {text_path}")
                with open(text_path, "w", encoding="utf-8") as f:
                    f.write(page_text)

                update_manifest_page(manifest, page_num, "COMPLETED", str(text_path), ocr_used, line_count)
                save_manifest(tenant_id, policy_id, manifest)

                pages_done += 1
                update_job_progress(job_id, pages_done=pages_done)

            except Exception as e:
                error_msg = str(e)
                update_manifest_page(manifest, page_num, "FAILED", None, False, 0, error_msg)
                save_manifest(tenant_id, policy_id, manifest)
                pages_done += 1  # Count failed pages too - ensure progress reaches 100%
                update_job_progress(job_id, pages_done=pages_done)
                continue

        # Duplicate detection (only when hybrid not used)
        if hybrid_ocr_results is None and ocr_text_pages and len(ocr_text_pages) >= 3:
            is_duplicate, duplicate_error = _detect_duplicate_ocr_pages(ocr_text_pages, similarity_threshold=3)
            if is_duplicate:
                print(f"[OCR] DUPLICATE DETECTION: {duplicate_error}")
                update_job_progress(
                    job_id,
                    status=JobStatus.FAILED,
                    pages_total=total_pages,
                    pages_done=total_pages,  # Set to total_pages to show all pages were processed
                    chunks_total=0,
                    chunks_done=0,
                    error=duplicate_error,
                    ocr_attempted=ocr_attempted,
                    ocr_available=ocr_available,
                )
                set_manifest_status(manifest, "FAILED")
                save_manifest(tenant_id, policy_id, manifest)
                print(f"[Job Failed] {job_id}: Duplicate detected - {total_pages}/{total_pages} pages processed")
                return

        # Chunking + indexing
        if pages_done > 0:
            print(f"[Chunking] Starting chunking and indexing for {pages_done} pages (mode={reprocess_mode or 'regular'})")

            if reprocess_mode is not None:
                delete_policy_chunks(tenant_id, policy_id)

            text_dir = data_dir / tenant_id / policy_id / "text"
            n_text_pages = len(list(text_dir.glob("page_*.txt"))) if text_dir.exists() else 0
            print(f"[REPROCESS] mode={reprocess_mode or 'regular'} policyId={policy_id} pagesTotal={total_pages} text_pages={n_text_pages}")

            all_chunks = build_chunks_from_pages(tenant_id, policy_id, filename, 2000, 300)
            total_chunks = len(all_chunks)

            print(f"[Chunking] Built {total_chunks} chunks from {pages_done} pages")
            update_job_progress(job_id, chunks_total=total_chunks, chunks_done=0)

            if total_chunks > 0:
                embedding_batch_size = 50
                chunks_done = 0

                for batch_start in range(0, len(all_chunks), embedding_batch_size):
                    batch = all_chunks[batch_start: batch_start + embedding_batch_size]
                    batch_texts = [c["text"] for c in batch]

                    print(f"[Chunking] Generating embeddings for batch {batch_start // embedding_batch_size + 1} ({len(batch_texts)} chunks)")
                    batch_embeddings = generate_embeddings(batch_texts)

                    chunks_to_upsert = []
                    for chunk_dict, emb in zip(batch, batch_embeddings):
                        chunk_dict["embedding"] = emb
                        chunks_to_upsert.append(chunk_dict)

                    upsert_chunks(tenant_id, policy_id, chunks_to_upsert, batch_size=200)
                    chunks_done += len(chunks_to_upsert)

                    update_job_progress(job_id, chunks_done=chunks_done)
                    update_manifest_chunks(manifest, chunks_done)
                    save_manifest(tenant_id, policy_id, manifest)

                    print(f"[Chunking] Indexed {chunks_done}/{total_chunks} chunks")

                total_chunks_processed = chunks_done
                print(f"[Chunking] Completed indexing: {total_chunks_processed} chunks")
            else:
                total_chunks_processed = 0
                print("[Chunking] WARNING: No chunks created")
        else:
            # No pages were processed (all failed or skipped)
            total_chunks_processed = 0
            print("[Chunking] WARNING: No pages were processed")

        # Final status - ensure pages_done equals pagesTotal
        # This ensures progress shows 100% even if some pages failed
        final_pages_done = min(pages_done, total_pages)  # Ensure we don't exceed total
        
        if final_pages_done > 0 and total_chunks_processed > 0:
            set_manifest_status(manifest, "READY")
            save_manifest(tenant_id, policy_id, manifest)
            update_job_progress(
                job_id,
                status=JobStatus.READY,
                pages_total=total_pages,
                pages_done=total_pages,  # Always set to total_pages to show 100% progress
                chunks_total=total_chunks_processed,
                chunks_done=total_chunks_processed,
                error=None,
                ocr_attempted=ocr_attempted,
                ocr_available=ocr_available,
            )
            print(f"[Job Complete] {job_id}: READY - {total_pages}/{total_pages} pages, {total_chunks_processed} chunks")
        else:
            # Determine error message based on what went wrong
            if pages_done == 0:
                error_msg = "All pages failed to process"
            elif total_chunks_processed == 0:
                # Check if OCR was attempted and failed
                failed_pages = [p for p in manifest.get("pages", []) if p.get("status") == "FAILED"]
                if failed_pages and ocr_attempted:
                    ocr_errors = [p.get("error", "") for p in failed_pages if "OCR" in p.get("error", "")]
                    if ocr_errors:
                        error_msg = f"OCR failed: {ocr_errors[0]}"
                    else:
                        error_msg = "No chunks created from processed pages"
                else:
                    error_msg = "No chunks created from OCR text"
            else:
                error_msg = "Job failed for unknown reason"
            
            set_manifest_status(manifest, "FAILED")
            save_manifest(tenant_id, policy_id, manifest)
            update_job_progress(
                job_id,
                status=JobStatus.FAILED,
                pages_total=total_pages,
                pages_done=total_pages if pages_done > 0 else pages_done,  # Show 100% if pages were processed
                chunks_total=total_chunks_processed,
                chunks_done=total_chunks_processed,
                error=error_msg,
                ocr_attempted=ocr_attempted,
                ocr_available=ocr_available,
            )
            print(f"[Job Failed] {job_id}: {error_msg} - {pages_done}/{total_pages} pages, {total_chunks_processed} chunks")

    except Exception as e:
        import traceback
        error_msg = str(e)
        print(f"[Job] ERROR in process_job({job_id}): {error_msg}")
        print(f"[Job] Traceback:\n{traceback.format_exc()}")

        try:
            job = load_job(job_id)
            ocr_available = job.get("ocrAvailable", False) if job else False
            update_job_progress(job_id, status=JobStatus.FAILED, error=error_msg, ocr_available=ocr_available)
        except Exception:
            try:
                update_job_progress(job_id, status=JobStatus.FAILED, error=f"Job failed: {error_msg}")
            except Exception:
                print(f"[Job] CRITICAL: Could not update job {job_id} status at all")


async def start_job_processing(job_id: str):
    """Start processing a job asynchronously"""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(executor, process_job, job_id)


def get_all_jobs(tenant_id: str | None = None) -> List[Dict[str, Any]]:
    """Get all jobs (optionally filtered by tenant)"""
    jobs_dir = Path(settings.data_dir) / "jobs"
    jobs: List[Dict[str, Any]] = []

    if not jobs_dir.exists():
        return jobs

    for job_file in jobs_dir.glob("*.json"):
        try:
            with open(job_file, "r") as f:
                job = json.load(f)
                if tenant_id is None or job.get("tenantId") == tenant_id:
                    jobs.append(job)
        except Exception:
            continue

    return jobs