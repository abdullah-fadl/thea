#!/usr/bin/env python3
"""
OCR Debug Script

Usage:
    python -m app.scripts.ocr_debug <pdf_path> --preset table_ocr --pages 1,2,3

This script helps debug OCR issues by:
- Converting PDF pages to images
- Computing image hashes to detect duplicates
- Running OCR with specified preset
- Saving debug images to data/_debug/
- Outputting first 200 chars of OCR text per page
"""
import sys
import argparse
from pathlib import Path
import hashlib
from typing import List, Optional

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.ocr import extract_text_from_pdf_page
from app.config import settings


def hash_image_bytes(image) -> str:
    """Compute hash of image bytes (first 1MB)"""
    try:
        import io
        img_bytes = io.BytesIO()
        image.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        data = img_bytes.read(1048576)  # First 1MB
        return hashlib.md5(data).hexdigest()
    except Exception as e:
        return f"ERROR: {e}"


def save_debug_image(image, output_dir: Path, page_num: int, preset: str):
    """Save debug image to output directory"""
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"page_{page_num}_{preset}.png"
    image.save(output_path)
    return output_path


def main():
    parser = argparse.ArgumentParser(description="OCR Debug Script")
    parser.add_argument("pdf_path", type=str, help="Path to PDF file")
    parser.add_argument("--preset", type=str, choices=["normal_ocr", "table_ocr"], 
                       default="normal_ocr", help="OCR preset to use")
    parser.add_argument("--pages", type=str, help="Comma-separated list of page numbers (1-indexed), e.g., 1,2,3")
    parser.add_argument("--dpi", type=int, default=200, help="DPI for image conversion")
    parser.add_argument("--lang", type=str, default="eng+ara", help="Tesseract language")
    
    args = parser.parse_args()
    
    pdf_path = Path(args.pdf_path)
    if not pdf_path.exists():
        print(f"ERROR: PDF file not found: {pdf_path}")
        sys.exit(1)
    
    # Parse page numbers
    page_numbers: List[int] = []
    if args.pages:
        try:
            page_numbers = [int(p.strip()) for p in args.pages.split(",")]
        except ValueError:
            print(f"ERROR: Invalid page numbers: {args.pages}")
            sys.exit(1)
    
    # Output directory
    output_dir = Path(settings.data_dir) / "_debug"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"=== OCR Debug Script ===")
    print(f"PDF: {pdf_path}")
    print(f"Preset: {args.preset}")
    print(f"DPI: {args.dpi}")
    print(f"Language: {args.lang}")
    print(f"Output directory: {output_dir}")
    print()
    
    # Convert pages to images first (to get hashes and save debug images)
    try:
        from pdf2image import convert_from_path
        from PIL import Image
    except ImportError:
        print("ERROR: pdf2image or PIL not available")
        sys.exit(1)
    
    # Determine which pages to process
    if not page_numbers:
        # Get total pages
        try:
            from PyPDF2 import PdfReader
            with open(pdf_path, "rb") as f:
                reader = PdfReader(f)
                total_pages = len(reader.pages)
                page_numbers = list(range(1, min(total_pages + 1, 11)))  # Default: first 10 pages
                print(f"No pages specified, processing first {len(page_numbers)} pages")
        except Exception as e:
            print(f"ERROR: Could not determine page count: {e}")
            sys.exit(1)
    
    print(f"Processing pages: {page_numbers}")
    print()
    
    # Process each page
    results = []
    for page_num in page_numbers:
        try:
            print(f"--- Page {page_num} ---")
            
            # Convert to image
            images = convert_from_path(str(pdf_path), dpi=args.dpi, first_page=page_num, last_page=page_num)
            if not images:
                print(f"  ERROR: Failed to convert page {page_num} to image")
                continue
            
            image = images[0]
            img_size = image.size
            img_hash = hash_image_bytes(image)
            
            print(f"  Image size: {img_size}")
            print(f"  Image hash: {img_hash}")
            
            # Save debug image
            debug_path = save_debug_image(image, output_dir, page_num, args.preset)
            print(f"  Saved debug image: {debug_path}")
            
            # Run OCR
            try:
                text = extract_text_from_pdf_page(pdf_path, page_num, dpi=args.dpi, lang=args.lang, preset=args.preset)
                text_len = len(text.strip())
                text_preview = text[:200].replace('\n', '\\n')
                
                print(f"  OCR text length: {text_len} chars")
                print(f"  OCR text preview (first 200 chars): {text_preview}")
                
                results.append({
                    "page": page_num,
                    "image_size": img_size,
                    "image_hash": img_hash,
                    "text_length": text_len,
                    "text_preview": text_preview
                })
            except Exception as e:
                print(f"  ERROR: OCR failed: {e}")
                results.append({
                    "page": page_num,
                    "image_size": img_size,
                    "image_hash": img_hash,
                    "error": str(e)
                })
            
            print()
            
        except Exception as e:
            print(f"  ERROR: Failed to process page {page_num}: {e}")
            print()
    
    # Summary
    print("=== Summary ===")
    for result in results:
        if "error" in result:
            print(f"Page {result['page']}: ERROR - {result['error']}")
        else:
            print(f"Page {result['page']}: {result['text_length']} chars, hash={result['image_hash']}")
    
    # Check for duplicate hashes
    print()
    print("=== Duplicate Detection ===")
    hashes = [r.get('image_hash', '') for r in results if 'image_hash' in r]
    seen_hashes = {}
    duplicates = []
    for i, h in enumerate(hashes):
        if h in seen_hashes:
            duplicates.append((seen_hashes[h], results[i]['page']))
        else:
            seen_hashes[h] = results[i]['page']
    
    if duplicates:
        print(f"WARNING: Found {len(duplicates)} duplicate image(s):")
        for page1, page2 in duplicates:
            print(f"  Pages {page1} and {page2} have identical images")
    else:
        print("No duplicate images found")
    
    print()
    print(f"Debug images saved to: {output_dir}")


if __name__ == "__main__":
    main()
