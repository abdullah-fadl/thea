import { logger } from '@/lib/monitoring/logger';
/**
 * CVision PDF Parser API
 *
 * POST /api/cvision/recruitment/cv-inbox/parse-pdf
 *
 * Parses PDF file and extracts text content.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Dynamic import for pdf-parse to avoid build issues
async function parsePDF(buffer: Buffer): Promise<{ text: string; numpages: number; info: any }> {
  try {
    // Use dynamic import with type assertion
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const data = await (pdfParse as unknown as (buf: Buffer, opts: Record<string, unknown>) => Promise<{ text: string; numpages: number; info?: any }>)(buffer, {
      // Disable test file check
      max: 0,
    });
    return {
      text: data.text || '',
      numpages: data.numpages || 0,
      info: data.info || {},
    };
  } catch (error: any) {
    logger.error('[PDF Parse Error]', error?.message);

    // Fallback: Try to extract text manually from PDF structure
    const text = extractTextFromPDFBuffer(buffer);
    return {
      text,
      numpages: 1,
      info: {},
    };
  }
}

// Simple fallback text extraction from PDF buffer
function extractTextFromPDFBuffer(buffer: Buffer): string {
  try {
    const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 500000));

    // Extract text between stream markers
    const textParts: string[] = [];

    // Look for text in parentheses (PDF text objects)
    const parenMatches = content.match(/\(([^)]+)\)/g);
    if (parenMatches) {
      for (const match of parenMatches) {
        const text = match.slice(1, -1)
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .trim();
        if (text.length > 2 && /[a-zA-Z@.]/.test(text)) {
          textParts.push(text);
        }
      }
    }

    // Look for text in angle brackets (hex encoded)
    const hexMatches = content.match(/<([0-9A-Fa-f]+)>/g);
    if (hexMatches) {
      for (const match of hexMatches) {
        const hex = match.slice(1, -1);
        if (hex.length > 4 && hex.length % 2 === 0) {
          let text = '';
          for (let i = 0; i < hex.length; i += 2) {
            const charCode = parseInt(hex.substring(i, i + 2), 16);
            if (charCode >= 32 && charCode < 127) {
              text += String.fromCharCode(charCode);
            }
          }
          if (text.length > 2) {
            textParts.push(text);
          }
        }
      }
    }

    // Clean and deduplicate
    const uniqueTexts = [...new Set(textParts)];
    return uniqueTexts.join(' ').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

export const POST = withAuthTenant(
  async (request: NextRequest) => {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: 'No file provided' },
          { status: 400 }
        );
      }

      // Convert file to buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      logger.info('[CVision PDF Parse] Processing:', {
        fileName: file.name,
        size: buffer.length,
      });

      // Parse PDF
      const data = await parsePDF(buffer);

      // Extract text
      const text = data.text || '';

      logger.info('[CVision PDF Parse] Success:', {
        fileName: file.name,
        pages: data.numpages,
        textLength: text.length,
        preview: text.substring(0, 200),
      });

      return NextResponse.json({
        success: true,
        text: text,
        pages: data.numpages,
        info: data.info,
      });
    } catch (error: any) {
      logger.error('[CVision PDF Parse] Error:', error?.message || String(error));
      return NextResponse.json(
        { success: false, error: 'Failed to parse PDF', message: error?.message || 'Unknown error' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
