"""Preview classification API - Content-based classification with OCR support"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from typing import List, Optional
import json
import tempfile
import asyncio
from pathlib import Path

from app.text_extract import extract_text_from_pdf
from app.file_types import detect_file_type
from app.text_extractors import (
    extract_text_from_txt,
    extract_text_from_docx,
    extract_text_from_xlsx,
    extract_text_from_xls,
    extract_text_from_pptx,
    extract_text_from_image,
)
from app.ocr_hybrid import extract_all_pages_hybrid
from app.ocr_vision import vision_ocr_pdf_page, render_pdf_page_to_image
from app.openai_client import get_openai_client
from app.config import settings

router = APIRouter()


@router.post("/v1/ingest/preview-classify")
async def preview_classify(
    files: List[UploadFile] = File(...),
    tenantId: Optional[str] = Form(None),
    country: Optional[str] = Form(None),
    sector: Optional[str] = Form(None)
):
    """
    Preview classification: Extract content (PDF text + OCR if needed) and classify
    
    CONTENT-BASED ONLY. No filename inference.
    
    Args:
        files: List of PDF files to classify
        tenantId: Optional tenant identifier
        country: Optional country hint (not used for classification, just context)
        sector: Optional sector hint (not used for classification, just context)
    
    Returns:
        List of classification results with status: PROCESSING | READY | BLOCKED
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    # Check if Vision OCR is available (requires OPENAI_API_KEY)
    openai_client = get_openai_client()
    vision_ocr_available = openai_client is not None
    
    # Check OCR provider setting
    ocr_provider = settings.ocr_provider or "vision"  # Default to vision
    if ocr_provider == "auto":
        ocr_provider = "vision" if vision_ocr_available else "none"
    elif ocr_provider == "vision" and not vision_ocr_available:
        # Vision requested but not available - will mark as OCR_DISABLED per file
        pass
    
    results = []
    
    for file in files:
        filename = file.filename or "unknown.pdf"
        
        # Read file content
        file_content = await file.read()
        if len(file_content) == 0:
            results.append({
                "filename": filename,
                "status": "BLOCKED",
                "error": {
                    "code": "EMPTY_FILE",
                    "message": "File is empty"
                },
                "contentSignals": {
                    "pdfTextExtracted": False,
                    "ocrUsed": False,
                    "ocrProvider": "none",
                    "pagesProcessed": 0,
                    "extractedChars": 0
                }
            })
            continue
        
        # Detect file type
        try:
            file_info = detect_file_type(filename, file.content_type)
        except ValueError as error:
            results.append({
                "filename": filename,
                "status": "BLOCKED",
                "error": {
                    "code": "UNSUPPORTED_TYPE",
                    "message": str(error)
                },
                "contentSignals": {
                    "pdfTextExtracted": False,
                    "ocrUsed": False,
                    "ocrProvider": "none",
                    "pagesProcessed": 0,
                    "extractedChars": 0
                }
            })
            continue

        # Save to temporary file for processing
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_info.extension}") as tmp_file:
            tmp_path = Path(tmp_file.name)
            tmp_file.write(file_content)
        
        try:
            # Non-PDF extraction path
            if file_info.file_type != "pdf":
                if file_info.file_type == "txt":
                    pages = extract_text_from_txt(tmp_path)
                elif file_info.file_type == "docx":
                    pages = extract_text_from_docx(tmp_path)
                elif file_info.file_type == "xlsx":
                    pages = extract_text_from_xlsx(tmp_path)
                elif file_info.file_type == "xls":
                    pages = extract_text_from_xls(tmp_path)
                elif file_info.file_type in ["ppt", "pptx"]:
                    pages = extract_text_from_pptx(tmp_path)
                elif file_info.file_type in ["jpg", "jpeg", "png"]:
                    pages = extract_text_from_image(tmp_path)
                else:
                    raise Exception(f"Unsupported file type: {file_info.file_type}")

                extracted_text = "\n\n".join([p[1] for p in pages if p[1]])
                extracted_chars = len(extracted_text)
                pages_processed = len(pages)
                pdf_text_extracted = False
                ocr_used = file_info.file_type in ["jpg", "jpeg", "png"]
                ocr_provider_used = "tesseract" if ocr_used else "none"
                pages_total = pages_processed
                pages_needing_ocr = []
            else:
                # Step 1: Try PDF text extraction
                pdf_text_extracted = False
                ocr_used = False
                ocr_provider_used = "none"
                pages_processed = 0
                pages_total = 0  # Initialize to ensure it's always defined
                extracted_text = ""
                extracted_chars = 0
                min_text_chars = 400  # Minimum chars from PDF text to skip OCR
                pages_needing_ocr = []  # Initialize to ensure it's always defined

                try:
                    pdf_text_pages = extract_text_from_pdf(tmp_path)
                    text_pages = []
                    pages_needing_ocr = []

                    # Calculate total pages from PDF extraction result
                    pages_total = len(pdf_text_pages)

                    # Debug logging
                    print(f"[Preview Classify] {filename}: pages_total={pages_total}, type={type(pages_total)}")

                    for page_num, page_text, needs_ocr in pdf_text_pages:
                        if needs_ocr or len(page_text.strip()) < 25:
                            pages_needing_ocr.append(int(page_num))  # Ensure page_num is int
                        else:
                            text_pages.append(page_text)
                            pdf_text_extracted = True

                    # Update pages_processed to total pages extracted
                    pages_processed = pages_total

                    # Debug logging
                    print(f"[Preview Classify] {filename}: pages_needing_ocr={pages_needing_ocr}, type={type(pages_needing_ocr)}")

                    # Combine PDF text
                    extracted_text = "\n\n".join(text_pages)
                    extracted_chars = len(extracted_text)

                except Exception as pdf_error:
                    # Check for specific PDF errors
                    error_str = str(pdf_error).lower()
                    if "encrypted" in error_str or "password" in error_str:
                        results.append({
                            "filename": filename,
                            "status": "BLOCKED",
                            "error": {
                                "code": "ENCRYPTED_PDF",
                                "message": "File is password-protected. Upload an unlocked version."
                            },
                            "contentSignals": {
                                "pdfTextExtracted": False,
                                "ocrUsed": False,
                                "ocrProvider": "none",
                                "pagesProcessed": 0,
                                "extractedChars": 0
                            }
                        })
                        try:
                            if tmp_path.exists():
                                tmp_path.unlink()
                        except:
                            pass
                        continue
                    elif "corrupt" in error_str or "damaged" in error_str or "invalid" in error_str:
                        results.append({
                            "filename": filename,
                            "status": "BLOCKED",
                            "error": {
                                "code": "CORRUPT_PDF",
                                "message": "PDF file is corrupted or damaged. Please re-upload a valid file."
                            },
                            "contentSignals": {
                                "pdfTextExtracted": False,
                                "ocrUsed": False,
                                "ocrProvider": "none",
                                "pagesProcessed": 0,
                                "extractedChars": 0
                            }
                        })
                        try:
                            if tmp_path.exists():
                                tmp_path.unlink()
                        except:
                            pass
                        continue
                    else:
                        # Other PDF errors - will try OCR if available
                        print(f"[Preview Classify] PDF text extraction failed for {filename}: {pdf_error}")
                        # When PDF extraction fails, we don't know total pages, so use default preview pages
                        pages_needing_ocr = [1, 2]  # Try first 2 pages for OCR
                        pages_total = 2  # Assume at least 2 pages for preview
                        pages_processed = 0  # Reset since extraction failed
                        extracted_text = ""
                        extracted_chars = 0
            
            # Step 2: If extracted text is insufficient, use Vision OCR (PDF only)
            if file_info.file_type == "pdf" and extracted_chars < min_text_chars and (pages_needing_ocr or not pdf_text_extracted):
                # Check if Vision OCR is available
                if ocr_provider == "vision" and not vision_ocr_available:
                    # Vision OCR requested but not available
                    results.append({
                        "filename": filename,
                        "status": "BLOCKED",
                        "error": {
                            "code": "OCR_DISABLED",
                            "message": "Vision OCR is not enabled. Add OPENAI_API_KEY to policy-engine."
                        },
                        "contentSignals": {
                            "pdfTextExtracted": pdf_text_extracted,
                            "ocrUsed": False,
                            "ocrProvider": "none",
                            "pagesProcessed": pages_processed,
                            "extractedChars": extracted_chars
                        }
                    })
                    try:
                        if tmp_path.exists():
                            tmp_path.unlink()
                    except:
                        pass
                    continue
                
                # Normalize pages for OCR processing
                # Ensure pages_total is always int
                if pages_total == 0 or pages_total is None:
                    # If pages_total wasn't set properly (PDF extraction failed), try to determine it
                    try:
                        from PyPDF2 import PdfReader
                        with open(tmp_path, "rb") as f:
                            reader = PdfReader(f)
                            pages_total = len(reader.pages)
                    except Exception as e:
                        print(f"[Preview Classify] Could not determine pages_total, using fallback: {e}")
                        pages_total = 2  # Fallback to 2 for preview
                
                pages_total = int(pages_total)  # Ensure it's an int
                preview_limit = 2  # Maximum pages to process for preview
                
                # Normalize pages_needing_ocr - ensure it's always a list of ints
                if not pages_needing_ocr:
                    # No pages need OCR - but if we're here, we need to process some
                    pages_to_process = list(range(1, min(pages_total, preview_limit) + 1))
                else:
                    # Take first preview_limit pages from pages_needing_ocr
                    pages_to_process = [int(p) for p in pages_needing_ocr[:preview_limit]]
                
                # Debug logging
                print(f"[Preview Classify] {filename}: pages_total={pages_total}, type={type(pages_total)}")
                print(f"[Preview Classify] {filename}: pages_needing_ocr={pages_needing_ocr}, type={type(pages_needing_ocr)}")
                print(f"[Preview Classify] {filename}: pages_to_process={pages_to_process}, type={type(pages_to_process)}")
                
                # Validate pages_total
                if pages_total < 1:
                    results.append({
                        "filename": filename,
                        "status": "BLOCKED",
                        "error": {
                            "code": "INVALID_PDF",
                            "message": "PDF has no pages or is invalid."
                        },
                        "contentSignals": {
                            "pdfTextExtracted": pdf_text_extracted,
                            "ocrUsed": False,
                            "ocrProvider": "none",
                            "pagesProcessed": 0,
                            "extractedChars": extracted_chars
                        }
                    })
                    try:
                        if tmp_path.exists():
                            tmp_path.unlink()
                    except:
                        pass
                    continue
                
                # Use pages_to_process (normalized list of page numbers)
                preview_pages = pages_to_process
                
                try:
                    ocr_text_pages = []
                    ocr_disabled_detected = False
                    ocr_deps_error = None
                    for page_num in preview_pages:
                        if ocr_disabled_detected or ocr_deps_error:
                            break
                        try:
                            if ocr_provider == "vision":
                                # Use Vision OCR
                                ocr_text = vision_ocr_pdf_page(
                                    tmp_path,
                                    page_num=page_num,
                                    dpi=225,
                                    lang_hint="en"
                                )
                                if ocr_text and len(ocr_text.strip()) > 0:
                                    ocr_text_pages.append(ocr_text)
                                    ocr_used = True
                                    ocr_provider_used = "vision"
                                    # Update pages_processed to highest page number processed
                                    pages_processed = max(pages_processed, int(page_num))
                        except Exception as page_error:
                            error_str = str(page_error).lower()
                            if "openai" in error_str or "api key" in error_str:
                                # OCR provider error - mark flag and break outer loop will handle it
                                ocr_disabled_detected = True
                                break
                            elif "pdf2image" in error_str or "not installed" in error_str:
                                # Missing pdf2image dependency
                                ocr_deps_error = {
                                    "code": "OCR_DEPS_MISSING",
                                    "message": "pdf2image is not installed. Install in venv: cd policy-engine && source .venv/bin/activate && python -m pip install pdf2image pillow"
                                }
                                break
                            elif "poppler" in error_str or "pdftoppm" in error_str:
                                # Missing poppler dependency
                                ocr_deps_error = {
                                    "code": "POPPLER_MISSING",
                                    "message": "Poppler (pdftoppm) not found. Install with: brew install poppler"
                                }
                                break
                            else:
                                print(f"[Preview Classify] Vision OCR failed for page {page_num} of {filename}: {page_error}")
                    
                    # If OCR deps error detected during page loop, mark as BLOCKED
                    if ocr_deps_error:
                        results.append({
                            "filename": filename,
                            "status": "BLOCKED",
                            "error": ocr_deps_error,
                            "contentSignals": {
                                "pdfTextExtracted": pdf_text_extracted,
                                "ocrUsed": False,
                                "ocrProvider": "none",
                                "pagesProcessed": pages_processed,
                                "extractedChars": extracted_chars
                            }
                        })
                        try:
                            if tmp_path.exists():
                                tmp_path.unlink()
                        except:
                            pass
                        continue
                    
                    # If OCR disabled detected during page loop, mark as BLOCKED
                    if ocr_disabled_detected:
                        results.append({
                            "filename": filename,
                            "status": "BLOCKED",
                            "error": {
                                "code": "OCR_DISABLED",
                                "message": "Vision OCR is not enabled. Add OPENAI_API_KEY to policy-engine."
                            },
                            "contentSignals": {
                                "pdfTextExtracted": pdf_text_extracted,
                                "ocrUsed": False,
                                "ocrProvider": "none",
                                "pagesProcessed": pages_processed,
                                "extractedChars": extracted_chars
                            }
                        })
                        try:
                            if tmp_path.exists():
                                tmp_path.unlink()
                        except:
                            pass
                        continue
                    
                    # Combine OCR text with PDF text
                    if ocr_text_pages:
                        ocr_text_combined = "\n\n".join(ocr_text_pages)
                        extracted_text = (extracted_text + "\n\n" + ocr_text_combined).strip()
                        extracted_chars = len(extracted_text)
                except Exception as ocr_error:
                    error_str = str(ocr_error).lower()
                    if "openai" in error_str or "api key" in error_str:
                        results.append({
                            "filename": filename,
                            "status": "BLOCKED",
                            "error": {
                                "code": "OCR_DISABLED",
                                "message": "Vision OCR is not enabled. Add OPENAI_API_KEY to policy-engine."
                            },
                            "contentSignals": {
                                "pdfTextExtracted": pdf_text_extracted,
                                "ocrUsed": False,
                                "ocrProvider": "none",
                                "pagesProcessed": pages_processed,
                                "extractedChars": extracted_chars
                            }
                        })
                        try:
                            if tmp_path.exists():
                                tmp_path.unlink()
                        except:
                            pass
                        continue
                    else:
                        print(f"[Preview Classify] Vision OCR failed for {filename}: {ocr_error}")
                        # Mark as OCR_FAILED if we have no text at all
                        if extracted_chars == 0:
                            results.append({
                                "filename": filename,
                                "status": "BLOCKED",
                                "error": {
                                    "code": "OCR_FAILED",
                                    "message": "OCR provider failed. Retry."
                                },
                                "contentSignals": {
                                    "pdfTextExtracted": pdf_text_extracted,
                                    "ocrUsed": False,
                                    "ocrProvider": ocr_provider_used,
                                    "pagesProcessed": pages_processed,
                                    "extractedChars": extracted_chars
                                }
                            })
                            try:
                                if tmp_path.exists():
                                    tmp_path.unlink()
                            except:
                                pass
                            continue
            
            # Limit extracted text to 4000 chars for fast preview
            if len(extracted_text) > 4000:
                extracted_text = extracted_text[:4000]
                extracted_chars = 4000
            
            # CRITICAL: If no readable content extracted, mark as BLOCKED
            if len(extracted_text.strip()) < 50:
                print(f"[Preview Classify] ⚠️ No readable content extracted for {filename} (text length: {len(extracted_text)})")
                results.append({
                    "filename": filename,
                    "status": "BLOCKED",
                    "error": {
                        "code": "CONTENT_UNREADABLE",
                        "message": "Content cannot be extracted from this file. The file may be encrypted, corrupted, or image-only without OCR capability."
                    },
                    "contentSignals": {
                        "pdfTextExtracted": pdf_text_extracted,
                        "ocrUsed": ocr_used,
                        "ocrProvider": ocr_provider_used,
                        "pagesProcessed": pages_processed,
                        "extractedChars": extracted_chars
                    }
                })
                # Clean up and continue to next file
                try:
                    if tmp_path.exists():
                        tmp_path.unlink()
                except:
                    pass
                continue
            
            # Step 3: AI Classification (CONTENT-BASED ONLY - no filename)
            # Use ONLY extracted content, never filename
            # DO NOT include filename in prompt at all
            
            # Ensure we have OpenAI client for classification
            if not openai_client:
                results.append({
                    "filename": filename,
                    "status": "READY",
                    "suggestions": {
                        "entityType": {"value": "policy", "confidence": 0.4},
                        "scope": {"value": "enterprise", "confidence": 0.4},
                        "sector": {"value": "other", "confidence": 0.4},
                        "departments": [],
                        "classification": {}
                    },
                    "overallConfidence": 0.4,
                    "contentSignals": {
                        "pdfTextExtracted": pdf_text_extracted,
                        "ocrUsed": ocr_used,
                        "ocrProvider": ocr_provider_used,
                        "pagesProcessed": pages_processed,
                        "extractedChars": extracted_chars
                    }
                })
                try:
                    if tmp_path.exists():
                        tmp_path.unlink()
                except:
                    pass
                continue
            
            # Create comprehensive classification prompt (NO filename references)
            prompt = f"""Analyze this policy document and provide comprehensive classification based ONLY on the document content below.

Document Content:
{extracted_text}

CRITICAL INSTRUCTIONS:
- Classify based ONLY on the content above
- Do NOT use filename, file path, or any other metadata
- If content is insufficient or unclear, use lower confidence scores (< 0.6)

Please classify this document and return JSON with:
1. **entityType**: One of: "policy", "sop", "workflow", "playbook", "manual", "other" - based on document type
2. **scope**: One of: "department", "shared", "enterprise" - based on who it applies to
3. **sector**: One of: "healthcare", "manufacturing", "banking", "finance", "other" - based on industry
4. **departments**: List relevant departments (max 5) with names and confidence scores
5. **operations**: List relevant operations/processes (max 5) if mentioned
6. **function**: Functional area (e.g., "HR", "Finance", "Operations", "Compliance") if clear
7. **riskDomains**: List risk domains (e.g., "Data Privacy", "Safety", "Regulatory Compliance") if mentioned

Return JSON format:
{{
  "entityType": {{"value": "sop", "confidence": 0.85}},
  "scope": {{"value": "department", "confidence": 0.8}},
  "sector": {{"value": "healthcare", "confidence": 0.9}},
  "departments": [
    {{"name": "Intensive Care Unit", "confidence": 0.9}},
    {{"name": "Emergency", "confidence": 0.7}}
  ],
  "operations": [
    {{"name": "Patient Admission", "confidence": 0.8}}
  ],
  "function": {{"value": "Clinical", "confidence": 0.85}},
  "riskDomains": [
    {{"name": "Patient Safety", "confidence": 0.9}}
  ]
}}

Guidelines:
- Base classification ONLY on document content (never on filename or metadata)
- For healthcare documents, sector should be "healthcare"
- Entity type: "sop" for procedures/protocols, "workflow" for process flows, "policy" for general policies
- Scope: "department" if specific to one department, "shared" if multiple, "enterprise" if hospital-wide
- Only include departments/operations/riskDomains if there's clear evidence in the content
- Provide confidence scores (0.0-1.0) for each suggestion
- If content is unclear or insufficient, use lower confidence scores (< 0.6)
- If you cannot determine classification from content alone, use "other" for entityType with low confidence
"""
            
            # Call OpenAI (sync client, run in thread to avoid blocking)
            response = await asyncio.to_thread(
                openai_client.chat.completions.create,
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a healthcare policy classification expert. Analyze documents and return only valid JSON with classification results."
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                response_format={"type": "json_object"},
                max_tokens=1000,
            )
            
            result_text = response.choices[0].message.content
            if not result_text:
                raise HTTPException(status_code=500, detail="Empty response from AI")
            
            # Parse AI response
            try:
                ai_result = json.loads(result_text)
            except json.JSONDecodeError as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Invalid JSON response from AI: {str(e)}"
                )
            
            # Build suggestions object
            suggestions = {}
            
            if "entityType" in ai_result and isinstance(ai_result["entityType"], dict):
                suggestions["entityType"] = {
                    "value": ai_result["entityType"].get("value", "policy"),
                    "confidence": float(ai_result["entityType"].get("confidence", 0.5))
                }
            
            if "scope" in ai_result and isinstance(ai_result["scope"], dict):
                suggestions["scope"] = {
                    "value": ai_result["scope"].get("value", "department"),
                    "confidence": float(ai_result["scope"].get("confidence", 0.5))
                }
            
            if "sector" in ai_result and isinstance(ai_result["sector"], dict):
                suggestions["sector"] = {
                    "value": ai_result["sector"].get("value", "healthcare"),
                    "confidence": float(ai_result["sector"].get("confidence", 0.5))
                }
            
            # Departments
            departments = []
            if "departments" in ai_result and isinstance(ai_result["departments"], list):
                for dept in ai_result["departments"][:5]:
                    if isinstance(dept, dict) and "name" in dept:
                        departments.append({
                            "name": dept["name"],
                            "confidence": float(dept.get("confidence", 0.5))
                        })
            suggestions["departments"] = departments
            
            # Operations
            operations = []
            if "operations" in ai_result and isinstance(ai_result["operations"], list):
                for op in ai_result["operations"][:5]:
                    if isinstance(op, dict) and "name" in op:
                        operations.append({
                            "name": op["name"],
                            "confidence": float(op.get("confidence", 0.5))
                        })
            suggestions["operations"] = operations
            
            # Function
            if "function" in ai_result and isinstance(ai_result["function"], dict):
                suggestions["function"] = {
                    "value": ai_result["function"].get("value"),
                    "confidence": float(ai_result["function"].get("confidence", 0.5))
                }
            
            # Risk Domains
            risk_domains = []
            if "riskDomains" in ai_result and isinstance(ai_result["riskDomains"], list):
                for rd in ai_result["riskDomains"][:5]:
                    if isinstance(rd, dict) and "name" in rd:
                        risk_domains.append({
                            "name": rd["name"],
                            "confidence": float(rd.get("confidence", 0.5))
                        })
            suggestions["riskDomains"] = risk_domains
            
            # Calculate overall confidence
            confidences = []
            if "entityType" in suggestions:
                confidences.append(suggestions["entityType"]["confidence"])
            if "scope" in suggestions:
                confidences.append(suggestions["scope"]["confidence"])
            if "sector" in suggestions:
                confidences.append(suggestions["sector"]["confidence"])
            for dept in departments:
                confidences.append(dept["confidence"])
            
            overall_confidence = sum(confidences) / len(confidences) if confidences else 0.5
            
            # Status: READY if we have suggestions, BLOCKED otherwise
            status = "READY" if suggestions and overall_confidence > 0.3 else "BLOCKED"
            
            results.append({
                "filename": filename,
                "status": status,
                "contentSignals": {
                    "pdfTextExtracted": pdf_text_extracted,
                    "ocrUsed": ocr_used,
                    "ocrProvider": ocr_provider_used,
                    "pagesProcessed": pages_processed,
                    "extractedChars": extracted_chars
                },
                "extractedSnippet": extracted_text[:200] if extracted_text else None,
                "suggestions": suggestions if status == "READY" else None,
                "confidence": overall_confidence if status == "READY" else 0,
                "overallConfidence": overall_confidence if status == "READY" else 0
            })
        
        except Exception as e:
            print(f"[Preview Classify] Error processing {filename}: {e}")
            results.append({
                "filename": filename,
                "status": "BLOCKED",
                "error": {
                    "code": "PROCESSING_ERROR",
                    "message": f"Failed to process file: {str(e)}"
                },
                "contentSignals": {
                    "pdfTextExtracted": False,
                    "ocrUsed": False,
                    "ocrProvider": "none",
                    "pagesProcessed": 0,
                    "extractedChars": 0
                }
            })
        
        finally:
            # Clean up temporary file
            try:
                if tmp_path.exists():
                    tmp_path.unlink()
            except:
                pass
    
    return {
        "results": results,
        "tenantId": tenantId
    }
