# OCR Improvements for Table-Heavy Scanned PDFs

## Summary

This implementation adds OCR improvements for table-heavy scanned PDFs without breaking existing normal PDFs. All changes are behind feature flags and config options.

## Changes Implemented

### 1. Debug Logging ✅

**Location:** `app/ocr.py`

- Added `DEBUG_OCR` environment variable flag (default: `false`)
- Added debug logging in `extract_text_from_pdf_page()`:
  - Page index
  - Image size (width, height)
  - Image hash (MD5 of first 1MB of PNG bytes)
  - First 200 chars of OCR text preview

**Usage:**
```bash
export DEBUG_OCR=true
# Run policy-engine server
# Check logs for [DEBUG OCR] messages
```

### 2. Duplicate OCR Detection Safeguard ✅

**Location:** `app/jobs.py`

- Added `_detect_duplicate_ocr_pages()` function that:
  - Normalizes OCR text (lowercase, remove extra whitespace)
  - Computes MD5 hash for each page
  - Detects consecutive identical pages (threshold: 3)
  - Marks job as `FAILED` with clear error message

**Error Message:**
```
"OCR produced repeated pages; likely table/scanned issue; try table_ocr preset (found X consecutive identical pages)"
```

**When it triggers:**
- After all pages are OCR'd
- If ≥3 consecutive pages have identical normalized text
- Only for OCR'd pages (not extracted text)

### 3. OCR Presets ✅

**Location:** `app/ocr.py`, `app/config.py`, `app/jobs.py`

**Two presets:**

1. **`normal_ocr`** (default):
   - No special Tesseract config
   - No preprocessing
   - Existing behavior

2. **`table_ocr`**:
   - Tesseract config: `--psm 6 -c preserve_interword_spaces=1`
   - Preprocessing: grayscale, contrast enhancement, mild denoising

**Configuration:**
- Environment variable: `OCR_PRESET=normal_ocr|table_ocr` (default: `normal_ocr`)
- Per-job: `job.ocrPreset` field (inherits from config if not set)
- Stored in job manifest for audit

**Usage:**
```bash
# Set globally via env var
export OCR_PRESET=table_ocr

# Or set per-job (future API enhancement)
# Currently uses config/env default
```

### 4. Table OCR Preprocessing ✅

**Location:** `app/ocr.py` → `_preprocess_image_for_table()`

**Applied only when `preset="table_ocr"`:**

1. **Grayscale conversion**: Converts RGB to grayscale
2. **Contrast enhancement**: Enhances contrast by 20%
3. **Denoising**: Applies median filter (size 3)

**Fallback:** If numpy not available, only grayscale conversion is applied.

### 5. Debug Script ✅

**Location:** `app/scripts/ocr_debug.py`

**Usage:**
```bash
python -m app.scripts.ocr_debug <pdf_path> --preset table_ocr --pages 1,2,3
```

**Features:**
- Converts PDF pages to images
- Computes image hash per page
- Runs OCR with specified preset
- Saves debug images to `data/_debug/page_N_preset.png`
- Outputs:
  - Per-page image size
  - Per-page image hash
  - First 200 chars of OCR text
  - Duplicate detection summary

**Options:**
- `--preset`: `normal_ocr` or `table_ocr` (default: `normal_ocr`)
- `--pages`: Comma-separated page numbers (1-indexed), e.g., `1,2,3`
- `--dpi`: DPI for image conversion (default: 200)
- `--lang`: Tesseract language (default: `eng+ara`)

**Example:**
```bash
python -m app.scripts.ocr_debug /path/to/clinical_pathway.pdf --preset table_ocr --pages 1,2,3
```

## API Contract

**No breaking changes:**
- All existing API endpoints unchanged
- All response shapes unchanged
- Default behavior unchanged (`normal_ocr`)
- Preset selection is via config/env var (not API parameter yet)

## Database Schema

**No changes:** All metadata stored in job JSON files (existing structure).

## Testing

### Enable Debug Logging:
```bash
export DEBUG_OCR=true
# Run reprocess job
# Check logs for [DEBUG OCR] messages
```

### Test Duplicate Detection:
1. Upload a table-heavy PDF that produces duplicate OCR
2. Check job status → should be `FAILED`
3. Check `job.error` → should contain duplicate detection message

### Test Table OCR Preset:
```bash
export OCR_PRESET=table_ocr
# Run reprocess job
# Check logs for `preset=table_ocr`
# Verify improved OCR quality
```

### Use Debug Script:
```bash
cd policy-engine
python -m app.scripts.ocr_debug data/default/<policyId>/<filename>.pdf --preset table_ocr --pages 1,2,3
```

## Files Modified

1. `app/ocr.py`:
   - Added debug logging
   - Added `_get_tesseract_config()` for preset-based config
   - Added `_preprocess_image_for_table()` for table preprocessing
   - Added `_hash_image_bytes()` for debug hashing
   - Updated `extract_text_from_pdf_page()` to support presets

2. `app/jobs.py`:
   - Added duplicate detection functions
   - Added duplicate detection check after OCR
   - Added `ocrPreset` to job data
   - Updated `create_job()` to accept `ocr_preset` parameter
   - Updated OCR calls to use preset

3. `app/config.py`:
   - Added `ocr_preset` setting (reads from `OCR_PRESET` env var)

4. `app/scripts/ocr_debug.py` (new):
   - Command-line debug script

## Future Enhancements (Not Implemented)

- API endpoint parameter for preset selection (e.g., `POST /v1/policies/{id}/reprocess?preset=table_ocr`)
- Auto-detection of table vs normal PDFs
- More sophisticated preprocessing (e.g., OpenCV adaptive threshold)
- Per-policy preset storage in manifest

## Notes

- All changes are **backward compatible**
- Default behavior is unchanged (`normal_ocr`)
- Preset must be explicitly set via env var or future API enhancement
- Debug logging is opt-in (via `DEBUG_OCR` env var)
- Duplicate detection only runs if ≥3 OCR pages are processed
