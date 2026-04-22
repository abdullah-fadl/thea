# OpenAI Vision OCR Implementation

## Overview

This document describes the OpenAI Vision OCR implementation that extracts text from PDF pages using OpenAI's Vision API.

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# OCR Provider selection: "vision" | "tesseract" | "auto" (default: "auto")
OCR_PROVIDER=vision

# Vision OCR Model (default: "gpt-4o-mini")
# Note: "gpt-4.1-mini" doesn't exist, using "gpt-4o-mini" instead
VISION_OCR_MODEL=gpt-4o-mini

# Vision OCR Detail: "low" | "high" | "auto" (default: "high")
# - "low": Faster, lower cost, lower quality
# - "high": Slower, higher cost, better quality (recommended for documents)
VISION_OCR_DETAIL=high

# Maximum concurrency for Vision OCR (default: 2)
# Currently not used (processing is sequential), but available for future parallelization
VISION_OCR_MAX_CONCURRENCY=2
```

### Provider Selection Logic

1. **`OCR_PROVIDER=vision`**: Always use Vision OCR (requires OPENAI_API_KEY)
2. **`OCR_PROVIDER=tesseract`**: Always use Tesseract OCR (requires pytesseract/pdf2image)
3. **`OCR_PROVIDER=auto`** (default): 
   - Prefer Vision if OpenAI client available
   - Fallback to Tesseract if Vision unavailable
   - Fail if neither available

## Implementation Details

### 1. PDF Page Rendering

- Uses **PyMuPDF (fitz)** to render PDF pages to PNG images
- Default DPI: 225 (within requested 200-250 range)
- Converts to PIL Image format for processing

### 2. Vision OCR Function

**`vision_ocr_page(image_bytes, image, page_num, lang_hint)`**:
- Takes image (bytes or PIL Image)
- Converts to base64 data URL
- Calls OpenAI Vision API with:
  - Model from config (default: gpt-4o-mini)
  - Detail level from config (default: high)
  - Strict prompt to extract ALL text exactly as seen

**`vision_ocr_pdf_page(pdf_path, page_num, dpi, lang_hint)`**:
- Convenience function that combines rendering + OCR
- Renders PDF page to image
- Extracts text using Vision OCR

### 3. Prompt Design

The prompt includes:
- Extract ALL text exactly as it appears
- Preserve order and layout
- Keep headings, bullets, formatting
- Do NOT summarize or paraphrase
- **Safeguard**: "If text is unreadable, return empty string. Do NOT invent."

### 4. Integration with Existing Pipeline

In `app/jobs.py`, Vision OCR is integrated into the reprocess flow:

1. **OCR Provider Selection**:
   - Checks config (`OCR_PROVIDER`)
   - Checks availability (OpenAI client, Tesseract)
   - Selects appropriate provider

2. **Processing Flow**:
   - For `mode=ocr_only`: Uses selected provider
   - For `mode=full`: Uses selected provider if text extraction fails
   - For Tesseract: Uses hybrid OCR pipeline (with quality validation)
   - For Vision: Uses page-by-page Vision OCR

3. **Text Saving**:
   - Saves extracted text to `data/<tenant>/<policyId>/text/page_<n>.txt`
   - Same format as Tesseract OCR output

## Logging

### Normal Operation

```
[OCR] Provider: vision (config=vision, vision_available=True, tesseract_available=True)
[OCR] page=1 using Vision OCR
[VISION_OCR] start page=1 model=gpt-4o-mini detail=high
[VISION_OCR] page=1 extracted 1234 chars
[OCR] page=1 text_len=1234 provider=vision
```

### Debug Mode

Set `DEBUG_OCR=true` for detailed logs:
```
[VISION_OCR] start page=1 model=gpt-4o-mini detail=high
[VISION_OCR] response_id=chatcmpl-...
[VISION_OCR] tokens_used=1234
[VISION_OCR] page=1 extracted 1234 chars
```

### Error Handling

```
[OCR] page=1 EXCEPTION: OCR failed (vision): OpenAI Vision OCR failed for page 1: ...
[OCR] page=1 ERROR: OCR produced no text (provider=vision)
```

## Smoke Test Script

Test Vision OCR on a single page:

```bash
cd policy-engine
python -m app.scripts.vision_ocr_test <pdf_path> [page_num]

# Example:
python -m app.scripts.vision_ocr_test data/default/policy-id/file.pdf 1
python -m app.scripts.vision_ocr_test data/default/policy-id/file.pdf  # Test first page
```

The script will:
- Render the specified page
- Run Vision OCR
- Print extracted text length and preview
- Exit with code 0 on success, 1 on failure

## Dependencies

Add to `requirements.txt`:
```
PyMuPDF>=1.23.0
```

Install:
```bash
pip install PyMuPDF>=1.23.0
```

## Usage Examples

### Use Vision OCR for All OCR Operations

```bash
export OCR_PROVIDER=vision
export OPENAI_API_KEY=sk-...
cd policy-engine
uvicorn app.main:app --reload
```

Then upload a PDF or reprocess with `mode=ocr_only`.

### Use Tesseract (Legacy)

```bash
export OCR_PROVIDER=tesseract
# Tesseract and pdf2image must be installed
```

### Auto-Select (Default)

```bash
export OCR_PROVIDER=auto
# Will use Vision if OpenAI available, else Tesseract
```

## Performance

- **Rendering**: ~100-200ms per page (PyMuPDF)
- **Vision OCR**: ~2-5 seconds per page (depends on image size and detail level)
- **Total**: ~2.1-5.2 seconds per page

## Cost Considerations

Vision OCR uses OpenAI API tokens:
- **Input**: ~85 tokens per request (prompt)
- **Output**: Variable (depends on text length, ~4 tokens per word)
- **Image tokens**: Depends on image size and detail level
  - `detail=low`: ~85 tokens per image
  - `detail=high`: ~170 tokens per 512x512 tile (varies with image size)

For a typical document page:
- Total tokens: ~500-2000 tokens per page
- Cost: ~$0.001-0.004 per page (at gpt-4o-mini pricing)

## Limitations

1. **API Rate Limits**: OpenAI has rate limits (requests per minute)
2. **Token Limits**: max_tokens=4000 may truncate very long pages
3. **Cost**: More expensive than Tesseract (free)
4. **Speed**: Slower than Tesseract (network latency)

## Error Handling

- If OpenAI client unavailable → Job fails with clear error
- If API call fails → Page marked as FAILED, job continues
- If no text extracted → Page marked as FAILED (likely unreadable image)
- If rendering fails → Exception caught, page marked as FAILED

## Comparison: Vision OCR vs Tesseract

| Feature | Vision OCR | Tesseract |
|---------|-----------|-----------|
| Accuracy | High (especially for complex layouts) | Good (varies by document type) |
| Speed | 2-5s per page | 1-2s per page |
| Cost | Paid (OpenAI API) | Free |
| Dependencies | OpenAI API key | pytesseract, tesseract-ocr, poppler |
| Table Support | Excellent | Good (with preprocessing) |
| Handwritten Text | Good | Poor |
| Layout Preservation | Excellent | Good |

## Future Enhancements

1. **Parallel Processing**: Use `VISION_OCR_MAX_CONCURRENCY` to process multiple pages concurrently
2. **Caching**: Cache Vision OCR results to avoid re-processing
3. **Batch API**: If OpenAI releases batch Vision API, use for efficiency
4. **Hybrid Mode**: Use Vision for difficult pages, Tesseract for easy pages

