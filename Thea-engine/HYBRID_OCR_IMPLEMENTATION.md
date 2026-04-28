# Hybrid OCR Pipeline Implementation

## Overview

This document describes the fully automatic hybrid OCR pipeline that processes any uploaded PDF or image without manual intervention.

## Architecture

### Stage 1: Tesseract OCR (Default)

1. **Preprocessing**:
   - Grayscale conversion
   - Adaptive threshold (using OpenCV)
   - Deskew (automatic text straightening)
   - Denoising

2. **OCR Execution**:
   - Uses pytesseract with optimized config (OEM 3, PSM 6)
   - Supports English + Arabic (eng+ara)
   - Extracts text from all pages

### Stage 2: Quality Validation

After Tesseract OCR, the system automatically validates quality:

1. **Repeated Header Detection**: Checks if >50% of pages have similar headers (>85% similarity)
2. **Low Unique Token Ratio**: Detects pages with <30% unique tokens (duplicate content)
3. **Consecutive Duplicate Pages**: Detects 2+ consecutive identical pages
4. **Table-Heavy Layout Detection**: Identifies pages with many short lines (60%+) and few long lines (<20%)
5. **Meaningful Content Check**: Ensures sufficient words and alphanumeric characters

### Stage 3: GPT-4.1 Vision Fallback (Automatic)

If ANY quality check fails, the system automatically:

1. Converts all pages to images
2. Sends to OpenAI GPT-4.1 Vision API
3. Uses strict prompt to extract ALL text:
   - Ignore repeated headers/footers
   - Preserve table structures
   - Output clean plain text
   - No summaries or paraphrasing

## Document Type Auto-Detection

The system automatically classifies documents based on:
- OCR quality metrics
- Page similarity patterns
- Table density (via line analysis)
- Layout characteristics

Classification types:
- `normal_text`: Standard text documents
- `scanned_text`: Scanned documents requiring OCR
- `table_heavy`: Documents with many tables
- `clinical_pathway`: Flowcharts/diagrams
- `form`: Forms/checklists

## Clean Indexing Rules

### Duplicate Header Removal

1. Detects repeated headers across pages (similarity >80%)
2. Removes header lines from all pages
3. Preserves unique page content

### Page Number & Title Removal

- Removes common page number patterns (Page 1, 1/10, - 1 -)
- Removes very short lines at start/end (likely titles)
- Preserves document structure

### Meaningful Chunk Filtering

Chunks must meet minimum quality criteria:
- Minimum 100 characters
- Minimum 10 words
- At least 50% alphanumeric characters

Chunks that don't meet criteria are filtered out.

## Integration Points

### Job Processing (`app/jobs.py`)

1. Detects if any pages need OCR
2. If yes, uses `extract_all_pages_hybrid()` for batch processing
3. Quality validation happens automatically
4. GPT-4 Vision fallback happens automatically if needed
5. Text is saved page-by-page
6. Enhanced chunking removes duplicates and ensures quality

### Enhanced Chunking (`app/chunking_enhanced.py`)

1. `build_clean_chunks_from_pages()`:
   - Removes repeated headers
   - Cleans page numbers and titles
   - Filters trivial chunks
   - Ensures meaningful chunks

## Configuration

### Environment Variables

- `OPENAI_API_KEY`: Required for GPT-4 Vision fallback
- `DEBUG_OCR`: Set to "true" for detailed OCR logs
- `OCR_PRESET`: No longer used (automatic detection)

### Dependencies

- `opencv-python>=4.8.0`: For advanced image preprocessing
- `openai>=1.0.0`: For GPT-4 Vision API
- `pytesseract`: For Tesseract OCR
- `pdf2image`: For PDF to image conversion

## User Experience

### Upload → Process → Searchable

1. **Upload**: User uploads any PDF/image
2. **Automatic Processing**:
   - System detects document type
   - Runs Tesseract OCR with preprocessing
   - Validates quality
   - Uses GPT-4 Vision if needed (fully automatic)
   - Removes duplicate headers
   - Creates clean, meaningful chunks
3. **Result**: Document is searchable with no manual intervention

### Status Guarantees

- After upload, policy ends in:
  - `status = READY`
  - `indexStatus = INDEXED`
- Policies page auto-refreshes (polling)
- User never needs to refresh manually

## Error Handling

If any step fails:
1. Detailed error logged with exact reason
2. Job status set to FAILED
3. Error message stored in job.error
4. UI displays error clearly

## Performance

- Tesseract OCR: ~1-2 seconds per page
- GPT-4 Vision: ~2-5 seconds per page
- Quality validation: <100ms for entire document
- Chunking: ~50ms per page

## Future Enhancements

- Caching of GPT-4 Vision results
- Batch GPT-4 Vision API calls (if supported)
- Incremental quality improvements based on feedback

