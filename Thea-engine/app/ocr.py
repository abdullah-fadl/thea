"""OCR functionality using pytesseract"""
import hashlib
import os
from pathlib import Path
from PIL import Image

try:
    import pytesseract
except ImportError:
    pytesseract = None

try:
    from pdf2image import convert_from_path
except ImportError:
    convert_from_path = None

# Debug flag (can be set via env var)
DEBUG_OCR = os.getenv("DEBUG_OCR", "false").lower() == "true"


def extract_text_with_ocr(image: Image.Image, lang: str = "eng+ara", preset: str = "normal_ocr") -> str:
    """
    Extract text from image using pytesseract OCR
    
    Args:
        image: PIL Image object
        lang: Tesseract language code (default: "eng+ara" for English + Arabic)
        preset: OCR preset ("normal_ocr" or "table_ocr")
    
    Returns:
        Extracted text
    """
    if pytesseract is None:
        raise ImportError("pytesseract not installed - OCR functionality unavailable")
    
    try:
        # Configure Tesseract based on preset
        tesseract_config = _get_tesseract_config(preset)
        
        # Use pytesseract to extract text
        # lang="eng+ara" supports both English and Arabic
        text = pytesseract.image_to_string(image, lang=lang, config=tesseract_config)
        return text
    except Exception as e:
        raise Exception(f"OCR extraction failed: {str(e)}")


def _get_tesseract_config(preset: str) -> str:
    """
    Get Tesseract configuration string based on preset
    
    Args:
        preset: "normal_ocr" or "table_ocr"
    
    Returns:
        Tesseract config string
    """
    if preset == "table_ocr":
        # PSM 6: Assume a single uniform block of text
        # PSM 11: Sparse text (find as much text as possible in no particular order)
        # preserve_interword_spaces=1: Preserve spaces between words
        return "--psm 6 -c preserve_interword_spaces=1"
    else:
        # normal_ocr: default behavior (no special config)
        return ""


def extract_text_from_image_path(image_path: Path, lang: str = "eng+ara") -> str:
    """Extract text from image file using OCR"""
    image = Image.open(image_path)
    return extract_text_with_ocr(image, lang=lang)


def _hash_image_bytes(image: Image.Image) -> str:
    """Compute hash of image bytes (first 1MB)"""
    try:
        import io
        img_bytes = io.BytesIO()
        image.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        # Hash first 1MB (1048576 bytes)
        data = img_bytes.read(1048576)
        return hashlib.md5(data).hexdigest()
    except Exception as e:
        if DEBUG_OCR:
            print(f"[DEBUG] Failed to hash image: {e}")
        return ""


def _preprocess_image_for_table(image: Image.Image) -> Image.Image:
    """
    Preprocess image for table OCR: grayscale, adaptive threshold, denoise
    
    Args:
        image: PIL Image object
    
    Returns:
        Preprocessed PIL Image object
    """
    try:
        import numpy as np
        from PIL import ImageEnhance, ImageFilter
        
        # Convert to grayscale if not already
        if image.mode != 'L':
            image = image.convert('L')
        
        # Convert to numpy array for processing
        img_array = np.array(image)
        
        # Apply adaptive threshold (simple version using PIL)
        # For better results, could use cv2.adaptiveThreshold, but keeping it PIL-only for now
        # Enhance contrast first
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.2)
        
        # Apply mild denoising
        image = image.filter(ImageFilter.MedianFilter(size=3))
        
        return image
    except ImportError:
        # If numpy not available, just return grayscale
        if image.mode != 'L':
            return image.convert('L')
        return image
    except Exception as e:
        if DEBUG_OCR:
            print(f"[DEBUG] Preprocessing failed: {e}, returning original")
        return image


def extract_text_from_pdf_page(
    pdf_path: Path, 
    page_num: int, 
    dpi: int = 200, 
    lang: str = "eng+ara",
    preset: str = "normal_ocr"
) -> str:
    """
    Extract text from a single PDF page using OCR
    
    Args:
        pdf_path: Path to PDF file
        page_num: Page number (1-indexed)
        dpi: DPI for image conversion (default: 200)
        lang: Tesseract language code (default: "eng+ara")
        preset: OCR preset ("normal_ocr" or "table_ocr")
    
    Returns:
        Extracted text
    """
    if convert_from_path is None:
        raise ImportError("pdf2image not installed - OCR functionality unavailable")
    
    if pytesseract is None:
        raise ImportError("pytesseract not installed - OCR functionality unavailable")
    
    try:
        # Convert PDF page to image
        images = convert_from_path(str(pdf_path), dpi=dpi, first_page=page_num, last_page=page_num)
        if not images:
            raise Exception(f"Failed to convert page {page_num} to image")
        
        # Extract text from image
        image = images[0]
        
        # Debug logging: image size and hash
        if DEBUG_OCR:
            img_size = image.size
            img_hash = _hash_image_bytes(image)
            print(f"[DEBUG OCR] page={page_num} image_size={img_size} image_hash={img_hash}")
        
        # Apply preprocessing for table_ocr preset
        if preset == "table_ocr":
            image = _preprocess_image_for_table(image)
            if DEBUG_OCR:
                print(f"[DEBUG OCR] page={page_num} applied table_ocr preprocessing")
        
        # Get Tesseract config based on preset
        tesseract_config = _get_tesseract_config(preset)
        
        # Extract text
        text = pytesseract.image_to_string(image, lang=lang, config=tesseract_config)
        
        # Debug logging: first 200 chars of OCR text
        if DEBUG_OCR:
            text_preview = text[:200].replace('\n', '\\n')
            print(f"[DEBUG OCR] page={page_num} text_preview={text_preview}")
        
        return text
    except Exception as e:
        raise Exception(f"OCR extraction from PDF page {page_num} failed: {str(e)}")
