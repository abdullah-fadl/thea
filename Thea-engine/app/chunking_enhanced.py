"""
Enhanced chunking utilities with duplicate header removal and clean indexing
"""
import re
import json
from typing import List, Dict, Any, Tuple
from app.chunking import chunk_text_with_lines


def detect_repeated_header(text_lines: List[str], max_header_lines: int = 5) -> str | None:
    """
    Detect if the first few lines are a repeated header
    
    Args:
        text_lines: List of text lines
        max_header_lines: Maximum number of lines to check for header
    
    Returns:
        Header text if detected, None otherwise
    """
    if len(text_lines) < max_header_lines:
        return None
    
    # Get first few lines as potential header
    header_lines = text_lines[:max_header_lines]
    header_text = '\n'.join(header_lines).strip().lower()
    
    # Normalize: remove extra whitespace
    header_text = re.sub(r'\s+', ' ', header_text)
    
    # Check if header is too short (likely not a meaningful header)
    if len(header_text) < 20:
        return None
    
    return header_text


def remove_page_headers(text_pages: List[str], page_numbers: List[int]) -> List[str]:
    """
    Remove repeated headers from pages
    
    Args:
        text_pages: List of text strings (one per page)
        page_numbers: List of page numbers (1-indexed)
    
    Returns:
        List of cleaned text pages (headers removed)
    """
    if len(text_pages) < 2:
        return text_pages  # Can't detect repeated headers with < 2 pages
    
    # Detect header from first page
    first_page_lines = text_pages[0].splitlines()
    detected_header = detect_repeated_header(first_page_lines)
    
    if not detected_header:
        return text_pages  # No header detected
    
    # Check how many pages have this header (similarity > 80%)
    header_count = 0
    for page_text in text_pages[1:6]:  # Check first 5 pages after first
        page_lines = page_text.splitlines()
        page_header = detect_repeated_header(page_lines)
        if page_header:
            # Calculate similarity
            similarity = _text_similarity(detected_header, page_header)
            if similarity > 0.80:
                header_count += 1
    
    # If header appears in at least 2 pages, it's likely a repeated header
    if header_count < 2:
        return text_pages  # Not a repeated header
    
    # Remove header from all pages
    cleaned_pages = []
    header_line_count = len(first_page_lines[:5])  # Remove first 5 lines if they match header
    
    for i, page_text in enumerate(text_pages):
        page_lines = page_text.splitlines()
        
        # Check if first lines match header
        page_header = detect_repeated_header(page_lines)
        if page_header:
            similarity = _text_similarity(detected_header, page_header)
            if similarity > 0.80:
                # Remove header lines
                cleaned_lines = page_lines[header_line_count:]
                cleaned_text = '\n'.join(cleaned_lines)
                cleaned_pages.append(cleaned_text)
                continue
        
        # No header match, keep original
        cleaned_pages.append(page_text)
    
    return cleaned_pages


def remove_page_numbers_and_titles(text: str) -> str:
    """
    Remove common page number patterns and repeated titles
    
    Args:
        text: Text to clean
    
    Returns:
        Cleaned text
    """
    # Remove common page number patterns (e.g., "Page 1", "1/10", "- 1 -")
    text = re.sub(r'(?i)^\s*page\s+\d+\s*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'(?i)^\s*\d+\s*/\s*\d+\s*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'(?i)^\s*-\s*\d+\s*-\s*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'(?i)^\s*\d+\s*$', '', text, flags=re.MULTILINE)
    
    # Remove very short lines at start/end (likely titles or page numbers)
    lines = text.splitlines()
    cleaned_lines = []
    
    for line in lines:
        line_stripped = line.strip()
        # Keep lines that are substantial (> 10 chars) or empty (for paragraph breaks)
        if len(line_stripped) > 10 or len(line_stripped) == 0:
            cleaned_lines.append(line)
        # Skip very short lines that look like page numbers or titles
        elif not re.match(r'^\d+[\s\-/]*$', line_stripped):
            cleaned_lines.append(line)
    
    return '\n'.join(cleaned_lines)


def clean_text_for_chunking(text: str) -> str:
    """
    Clean text before chunking: remove page numbers, repeated titles, etc.
    
    Args:
        text: Raw text
    
    Returns:
        Cleaned text
    """
    # Remove page numbers and titles
    text = remove_page_numbers_and_titles(text)
    
    # Remove excessive whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)  # Max 2 consecutive newlines
    text = re.sub(r'[ \t]{3,}', '  ', text)  # Max 2 consecutive spaces
    
    # Trim
    text = text.strip()
    
    return text


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


def build_clean_chunks_from_pages(
    tenant_id: str,
    policy_id: str,
    filename: str,
    chunk_size_chars: int = 2000,
    overlap_chars: int = 300
) -> List[Dict[str, Any]]:
    """
    Build chunks from text pages with duplicate header removal and cleaning
    
    This is an enhanced version that:
    - Removes repeated page headers
    - Removes page numbers and titles
    - Ensures meaningful chunks (no empty or trivial chunks)
    
    Args:
        tenant_id: Tenant identifier
        policy_id: Policy identifier
        filename: Policy filename
        chunk_size_chars: Target chunk size in characters
        overlap_chars: Overlap between chunks
    
    Returns:
        List of chunk dictionaries with keys:
        - chunk_id: str
        - text: str (cleaned text)
        - metadata: Dict with tenantId, policyId, filename, page, lineStart, lineEnd, chunkIndex
    """
    from pathlib import Path
    from app.config import settings
    
    data_dir = Path(settings.data_dir)
    text_dir = data_dir / tenant_id / policy_id / "text"
    
    if not text_dir.exists():
        return []
    
    # Load all text pages
    page_files = sorted(text_dir.glob("page_*.txt"))
    text_pages = []
    page_numbers = []
    page_meta = {}
    
    for page_file in page_files:
        try:
            page_num = int(page_file.stem.split("_")[1])
            with open(page_file, "r", encoding="utf-8") as f:
                page_text = f.read()
            meta_path = page_file.with_suffix(".meta.json")
            if meta_path.exists():
                try:
                    page_meta[page_num] = json.loads(meta_path.read_text())
                except Exception:
                    page_meta[page_num] = {}
            
            if page_text.strip():  # Only add non-empty pages
                text_pages.append(page_text)
                page_numbers.append(page_num)
        except Exception as e:
            print(f"[Chunking] Error reading {page_file}: {e}")
            continue
    
    if not text_pages:
        return []
    
    # Remove repeated headers from all pages
    cleaned_text_pages = remove_page_headers(text_pages, page_numbers)
    
    # Build chunks from cleaned pages
    all_chunks = []
    
    for page_idx, (page_text, page_num) in enumerate(zip(cleaned_text_pages, page_numbers)):
        # Clean text before chunking
        cleaned_text = clean_text_for_chunking(page_text)
        
        if not cleaned_text.strip():
            continue  # Skip empty pages after cleaning
        
        # Chunk the cleaned page text
        page_chunks = chunk_text_with_lines(cleaned_text, chunk_size=chunk_size_chars, chunk_overlap=overlap_chars)
        
        # Filter out trivial chunks (too short, mostly whitespace, etc.)
        for chunk_idx, chunk_data in enumerate(page_chunks):
            chunk_text = chunk_data["text"].strip()
            
            # Skip chunks that are too short (< 100 chars) or contain very few words
            if len(chunk_text) < 100:
                continue
            
            words = chunk_text.split()
            if len(words) < 10:  # Less than 10 words is likely not meaningful
                continue
            
            # Skip chunks that are mostly numbers or special characters
            alphanumeric_chars = sum(1 for c in chunk_text if c.isalnum())
            if alphanumeric_chars < len(chunk_text) * 0.5:  # Less than 50% alphanumeric
                continue
            
            # Create chunk
            chunk_id = f"{policy_id}:p{page_num}:c{chunk_idx}"
            
            locator_meta = page_meta.get(page_num, {})
            chunk_dict = {
                "chunk_id": chunk_id,
                "text": chunk_text,
                "metadata": {
                    "tenantId": tenant_id,
                    "policyId": policy_id,
                    "filename": filename,
                    "page": page_num,
                    "pageNumber": page_num,
                    "lineStart": chunk_data["lineStart"],
                    "lineEnd": chunk_data["lineEnd"],
                    "chunkIndex": chunk_idx,
                    **locator_meta,
                }
            }
            
            all_chunks.append(chunk_dict)
    
    return all_chunks

