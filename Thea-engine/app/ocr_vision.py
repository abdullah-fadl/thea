"""
OpenAI Vision OCR implementation

Extracts text from PDF pages using OpenAI Vision API (Responses API with image input).
Uses pdf2image + poppler to render PDF pages before sending to Vision API.
"""
import os
import base64
import io
import subprocess
from pathlib import Path
from typing import Optional, Tuple
from PIL import Image

try:
    from pdf2image import convert_from_path
    PDF2IMAGE_AVAILABLE = True
except ImportError:
    PDF2IMAGE_AVAILABLE = False
    convert_from_path = None

from app.openai_client import get_openai_client
from app.config import settings

DEBUG_OCR = os.getenv("DEBUG_OCR", "false").lower() == "true"


def check_poppler_available() -> bool:
    """
    Check if poppler utilities (pdftoppm) are available in PATH
    
    Returns:
        True if poppler is available, False otherwise
    """
    try:
        result = subprocess.run(
            ['pdftoppm', '-v'],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.returncode == 0 or 'pdftoppm' in result.stderr or 'pdftoppm' in result.stdout
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def render_pdf_page_to_image(
    pdf_path: Path,
    page_num: int,
    dpi: int = 225
) -> Image.Image:
    """
    Render a single PDF page to PIL Image using pdf2image + poppler
    
    Args:
        pdf_path: Path to PDF file
        page_num: Page number (1-indexed)
        dpi: Target DPI (default: 225, between 200-250 as requested)
    
    Returns:
        PIL Image object
    
    Raises:
        ImportError: If pdf2image is not installed
        Exception: If poppler is not available or rendering fails
    """
    if not PDF2IMAGE_AVAILABLE:
        raise ImportError("pdf2image not installed - required for Vision OCR. Install with: python3 -m pip install pdf2image pillow")
    
    # Check if poppler is available
    if not check_poppler_available():
        raise Exception("Poppler (pdftoppm) not found in PATH. Install with: brew install poppler")
    
    try:
        # Convert specific page using pdf2image
        # Note: convert_from_path uses 0-indexed pages, so page_num - 1
        # first_page and last_page are both page_num - 1 to get only one page
        images = convert_from_path(
            str(pdf_path),
            first_page=page_num,
            last_page=page_num,
            dpi=dpi,
            fmt='png'
        )
        
        if not images or len(images) == 0:
            raise Exception(f"Failed to render page {page_num}: no image returned")
        
        # Return the first (and only) image
        return images[0]
    
    except Exception as e:
        error_msg = str(e)
        # Check for common poppler errors
        if 'pdftoppm' in error_msg.lower() or 'poppler' in error_msg.lower():
            raise Exception("Poppler (pdftoppm) not found or failed. Install with: brew install poppler")
        raise Exception(f"Failed to render PDF page {page_num} to image: {error_msg}")


def image_to_base64_data_url(image: Image.Image) -> str:
    """
    Convert PIL Image to base64 data URL
    
    Args:
        image: PIL Image object
    
    Returns:
        Base64 data URL string (data:image/png;base64,...)
    """
    # Convert to PNG bytes
    img_bytes = io.BytesIO()
    image.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    
    # Encode to base64
    img_base64 = base64.b64encode(img_bytes.read()).decode('utf-8')
    
    return f"data:image/png;base64,{img_base64}"


def vision_ocr_page(
    image_bytes: bytes | None = None,
    image: Image.Image | None = None,
    page_num: int = 1,
    lang_hint: str = "en"
) -> str:
    """
    Extract text from a page image using OpenAI Vision API
    
    Args:
        image_bytes: Image bytes (PNG format) - either this or image must be provided
        image: PIL Image object - either this or image_bytes must be provided
        page_num: Page number (for logging)
        lang_hint: Language hint (currently not used by Vision API, but kept for compatibility)
    
    Returns:
        Extracted plain text
    """
    openai_client = get_openai_client()
    if not openai_client:
        raise Exception("OpenAI client not available (OPENAI_API_KEY not configured)")
    
    # Get image
    if image is None:
        if image_bytes is None:
            raise ValueError("Either image_bytes or image must be provided")
        image = Image.open(io.BytesIO(image_bytes))
    
    # Convert image to base64 data URL
    image_data_url = image_to_base64_data_url(image)
    
    # Get model and detail from config
    model = settings.vision_ocr_model
    detail = settings.vision_ocr_detail
    
    # Build prompt with safeguard
    prompt = """Extract ALL text from this document page exactly as it appears.

CRITICAL INSTRUCTIONS:
- Extract EVERY word, number, and character you can see
- Preserve the exact order and layout
- Keep headings, bullets, and formatting indicators
- Do NOT summarize, paraphrase, or interpret
- Do NOT add explanations or comments
- If text is unreadable or unclear, return empty string
- Do NOT invent or hallucinate text that is not visible
- Output ONLY the extracted text, nothing else

Extract the text now:"""
    
    if DEBUG_OCR:
        print(f"[VISION_OCR] start page={page_num} model={model} detail={detail}")
    
    try:
        # Call OpenAI Vision API
        response = openai_client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_data_url,
                                "detail": detail,
                            },
                        },
                    ],
                }
            ],
            max_tokens=4000,
        )
        
        # Extract text from response
        extracted_text = response.choices[0].message.content or ""
        
        # Log response metadata if available
        if DEBUG_OCR:
            response_id = getattr(response, 'id', None)
            usage = getattr(response, 'usage', None)
            if response_id:
                print(f"[VISION_OCR] response_id={response_id}")
            if usage:
                tokens_used = getattr(usage, 'total_tokens', None)
                if tokens_used:
                    print(f"[VISION_OCR] tokens_used={tokens_used}")
            print(f"[VISION_OCR] page={page_num} extracted {len(extracted_text)} chars")
        
        return extracted_text
    
    except Exception as e:
        error_msg = f"OpenAI Vision OCR failed for page {page_num}: {str(e)}"
        print(f"[VISION_OCR] ERROR: {error_msg}")
        raise Exception(error_msg)


def vision_ocr_pdf_page(
    pdf_path: Path,
    page_num: int,
    dpi: int = 225,
    lang_hint: str = "en"
) -> str:
    """
    Extract text from a PDF page using OpenAI Vision OCR
    
    This is a convenience function that combines rendering and OCR
    
    Args:
        pdf_path: Path to PDF file
        page_num: Page number (1-indexed)
        dpi: DPI for rendering (default: 225)
        lang_hint: Language hint (for compatibility, not used by Vision API)
    
    Returns:
        Extracted plain text
    """
    # Render PDF page to image
    image = render_pdf_page_to_image(pdf_path, page_num, dpi)
    
    # Extract text using Vision OCR
    text = vision_ocr_page(image=image, page_num=page_num, lang_hint=lang_hint)
    
    return text

