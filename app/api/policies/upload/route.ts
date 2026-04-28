import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { chunkTextWithLines } from '@/lib/policy/chunking';
import type { PolicyDocument, PolicyChunk } from '@/lib/models/Policy';
// Import pdfjs-dist for PDF text extraction
// Using dynamic import to avoid bundling issues in Next.js
let pdfjsLib: unknown = null;

async function getPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLib;
}

export const runtime = 'nodejs';

import { env } from '@/lib/env';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const POLICIES_DIR = env.POLICIES_DIR;

// Ensure directory exists
if (!fs.existsSync(POLICIES_DIR)) {
  fs.mkdirSync(POLICIES_DIR, { recursive: true });
}

function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
}

/**
 * Extract hospital code from fileName prefix
 */
function extractHospitalFromFileName(fileName: string): string | undefined {
  const upperFileName = fileName.toUpperCase();

  const hospitalPatterns = [
    /^(TAK|WHH|HMG)[-_/]/i,
    /HMG[-/](TAK|WHH)[-/]/i,
    /^(TAK|WHH)\s/i,
  ];

  for (const pattern of hospitalPatterns) {
    const match = upperFileName.match(pattern);
    if (match) {
      const hospital = match[1] || match[0].replace(/[-_/\s].*$/, '');
      if (hospital && (hospital === 'TAK' || hospital === 'WHH' || hospital === 'HMG')) {
        return hospital;
      }
    }
  }

  if (upperFileName.startsWith('TAK')) return 'TAK';
  if (upperFileName.startsWith('WHH')) return 'WHH';
  if (upperFileName.startsWith('HMG')) return 'HMG';

  return undefined;
}

/**
 * Extract text from PDF using pdfjs-dist
 */
async function extractPdfText(buffer: Buffer): Promise<{ text: string; totalPages: number }> {
  try {
    logger.info('Starting PDF text extraction with pdfjs-dist...');
    logger.info('Buffer size:', { bytes: buffer.length });

    const pdfjs = await getPdfJs();
    const uint8Array = new Uint8Array(buffer);

    const loadingTask = (pdfjs as any).getDocument({
      data: uint8Array,
      useSystemFonts: true,
      verbosity: 0,
    });

    const pdfDocument = await loadingTask.promise;
    const totalPages = pdfDocument.numPages;

    logger.info(`PDF loaded successfully. Total pages: ${totalPages}`);

    const textParts: string[] = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item: Record<string, unknown>) => {
          if (typeof item.str === 'string') {
            return item.str;
          }
          return '';
        })
        .join(' ');

      textParts.push(pageText);

      if (pageNum % 10 === 0) {
        logger.info(`Processed ${pageNum}/${totalPages} pages...`);
      }
    }

    const fullText = textParts.join('\n\n');
    logger.info(`Text extraction completed. Total text length: ${fullText.length} characters`);

    return {
      text: fullText,
      totalPages: totalPages,
    };
  } catch (error: unknown) {
    logger.error('PDF extraction error:', { error: error });
    throw new Error(`Failed to extract text from PDF: ${(error as Error).message}`);
  }
}

const uploadSchema = z.object({
  title: z.string().optional(),
  category: z.string().optional(),
  section: z.string().optional(),
  source: z.string().optional(),
  tags: z.string().optional(),
  version: z.string().optional(),
  effectiveDate: z.string().optional(),
  expiryDate: z.string().optional(),
});

export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId, userId, role }) => {
  try {
    logger.info('Policy upload request received');
    logger.info('User role:', { role, userId, tenantId });

    const formData = await req.formData();
    const file = formData.get('file') as File;
    logger.info('File received:', { fileName: file?.name, fileSize: file?.size });
    const title = formData.get('title') as string;
    const category = formData.get('category') as string;
    const section = formData.get('section') as string;
    const source = formData.get('source') as string;
    const tags = formData.get('tags') as string;
    const version = formData.get('version') as string;
    const effectiveDate = formData.get('effectiveDate') as string;
    const expiryDate = formData.get('expiryDate') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB
    if (buffer.length > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.', code: 'FILE_TOO_LARGE' },
        { status: 413 }
      );
    }

    const pdfHeader = buffer.toString('ascii', 0, 4);
    if (pdfHeader !== '%PDF') {
      return NextResponse.json(
        { error: 'Invalid PDF file' },
        { status: 400 }
      );
    }

    const fileHash = calculateFileHash(buffer);

    // Check for duplicate by original filename
    const existing = await prisma.policyDocument.findFirst({
      where: { tenantId, originalFileName: file.name, isActive: true },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          reason: 'duplicate',
          existingDocumentId: (existing as Record<string, unknown>).documentId,
          message: `A policy with this file already exists: ${(existing as Record<string, unknown>).documentId}`,
        },
        { status: 409 }
      );
    }

    // Extract text from PDF
    let text: string;
    let numPages: number;

    try {
      const result = await extractPdfText(buffer);
      text = result.text;
      numPages = result.totalPages;

      if (numPages === 0) {
        logger.error('PDF has no pages');
        return NextResponse.json(
          { error: 'PDF has no pages' },
          { status: 400 }
        );
      }

      if (!text || text.trim().length === 0) {
        logger.warn('PDF parsed but contains no text - may be image-based or encrypted');
        text = ' ';
      }
    } catch (parseError: unknown) {
      logger.error('PDF extraction error:', { error: parseError });

      let errorMessage = 'Failed to extract text from PDF file';
      let errorDetails = (parseError as Error).message || 'The PDF file may be corrupted or invalid';

      if ((parseError as Error).message?.includes('password') || (parseError as Error).message?.includes('encrypted')) {
        errorMessage = 'PDF file is password protected';
        errorDetails = 'The PDF file is encrypted and requires a password to open';
      } else if ((parseError as Error).message?.includes('invalid') || (parseError as Error).message?.includes('corrupted')) {
        errorMessage = 'Invalid or corrupted PDF file';
        errorDetails = 'The PDF file may be corrupted or in an unsupported format';
      }

      // [SEC-06]
      return NextResponse.json(
        {
          error: errorMessage,
        },
        { status: 400 }
      );
    }

    const year = new Date().getFullYear();
    const documentId = `POL-${year}-${uuidv4().substring(0, 8).toUpperCase()}`;
    const policyId = uuidv4();

    const yearDir = path.join(POLICIES_DIR, year.toString());
    if (!fs.existsSync(yearDir)) {
      fs.mkdirSync(yearDir, { recursive: true });
    }

    const sanitizedFileName = sanitizeFileName(file.name);
    const storedFileName = `${documentId}-${sanitizedFileName}`;
    const filePath = path.join(yearDir, storedFileName);

    try {
      fs.writeFileSync(filePath, buffer);
      logger.info(`PDF saved to: ${filePath}`);
    } catch (writeError: unknown) {
      logger.error('File write error:', { error: writeError });
      return NextResponse.json(
        {
          error: 'Failed to save PDF file',
        },
        { status: 500 }
      );
    }

    const policyTitle = title || file.name.replace('.pdf', '').replace(/_/g, ' ');
    const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const hospital = extractHospitalFromFileName(file.name);
    if (hospital) {
      logger.info(`Extracted hospital: ${hospital} from fileName: ${file.name}`);
    }

    // Chunk text
    let chunks: PolicyChunk[] = [];
    try {
      logger.info('Starting text chunking...');
      chunks = chunkTextWithLines(text, numPages);
      logger.info(`Generated ${chunks.length} chunks`);

      chunks.forEach((chunk, index) => {
        chunk.policyId = policyId;
        chunk.documentId = documentId;
        chunk.isActive = true;
        chunk.updatedAt = new Date();
        chunk.hospital = hospital;
        chunk.tenantId = tenantId;
      });
    } catch (chunkError: unknown) {
      logger.error('Chunking error:', { error: chunkError });
      return NextResponse.json(
        {
          error: 'Failed to chunk text',
        },
        { status: 500 }
      );
    }

    // Create document record
    const document = {
      id: policyId,
      documentId,
      title: policyTitle,
      originalFileName: file.name,
      storedFileName,
      filePath,
      fileSize: buffer.length,
      fileHash,
      mimeType: 'application/pdf',
      totalPages: numPages,
      chunksCount: chunks.length,
      processingStatus: 'completed',
      processedAt: new Date(),
      storageYear: year,
      createdAt: new Date(),
      updatedAt: new Date(),
      uploadedBy: userId || 'system',
      tenantId,
      isActive: true,
      tags: tagsArray.length > 0 ? tagsArray : undefined,
      category: category || undefined,
      section: section || undefined,
      source: source || undefined,
      version: version || undefined,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      hospital,
    };

    try {
      await prisma.policyDocument.create({ data: document as unknown as Prisma.PolicyDocumentUncheckedCreateInput });
      logger.info(`Document saved: ${documentId}`);
    } catch (dbError: unknown) {
      logger.error('Database error (document):', { error: dbError });
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (unlinkError) {
        logger.error('Failed to cleanup file:', { error: unlinkError });
      }
      return NextResponse.json(
        {
          error: 'Failed to save document to database',
        },
        { status: 500 }
      );
    }

    // Save chunks
    try {
      if (chunks.length === 0) {
        logger.warn('No chunks to save!');
        return NextResponse.json(
          {
            error: 'No text chunks generated from PDF',
            details: 'The PDF may be empty or contain only images'
          },
          { status: 400 }
        );
      }

      logger.info(`Attempting to save ${chunks.length} chunks...`);

      const validChunks = chunks.filter(chunk => {
        return chunk.text && chunk.documentId && chunk.policyId;
      });

      if (validChunks.length === 0) {
        logger.error('No valid chunks to save!');
        return NextResponse.json(
          {
            error: 'No valid chunks to save',
            details: 'All chunks failed validation'
          },
          { status: 500 }
        );
      }

      // Insert chunks using Prisma createMany
      for (const chunk of validChunks) {
        await prisma.policyChunk.create({ data: chunk as unknown as Prisma.PolicyChunkUncheckedCreateInput });
      }
      logger.info(`Successfully saved ${validChunks.length} chunks`);

      const savedCount = await prisma.policyChunk.count({
        where: { documentId },
      });
      logger.info(`Verified: ${savedCount} chunks now exist for document ${documentId}`);
    } catch (chunksError: unknown) {
      logger.error('Database error (chunks):', { error: chunksError });
      return NextResponse.json(
        {
          success: false,
          error: 'Document saved but chunks failed to save',
          documentId,
          policyId,
          totalPages: numPages,
          chunksCount: 0,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      documentId,
      policyId,
      totalPages: numPages,
      chunksCount: chunks.length,
      filePath,
    });
  } catch (error: unknown) {
    logger.error('Policy upload error (outer catch):', { error: error });
    return NextResponse.json(
      {
        error: 'Failed to upload policy',
      },
      { status: 500 }
    );
  }
}),
  { tenantScoped: true, permissionKey: 'policies.upload' });
