import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

import { env } from '@/lib/env';
import { logger } from '@/lib/monitoring/logger';

// Dynamic import for pdf-parse

export const dynamic = 'force-dynamic';
export const revalidate = 0;
let pdfParseFn: any;
async function getPdfParse() {
  if (!pdfParseFn) {
    const pdfModule = await import('pdf-parse');
    pdfParseFn = pdfModule.default || pdfModule;
  }
  return pdfParseFn;
}

const POLICIES_DIR = env.POLICIES_DIR;
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

// Ensure directory exists
if (!fs.existsSync(POLICIES_DIR)) {
  fs.mkdirSync(POLICIES_DIR, { recursive: true });
}

function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer as Buffer).digest('hex');
}

function chunkText(text: string): Array<{
  chunkIndex: number;
  pageNumber: number;
  text: string;
  wordCount: number;
}> {
  const words = text.split(/\s+/);
  const chunks = [];
  let currentChunk: string[] = [];
  let wordCount = 0;
  let chunkIndex = 0;

  // Approximate page calculation (assuming ~500 words per page)
  const wordsPerPage = 500;
  const totalPages = Math.ceil(words.length / wordsPerPage);

  for (let i = 0; i < words.length; i++) {
    currentChunk.push(words[i]);
    wordCount++;

    if (wordCount >= CHUNK_SIZE) {
      const chunkText = currentChunk.join(' ');
      const pageNumber = Math.floor(i / wordsPerPage) + 1;

      chunks.push({
        chunkIndex: chunkIndex++,
        pageNumber: Math.min(pageNumber, totalPages),
        text: chunkText,
        wordCount: wordCount,
      });

      currentChunk = currentChunk.slice(-CHUNK_OVERLAP);
      wordCount = CHUNK_OVERLAP;
    }
  }

  if (currentChunk.length > 0) {
    const pageNumber = Math.ceil(words.length / wordsPerPage);
    chunks.push({
      chunkIndex: chunkIndex++,
      pageNumber: Math.min(pageNumber, totalPages),
      text: currentChunk.join(' '),
      wordCount: currentChunk.length,
    });
  }

  return chunks;
}

async function createIndexes() {
  try {
    // Create indexes on policy tables if they don't exist
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_policy_documents_file_hash ON policy_documents ("fileHash")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_policy_documents_document_id ON policy_documents ("documentId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_policy_documents_active ON policy_documents ("isActive", "processingStatus")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_policy_chunks_document_id ON policy_chunks ("documentId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_policy_chunks_policy_id ON policy_chunks ("policyId")`);
  } catch (error: any) {
    // Indexes might already exist, ignore error
    if (!error.message?.includes('already exists')) {
      logger.warn('Index creation warning', { category: 'er', error });
    }
  }
}

export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId, userId, role, permissions }) => {
  try {
    // Authorization check - admin or supervisor
    if (!['admin', 'supervisor'].includes(role) && !permissions.includes('er.policies.upload')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const category = formData.get('category') as string || '';
    const section = formData.get('section') as string || '';
    const source = formData.get('source') as string || '';

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

    // Read file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB
    if (buffer.length > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.', code: 'FILE_TOO_LARGE' },
        { status: 413 }
      );
    }

    const fileHash = calculateFileHash(buffer);

    // Check if file already exists
    const existingDocs: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM policy_documents WHERE "tenantId" = $1 AND "fileHash" = $2 AND "isActive" = true LIMIT 1`,
      tenantId, fileHash
    );
    const existing = existingDocs[0] || null;

    if (existing) {
      return NextResponse.json(
        {
          error: 'File already exists',
          message: `A policy with this file already exists: ${existing.documentId}`,
          documentId: existing.documentId,
        },
        { status: 409 }
      );
    }

    // Parse PDF
    const pdfParseFn = await getPdfParse();
    const pdfData = await pdfParseFn(buffer);
    const text = pdfData.text || '';
    const numPages = pdfData.numpages || 0;

    if (numPages === 0) {
      return NextResponse.json(
        { error: 'PDF has no pages' },
        { status: 400 }
      );
    }

    // Generate document ID
    const documentId = `POL-${new Date().getFullYear()}-${uuidv4().substring(0, 8).toUpperCase()}`;
    const policyId = uuidv4();

    // Create storage path
    const year = new Date().getFullYear();
    const yearDir = path.join(POLICIES_DIR, year.toString());
    if (!fs.existsSync(yearDir)) {
      fs.mkdirSync(yearDir, { recursive: true });
    }

    const storageFileName = `${documentId}-${file.name}`;
    const storagePath = path.join(yearDir, storageFileName);

    // Save PDF to filesystem
    fs.writeFileSync(storagePath, buffer as Buffer);

    // Extract title
    const policyTitle = title || file.name.replace('.pdf', '').replace(/_/g, ' ');

    // Chunk text
    const textChunks = chunkText(text);

    // Save document metadata to PostgreSQL
    const now = new Date();
    await prisma.$executeRawUnsafe(
      `INSERT INTO policy_documents (id, "documentId", "fileName", "filePath", "fileHash", title, category, section, source, "totalPages", "processingStatus", "uploadedBy", "tenantId", "createdAt", "updatedAt", "isActive")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      policyId, documentId, file.name, storagePath, fileHash,
      policyTitle, category || null, section || null, source || null,
      numPages, 'completed', userId || 'system', tenantId,
      now, now, true
    );

    // Save chunks to PostgreSQL
    for (const chunk of textChunks) {
      const chunkId = uuidv4();
      await prisma.$executeRawUnsafe(
        `INSERT INTO policy_chunks (id, "policyId", "documentId", "chunkIndex", "pageNumber", text, "wordCount", "tenantId", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        chunkId, policyId, documentId, chunk.chunkIndex, chunk.pageNumber,
        chunk.text, chunk.wordCount, tenantId, now
      );
    }

    // Create indexes (idempotent)
    await createIndexes();

    return NextResponse.json({
      success: true,
      documentId,
      policyId,
      title: policyTitle,
      totalPages: numPages,
      chunks: textChunks.length,
      filePath: storagePath,
      message: `Policy uploaded and indexed successfully. ${textChunks.length} chunks created.`,
    });
  } catch (error: any) {
    logger.error('Policy upload error', { category: 'er', error });
    // [SEC-06]
    return NextResponse.json(
      { error: 'Failed to upload policy' },
      { status: 500 }
    );
  }
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.policies.upload' }
);
