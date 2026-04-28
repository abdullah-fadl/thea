#!/usr/bin/env python3
"""
Smoke test script for Vision OCR

Usage:
    python -m app.scripts.vision_ocr_test <pdf_path> [page_num]

Example:
    python -m app.scripts.vision_ocr_test data/default/policy-id/file.pdf 1
    python -m app.scripts.vision_ocr_test data/default/policy-id/file.pdf  # Test first page
"""
import sys
import argparse
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.ocr_vision import vision_ocr_pdf_page
from app.config import settings


def main():
    parser = argparse.ArgumentParser(description="Vision OCR smoke test")
    parser.add_argument("pdf_path", type=str, help="Path to PDF file")
    parser.add_argument("page_num", type=int, nargs="?", default=1, help="Page number (1-indexed, default: 1)")
    parser.add_argument("--dpi", type=int, default=225, help="DPI for rendering (default: 225)")
    
    args = parser.parse_args()
    
    pdf_path = Path(args.pdf_path)
    if not pdf_path.exists():
        print(f"ERROR: PDF file not found: {pdf_path}")
        sys.exit(1)
    
    page_num = args.page_num
    if page_num < 1:
        print(f"ERROR: Page number must be >= 1, got: {page_num}")
        sys.exit(1)
    
    print(f"=== Vision OCR Smoke Test ===")
    print(f"PDF: {pdf_path}")
    print(f"Page: {page_num}")
    print(f"DPI: {args.dpi}")
    print(f"Model: {settings.vision_ocr_model}")
    print(f"Detail: {settings.vision_ocr_detail}")
    print()
    
    try:
        # Test Vision OCR
        print(f"Extracting text from page {page_num}...")
        extracted_text = vision_ocr_pdf_page(pdf_path, page_num, dpi=args.dpi)
        
        text_len = len(extracted_text)
        text_preview = extracted_text[:200].replace('\n', '\\n')
        
        print()
        print("=== Results ===")
        print(f"Extracted text length: {text_len} characters")
        print(f"Text preview (first 200 chars):")
        print(f"  {text_preview}")
        print()
        
        if text_len == 0:
            print("⚠️  WARNING: No text extracted (empty string returned)")
            sys.exit(1)
        
        print("✅ SUCCESS: Text extracted successfully")
        sys.exit(0)
    
    except Exception as e:
        print()
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

