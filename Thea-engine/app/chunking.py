"""Text chunking utilities with accurate line mapping"""
from typing import List, Tuple, Dict, Any
from app.config import settings


def chunk_text_with_lines(text: str, chunk_size: int = None, chunk_overlap: int = None) -> List[Dict[str, Any]]:
    """
    Split text into overlapping chunks with accurate line numbers
    
    Args:
        text: Text to chunk
        chunk_size: Target size of each chunk in characters
        chunk_overlap: Overlap between chunks in characters
    
    Returns:
        List of chunk dictionaries with keys:
        - text: chunk text
        - lineStart: starting line number (1-indexed)
        - lineEnd: ending line number (1-indexed)
    """
    if chunk_size is None:
        chunk_size = settings.chunk_size
    if chunk_overlap is None:
        chunk_overlap = settings.chunk_overlap
    
    # Split text into lines
    lines = text.splitlines(keepends=False)  # Don't keep newlines in lines
    
    chunks = []
    current_chunk_lines = []
    current_length = 0
    current_line_start = 1  # 1-indexed
    
    for line_idx, line in enumerate(lines):
        line_num = line_idx + 1  # 1-indexed
        line_length = len(line)
        
        # Add newline character length (1) except for last line
        line_length_with_newline = line_length + (1 if line_idx < len(lines) - 1 else 0)
        
        # Check if adding this line would exceed chunk size
        if current_length + line_length_with_newline > chunk_size and current_chunk_lines:
            # Save current chunk
            chunk_text = '\n'.join(current_chunk_lines)
            chunks.append({
                "text": chunk_text,
                "lineStart": current_line_start,
                "lineEnd": line_num - 1,  # Previous line
            })
            
            # Start new chunk with overlap
            if chunk_overlap > 0:
                # Calculate how many lines we need for overlap
                overlap_chars = 0
                overlap_lines = []
                
                # Add lines from the end until we reach overlap size
                for overlap_line in reversed(current_chunk_lines):
                    line_len = len(overlap_line) + 1
                    if overlap_chars + line_len <= chunk_overlap:
                        overlap_lines.insert(0, overlap_line)
                        overlap_chars += line_len
                    else:
                        break
                
                current_chunk_lines = overlap_lines
                current_length = overlap_chars
                current_line_start = line_num - len(overlap_lines)
            else:
                current_chunk_lines = []
                current_length = 0
                current_line_start = line_num
        
        current_chunk_lines.append(line)
        current_length += line_length_with_newline
    
    # Add final chunk
    if current_chunk_lines:
        chunk_text = '\n'.join(current_chunk_lines)
        chunks.append({
            "text": chunk_text,
            "lineStart": current_line_start,
            "lineEnd": len(lines),  # Last line
        })
    
    return chunks


def chunk_text(text: str, chunk_size: int = None, chunk_overlap: int = None) -> List[str]:
    """
    Split text into overlapping chunks (legacy function for compatibility)
    
    Returns just the text chunks without line numbers
    """
    chunks_with_lines = chunk_text_with_lines(text, chunk_size, chunk_overlap)
    return [chunk["text"] for chunk in chunks_with_lines]


def get_line_numbers(text: str, chunk_start_pos: int, chunk_text: str) -> Tuple[int, int]:
    """
    Calculate line numbers for a chunk within the full text (legacy function)
    
    This is less accurate than chunk_text_with_lines, kept for backward compatibility
    """
    text_before = text[:chunk_start_pos]
    line_start = text_before.count('\n') + 1
    lines_in_chunk = chunk_text.count('\n')
    line_end = line_start + lines_in_chunk
    return (line_start, line_end)
