/**
 * Policy Text Chunking Utilities
 * 
 * Note: This is a stub implementation. 
 * Policy chunking is now handled by thea-engine service.
 */

import type { PolicyChunk } from '@/lib/models/Policy';

const CHUNK_SIZE = 2000; // characters
const CHUNK_OVERLAP = 300; // characters

/**
 * Chunk text with line numbers
 * @deprecated Policy chunking is now handled by thea-engine service
 */
export function chunkTextWithLines(text: string, numPages: number): PolicyChunk[] {
  // Simple stub implementation - split text into chunks
  const words = text.split(/\s+/);
  const chunks: PolicyChunk[] = [];
  let currentChunk: string[] = [];
  let wordCount = 0;
  let chunkIndex = 0;
  
  const wordsPerPage = Math.max(1, Math.ceil(words.length / numPages));
  
  for (let i = 0; i < words.length; i++) {
    currentChunk.push(words[i]);
    wordCount++;
    
    const chunkText = currentChunk.join(' ');
    if (chunkText.length >= CHUNK_SIZE || wordCount >= 500) {
      const pageNumber = Math.min(Math.floor(i / wordsPerPage) + 1, numPages);
      
      chunks.push({
        id: `chunk-${chunkIndex}`,
        policyId: '',
        documentId: '',
        chunkIndex: chunkIndex++,
        pageNumber,
        startLine: 0,
        endLine: 0,
        text: chunkText,
        wordCount,
        isActive: true,
        createdAt: new Date(),
      });
      
      // Overlap
      const overlapSize = Math.min(CHUNK_OVERLAP / 10, currentChunk.length);
      currentChunk = currentChunk.slice(-overlapSize);
      wordCount = overlapSize;
    }
  }
  
  // Add final chunk
  if (currentChunk.length > 0) {
    const pageNumber = Math.min(Math.ceil(words.length / wordsPerPage), numPages);
    chunks.push({
      id: `chunk-${chunkIndex}`,
      policyId: '',
      documentId: '',
      chunkIndex: chunkIndex++,
      pageNumber,
      startLine: 0,
      endLine: 0,
      text: currentChunk.join(' '),
      wordCount: currentChunk.length,
      isActive: true,
      createdAt: new Date(),
    });
  }
  
  return chunks;
}
