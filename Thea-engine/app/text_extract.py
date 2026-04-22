"""Text extraction from PDF files"""
import io
from pathlib import Path
from typing import List, Tuple
from PyPDF2 import PdfReader

try:
    from pdf2image import convert_from_path
except ImportError:
    convert_from_path = None

# Export for use in jobs.py
__all__ = ['extract_text_from_pdf', 'pdf_to_images', 'convert_from_path']

try:
    from PIL import Image
except ImportError:
    Image = None


def extract_text_from_pdf(file_path: Path) -> List[Tuple[int, str, bool]]:
    """
    Extract text from PDF file page by page
    
    Returns:
        List of (page_number, text, needs_ocr) tuples
        page_number is 1-indexed
    """
    results = []
    
    try:
        # Try to extract text directly from PDF
        with open(file_path, "rb") as f:
            reader = PdfReader(f)
            num_pages = len(reader.pages)
            
            for page_num in range(num_pages):
                page = reader.pages[page_num]
                text = page.extract_text()
                
                # Check if page has meaningful text (use 25 chars as threshold per requirements)
                text_stripped = text.strip()
                if len(text_stripped) >= 25:  # Has enough text
                    results.append((page_num + 1, text, False))
                else:
                    # Mark as needing OCR (empty or very small text)
                    results.append((page_num + 1, "", True))
        
        return results
    
    except Exception as e:
        # If PDF text extraction fails, mark all pages as needing OCR
        try:
            # Try to get page count using pdf2image
            if convert_from_path:
                images = convert_from_path(file_path, first_page=1, last_page=1)
                if images:
                    # Get total pages by trying to read the file differently
                    with open(file_path, "rb") as f:
                        reader = PdfReader(f)
                        num_pages = len(reader.pages)
                        return [(i + 1, "", True) for i in range(num_pages)]
        except:
            pass
        
        # If we can't determine page count, return error
        raise Exception(f"Failed to extract text from PDF: {str(e)}")


def pdf_to_images(file_path: Path, page_num: int) -> Image.Image | None:
    """
    Convert a single PDF page to image
    
    Returns:
        PIL Image or None if conversion fails
    """
    if convert_from_path is None:
        return None
    
    try:
        images = convert_from_path(file_path, first_page=page_num, last_page=page_num)
        if images:
            return images[0]
    except Exception as e:
        # poppler not available or conversion failed
        return None
    return None
