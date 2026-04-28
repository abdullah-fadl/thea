"""
Hybrid OCR Pipeline with Quality Validation and GPT-4.1 Vision Fallback

Stage 1: Tesseract OCR with preprocessing
Stage 2: GPT-4.1 Vision fallback for failed quality checks

This module implements automatic OCR that works for any document type:
- Normal text documents
- Scanned documents
- Table-heavy documents
- Clinical pathways
- Forms/checklists
"""
import os
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional, TYPE_CHECKING
from PIL import Image
import hashlib
import re

try:
    import pytesseract
except ImportError:
    pytesseract = None

try:
    from pdf2image import convert_from_path
except ImportError:
    convert_from_path = None

try:
    import cv2
    import numpy as np
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False
    np = None
    cv2 = None

# For type hints only
if TYPE_CHECKING:
    import numpy as np

from app.openai_client import get_openai_client
from app.config import settings

DEBUG_OCR = os.getenv("DEBUG_OCR", "false").lower() == "true"


def preprocess_image_for_ocr(image: Image.Image) -> Image.Image:
    """
    Preprocess image for OCR: grayscale, adaptive threshold, deskew
    
    This is Stage 1 preprocessing - always applied for Tesseract OCR
    
    Args:
        image: PIL Image object
    
    Returns:
        Preprocessed PIL Image object
    """
    try:
        # Convert to grayscale if not already
        if image.mode != 'L':
            image = image.convert('L')
        
        if not OPENCV_AVAILABLE:
            # Fallback to PIL-only preprocessing
            from PIL import ImageEnhance, ImageFilter
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(1.2)
            image = image.filter(ImageFilter.MedianFilter(size=3))
            return image
        
        # Use OpenCV for better preprocessing
        # Convert PIL to numpy array
        img_array = np.array(image)
        
        # Apply adaptive threshold
        img_thresh = cv2.adaptiveThreshold(
            img_array, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 11, 2
        )
        
        # Deskew (straighten rotated text)
        try:
            img_deskewed = deskew_image(img_thresh)
        except Exception as e:
            if DEBUG_OCR:
                print(f"[OCR Preprocess] Deskew failed: {e}, using original")
            img_deskewed = img_thresh
        
        # Convert back to PIL Image
        image = Image.fromarray(img_deskewed)
        
        return image
    
    except Exception as e:
        if DEBUG_OCR:
            print(f"[OCR Preprocess] Preprocessing failed: {e}, returning original")
        # Return grayscale version as fallback
        if image.mode != 'L':
            return image.convert('L')
        return image


def deskew_image(image_array: "np.ndarray") -> "np.ndarray":
    """
    Deskew (straighten) rotated text in image
    
    Args:
        image_array: Grayscale image as numpy array
    
    Returns:
        Deskewed image array
    """
    if not OPENCV_AVAILABLE:
        return image_array
    
    try:
        # Find angle using HoughLines
        # Apply edge detection
        edges = cv2.Canny(image_array, 50, 150, apertureSize=3)
        lines = cv2.HoughLines(edges, 1, np.pi / 180, 100)
        
        if lines is None or len(lines) == 0:
            return image_array  # No lines found, return original
        
        # Calculate angles
        angles = []
        for rho, theta in lines[:20]:  # Use first 20 lines
            angle = theta * 180 / np.pi - 90
            if -45 < angle < 45:
                angles.append(angle)
        
        if not angles:
            return image_array
        
        # Get median angle (more robust than mean)
        median_angle = np.median(angles)
        
        # If angle is very small, skip deskewing
        if abs(median_angle) < 0.5:
            return image_array
        
        # Rotate image to correct angle
        (h, w) = image_array.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
        rotated = cv2.warpAffine(image_array, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        
        return rotated
    
    except Exception as e:
        if DEBUG_OCR:
            print(f"[OCR Deskew] Failed: {e}")
        return image_array


def extract_text_with_tesseract(image: Image.Image, lang: str = "eng+ara") -> str:
    """
    Extract text using Tesseract OCR (Stage 1)
    
    Args:
        image: Preprocessed PIL Image
        lang: Tesseract language code
    
    Returns:
        Extracted text
    """
    if pytesseract is None:
        raise ImportError("pytesseract not installed")
    
    try:
        # Use OEM 3 (default, assume both), PSM 6 (single uniform block) or auto
        # PSM 6 works well for most documents including tables
        config = "--oem 3 --psm 6"
        text = pytesseract.image_to_string(image, lang=lang, config=config)
        return text
    except Exception as e:
        raise Exception(f"Tesseract OCR failed: {str(e)}")


def validate_ocr_quality(text_pages: List[str], page_numbers: List[int]) -> Tuple[bool, List[str]]:
    """
    Validate OCR quality and detect common issues
    
    Returns:
        (is_valid, issues) tuple
        is_valid: False if quality checks fail (should use GPT-4 Vision)
        issues: List of detected quality issues
    """
    if not text_pages:
        return False, ["No text extracted"]
    
    issues = []
    
    # Check 1: Detect repeated headers (similarity > 85% across pages)
    if len(text_pages) >= 2:
        # Normalize first 5 lines of each page (header area)
        header_texts = []
        for page_text in text_pages:
            lines = page_text.splitlines()[:5]
            header = ' '.join(lines).lower().strip()
            # Remove extra whitespace
            header = re.sub(r'\s+', ' ', header)
            if len(header) > 20:  # Only check substantial headers
                header_texts.append(header)
        
        if len(header_texts) >= 2:
            # Calculate similarity between consecutive headers
            similar_count = 0
            for i in range(len(header_texts) - 1):
                similarity = _text_similarity(header_texts[i], header_texts[i + 1])
                if similarity > 0.85:
                    similar_count += 1
            
            if similar_count >= len(header_texts) * 0.5:  # More than 50% similar
                issues.append(f"Repeated headers detected ({similar_count}/{len(header_texts) - 1} pairs similar >85%)")
    
    # Check 2: Detect very low unique-token ratio (duplicate content)
    for i, page_text in enumerate(text_pages):
        if len(page_text.strip()) < 50:
            continue  # Skip very short pages
        
        tokens = page_text.lower().split()
        if len(tokens) < 10:
            continue
        
        unique_tokens = set(tokens)
        unique_ratio = len(unique_tokens) / len(tokens)
        
        if unique_ratio < 0.3:  # Less than 30% unique tokens
            issues.append(f"Page {page_numbers[i] if i < len(page_numbers) else i+1}: Low unique token ratio ({unique_ratio:.2%})")
    
    # Check 3: Detect pages with mostly same text (consecutive duplicates)
    if len(text_pages) >= 3:
        page_hashes = [_text_hash(text) for text in text_pages]
        consecutive_duplicates = 0
        for i in range(len(page_hashes) - 1):
            if page_hashes[i] == page_hashes[i + 1]:
                consecutive_duplicates += 1
        
        if consecutive_duplicates >= 2:
            issues.append(f"Consecutive duplicate pages detected ({consecutive_duplicates} pairs)")
    
    # Check 4: Detect table-heavy layouts (many short lines, few long lines)
    for i, page_text in enumerate(text_pages):
        if len(page_text.strip()) < 100:
            continue
        
        lines = [line.strip() for line in page_text.splitlines() if line.strip()]
        if len(lines) < 10:
            continue
        
        # Table pages have many short lines
        short_lines = sum(1 for line in lines if 5 <= len(line) <= 60)
        short_line_ratio = short_lines / len(lines)
        
        # Table pages also have few very long lines (most content is in short rows)
        long_lines = sum(1 for line in lines if len(line) > 100)
        long_line_ratio = long_lines / len(lines)
        
        if short_line_ratio > 0.6 and long_line_ratio < 0.2:
            issues.append(f"Page {page_numbers[i] if i < len(page_numbers) else i+1}: Table-heavy layout detected")
    
    # Check 5: Check for "no meaningful content" (mostly whitespace or special chars)
    for i, page_text in enumerate(text_pages):
        if len(page_text.strip()) < 20:
            continue
        
        # Check if text has reasonable word-to-char ratio
        words = re.findall(r'\b\w+\b', page_text)
        if len(words) < 5:
            issues.append(f"Page {page_numbers[i] if i < len(page_numbers) else i+1}: Very few words extracted")
    
    # If any issues found, OCR quality is questionable
    is_valid = len(issues) == 0
    
    return is_valid, issues


def _text_similarity(text1: str, text2: str) -> float:
    """Calculate similarity ratio between two texts (0.0 to 1.0)"""
    if not text1 or not text2:
        return 0.0
    
    # Normalize
    t1 = re.sub(r'\s+', ' ', text1.lower().strip())
    t2 = re.sub(r'\s+', ' ', text2.lower().strip())
    
    if t1 == t2:
        return 1.0
    
    # Use simple word overlap ratio
    words1 = set(t1.split())
    words2 = set(t2.split())
    
    if not words1 or not words2:
        return 0.0
    
    intersection = words1 & words2
    union = words1 | words2
    
    return len(intersection) / len(union) if union else 0.0


def _text_hash(text: str) -> str:
    """Compute hash of normalized text for duplicate detection"""
    normalized = re.sub(r'\s+', ' ', text.lower().strip())
    return hashlib.md5(normalized.encode('utf-8')).hexdigest()


def extract_text_with_gpt4_vision(image: Image.Image, page_num: int) -> str:
    """
    Extract text using GPT-4.1 Vision API (Stage 2 fallback)
    
    Args:
        image: PIL Image object
        page_num: Page number (for logging)
    
    Returns:
        Extracted text
    """
    openai_client = get_openai_client()
    if not openai_client:
        raise Exception("OpenAI client not available (OPENAI_API_KEY not configured)")
    
    try:
        # Convert PIL Image to base64
        import base64
        import io
        
        # Save image to bytes
        img_bytes = io.BytesIO()
        image.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        image_b64 = base64.b64encode(img_bytes.read()).decode('utf-8')
        
        # Prepare prompt
        prompt = """Extract ALL readable text from this document page. 

CRITICAL INSTRUCTIONS:
- Extract EVERY word and number you can see
- Preserve table structures (rows and columns)
- Ignore repeated headers/footers (if they appear on every page, skip them)
- Output clean plain text, one line per row for tables
- Do NOT summarize or paraphrase
- Do NOT add explanations or comments
- Include ALL text exactly as it appears
- For tables: preserve column alignment using spaces or tabs
- Output ONLY the extracted text, nothing else"""

        # Call GPT-4 Vision API
        response = openai_client.chat.completions.create(
            model="gpt-4o",  # GPT-4.1 Vision is "gpt-4o"
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_b64}",
                            },
                        },
                    ],
                }
            ],
            max_tokens=4000,
        )
        
        extracted_text = response.choices[0].message.content or ""
        
        if DEBUG_OCR:
            print(f"[GPT-4 Vision] page={page_num} extracted {len(extracted_text)} chars")
        
        return extracted_text
    
    except Exception as e:
        raise Exception(f"GPT-4 Vision OCR failed: {str(e)}")


def extract_text_from_pdf_page_hybrid(
    pdf_path: Path,
    page_num: int,
    dpi: int = 200,
    lang: str = "eng+ara",
    force_gpt4: bool = False
) -> Tuple[str, str]:
    """
    Hybrid OCR: Tesseract first, GPT-4 Vision fallback if quality check fails
    
    Args:
        pdf_path: Path to PDF file
        page_num: Page number (1-indexed)
        dpi: DPI for image conversion
        lang: Tesseract language code
        force_gpt4: If True, skip Tesseract and use GPT-4 Vision directly
    
    Returns:
        (extracted_text, method_used) tuple
        method_used: "tesseract" or "gpt4_vision"
    """
    if convert_from_path is None:
        raise ImportError("pdf2image not installed")
    
    # Convert PDF page to image
    images = convert_from_path(str(pdf_path), dpi=dpi, first_page=page_num, last_page=page_num)
    if not images:
        raise Exception(f"Failed to convert page {page_num} to image")
    
    image = images[0]
    original_image = image.copy()  # Keep original for GPT-4 Vision
    
    if force_gpt4:
        # Skip Tesseract, use GPT-4 Vision directly
        text = extract_text_with_gpt4_vision(original_image, page_num)
        return text, "gpt4_vision"
    
    # Stage 1: Tesseract OCR with preprocessing
    try:
        preprocessed_image = preprocess_image_for_ocr(image)
        text_tesseract = extract_text_with_tesseract(preprocessed_image, lang=lang)
        
        if DEBUG_OCR:
            print(f"[Hybrid OCR] page={page_num} Tesseract extracted {len(text_tesseract)} chars")
        
        # For single page, we can't do full quality validation (needs all pages)
        # Return Tesseract result for now (quality check happens at batch level)
        return text_tesseract, "tesseract"
    
    except Exception as e:
        if DEBUG_OCR:
            print(f"[Hybrid OCR] page={page_num} Tesseract failed: {e}, falling back to GPT-4 Vision")
        
        # Fallback to GPT-4 Vision
        text_gpt4 = extract_text_with_gpt4_vision(original_image, page_num)
        return text_gpt4, "gpt4_vision"


def extract_all_pages_hybrid(
    pdf_path: Path,
    total_pages: int,
    dpi: int = 200,
    lang: str = "eng+ara"
) -> Tuple[List[str], Dict[str, Any]]:
    """
    Extract text from all pages using hybrid OCR pipeline
    
    Stage 1: Tesseract OCR for all pages
    Quality Validation: Check for issues
    Stage 2: GPT-4 Vision fallback for pages with quality issues
    
    Args:
        pdf_path: Path to PDF file
        total_pages: Total number of pages
        dpi: DPI for image conversion
        lang: Tesseract language code
    
    Returns:
        (text_pages, metadata) tuple
        text_pages: List of extracted text per page
        metadata: Dict with extraction metadata (methods_used, quality_issues, etc.)
    """
    if convert_from_path is None:
        raise ImportError("pdf2image not installed")
    
    # Stage 1: Extract all pages with Tesseract
    text_pages = []
    page_numbers = list(range(1, total_pages + 1))
    methods_used = []
    
    print(f"[Hybrid OCR] Stage 1: Extracting {total_pages} pages with Tesseract...")
    
    # Convert all pages to images (more efficient)
    all_images = convert_from_path(str(pdf_path), dpi=dpi)
    
    for page_num in range(1, total_pages + 1):
        if page_num > len(all_images):
            text_pages.append("")
            methods_used.append("failed")
            continue
        
        image = all_images[page_num - 1]
        original_image = image.copy()
        
        try:
            preprocessed_image = preprocess_image_for_ocr(image)
            text_tesseract = extract_text_with_tesseract(preprocessed_image, lang=lang)
            text_pages.append(text_tesseract)
            methods_used.append("tesseract")
            
            if DEBUG_OCR:
                print(f"[Hybrid OCR] page={page_num} Tesseract: {len(text_tesseract)} chars")
        
        except Exception as e:
            if DEBUG_OCR:
                print(f"[Hybrid OCR] page={page_num} Tesseract failed: {e}")
            text_pages.append("")
            methods_used.append("tesseract_failed")
    
    # Quality Validation
    print(f"[Hybrid OCR] Quality validation...")
    is_valid, issues = validate_ocr_quality(text_pages, page_numbers)
    
    metadata = {
        "methods_used": methods_used,
        "quality_issues": issues,
        "quality_valid": is_valid,
    }
    
    if is_valid:
        print(f"[Hybrid OCR] Quality check passed, using Tesseract results")
        return text_pages, metadata
    
    # Stage 2: GPT-4 Vision fallback
    print(f"[Hybrid OCR] Quality check failed ({len(issues)} issues), using GPT-4 Vision fallback...")
    print(f"[Hybrid OCR] Issues: {', '.join(issues)}")
    
    # Use GPT-4 Vision for all pages (replace Tesseract results)
    text_pages_gpt4 = []
    for page_num in range(1, total_pages + 1):
        if page_num > len(all_images):
            text_pages_gpt4.append("")
            continue
        
        original_image = all_images[page_num - 1]
        
        try:
            text_gpt4 = extract_text_with_gpt4_vision(original_image, page_num)
            text_pages_gpt4.append(text_gpt4)
            methods_used[page_num - 1] = "gpt4_vision"
            
            if DEBUG_OCR:
                print(f"[Hybrid OCR] page={page_num} GPT-4 Vision: {len(text_gpt4)} chars")
        
        except Exception as e:
            print(f"[Hybrid OCR] page={page_num} GPT-4 Vision failed: {e}")
            # Keep Tesseract result if GPT-4 fails
            text_pages_gpt4.append(text_pages[page_num - 1] if page_num <= len(text_pages) else "")
            methods_used[page_num - 1] = "gpt4_vision_failed"
    
    metadata["methods_used"] = methods_used
    metadata["fallback_used"] = True
    
    return text_pages_gpt4, metadata

