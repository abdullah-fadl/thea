import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

// Force Node.js runtime (not Edge) for pdf-parse compatibility

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

// Dynamic import for pdf-parse (may not work in Edge runtime)
let pdfParse: any;
async function getPdfParse() {
  if (!pdfParse) {
    try {
      const pdfParseModule = await import('pdf-parse');
      pdfParse = pdfParseModule.default || pdfParseModule;
      logger.info('pdf-parse imported successfully, type:', { type: typeof pdfParse });

      // Verify it's a function
      if (typeof pdfParse !== 'function') {
        throw new Error('pdf-parse is not a function');
      }
    } catch (importError: any) {
      logger.error('Failed to import pdf-parse:', { error: importError });
      logger.error('Import error details:', { message: importError.message, stack: importError.stack });
      throw new Error(`PDF parsing library not available: ${importError.message}`);
    }
  }
  return pdfParse;
}

export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId, userId, role, permissions }) => {
  try {
    logger.info('AI policy upload request received');
    logger.info('User role:', { role, userId, tenantId });

    // Authorization check - admin or supervisor
    if (!['admin', 'supervisor'].includes(role) && !permissions.includes('ai.policies.upload')) {
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

    // Check if file already exists (by title containing filename) with tenant isolation
    const existingPolicy = await prisma.policy.findFirst({
      where: {
        tenantId,
        status: 'active',
        title: { contains: file.name.replace('.pdf', '') },
      },
    });

    if (existingPolicy) {
      return NextResponse.json(
        {
          error: 'File already exists',
          message: `A policy with the filename "${file.name}" already exists in the database.`,
          existingPolicyId: (existingPolicy as Record<string, unknown>).id,
          existingPolicyTitle: (existingPolicy as Record<string, unknown>).title,
        },
        { status: 409 } // Conflict status code
      );
    }

    // Read PDF file
    let arrayBuffer: ArrayBuffer;
    let buffer: Buffer;
    let pdfData: any;
    let text: string;
    let numPages: number;

    try {
      arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      logger.info('PDF file read, size:', { bytes: buffer.length });

      const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB
      if (buffer.length > MAX_UPLOAD_SIZE) {
        return NextResponse.json(
          { error: 'File too large. Maximum size is 50MB.', code: 'FILE_TOO_LARGE' },
          { status: 413 }
        );
      }

      // Validate buffer
      if (!buffer || buffer.length === 0) {
        throw new Error('PDF file is empty');
      }

      // Check if it's a valid PDF (starts with %PDF)
      const pdfHeader = buffer.toString('ascii', 0, 4);
      if (pdfHeader !== '%PDF') {
        throw new Error('File does not appear to be a valid PDF file');
      }

      // Parse PDF
      const pdfParseFn = await getPdfParse();

      // Parse PDF (pdf-parse function signature)
      pdfData = await pdfParseFn(buffer);

      text = pdfData.text || '';
      numPages = pdfData.numpages || 0;

      logger.info('PDF parsed successfully, pages:', { numPages, textLength: text.length });

      if (!text || text.trim().length === 0) {
        logger.warn('PDF parsed but contains no text (may be image-based or encrypted)');
      }

      if (numPages === 0) {
        throw new Error('PDF file contains no pages');
      }
    } catch (parseError: any) {
      logger.error('PDF parsing error:', { error: parseError });

      let errorMessage = 'Failed to parse PDF file';
      let errorDetails = parseError.message || parseError.toString() || 'The PDF file may be corrupted or invalid';

      // More specific error detection
      const errorStr = String(parseError.message || parseError.toString() || '').toLowerCase();

      if (errorStr.includes('password') || errorStr.includes('encrypted') || errorStr.includes('decrypt')) {
        errorMessage = 'PDF file is password protected';
        errorDetails = 'The PDF file is encrypted and requires a password to open. Please remove the password protection and try again.';
      } else if (errorStr.includes('invalid') || errorStr.includes('corrupted') || errorStr.includes('malformed')) {
        errorMessage = 'Invalid or corrupted PDF file';
        errorDetails = 'The PDF file may be corrupted or in an unsupported format. Please try opening it in a PDF viewer first.';
      } else if (errorStr.includes('not a pdf') || errorStr.includes('pdf header')) {
        errorMessage = 'Not a valid PDF file';
        errorDetails = 'The file does not appear to be a valid PDF file. Please ensure the file is a PDF document.';
      } else if (errorStr.includes('memory') || errorStr.includes('too large')) {
        errorMessage = 'PDF file is too large';
        errorDetails = 'The PDF file is too large to process. Please try a smaller file or split it into multiple files.';
      }

      // [SEC-06]
      return NextResponse.json(
        {
          error: errorMessage,
          message: errorDetails,
          fileName: file.name,
          fileSize: file.size,
        },
        { status: 400 }
      );
    }

    // Extract title from filename if not provided
    const policyTitle = title || file.name.replace('.pdf', '').replace(/_/g, ' ');

    // Split text into pages (approximate)
    const lines = text.split('\n');
    const linesPerPage = Math.ceil(lines.length / numPages);
    const pages: Array<{ pageNumber: number; content: string }> = [];

    for (let i = 0; i < numPages; i++) {
      const startLine = i * linesPerPage;
      const endLine = Math.min((i + 1) * linesPerPage, lines.length);
      const pageContent = lines.slice(startLine, endLine).join('\n').trim();

      if (pageContent) {
        pages.push({
          pageNumber: i + 1,
          content: pageContent,
        });
      }
    }

    // Save policy to database
    let createdPolicy: any;
    try {
      createdPolicy = await prisma.policy.create({
        data: {
          title: policyTitle,
          category: category || null,
          content: text,
          status: 'active',
          createdBy: userId,
          tenantId,
        },
      });
      logger.info('Main policy saved, ID:', { policyId: createdPolicy.id });
    } catch (dbError: any) {
      logger.error('Database insert error:', { error: dbError });
      return NextResponse.json(
        {
          error: 'Failed to save policy to database',
          message: 'Database error occurred',
        },
        { status: 500 }
      );
    }

    // Also save individual pages as separate policies for better search
    let pagePoliciesCount = 0;
    if (pages.length > 0) {
      try {
        for (const page of pages) {
          await prisma.policy.create({
            data: {
              title: `${policyTitle} - Page ${page.pageNumber}`,
              category: category || null,
              content: page.content,
              status: 'active',
              createdBy: userId,
              tenantId,
            },
          });
          pagePoliciesCount++;
        }
        logger.info('Page policies saved, count:', { count: pagePoliciesCount });
      } catch (dbError: any) {
        logger.error('Database page insert error:', { error: dbError });
        // Don't fail the whole request if page policies fail, main policy is already saved
        logger.warn('Warning: Failed to save page policies, but main policy was saved');
      }
    }

    return NextResponse.json({
      success: true,
      policyId: createdPolicy.id,
      title: policyTitle,
      totalPages: numPages,
      pagesExtracted: pages.length,
      totalPoliciesCreated: pagePoliciesCount + 1, // +1 for the main policy
      message: `Policy uploaded successfully. Extracted ${numPages} pages.`,
    });
  } catch (error: any) {
    logger.error('PDF upload error:', { error: error });

    // Provide more detailed error messages
    let errorMessage = 'Failed to upload PDF';
    let errorDetails = error.message || 'Unknown error';

    if (error.message?.includes('pdf-parse')) {
      errorMessage = 'Failed to parse PDF file';
      errorDetails = 'The PDF file may be corrupted or invalid';
    } else if (error.message?.includes('ENOENT')) {
      errorMessage = 'File not found';
      errorDetails = 'The uploaded file could not be processed';
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Upload timeout';
      errorDetails = 'The file is too large or the server is taking too long to process';
    }

    return NextResponse.json(
      {
        error: errorMessage,
        message: errorDetails,
      },
      { status: 500 }
    );
  }
}),
  { tenantScoped: true, permissionKey: 'ai.policies.upload' });
