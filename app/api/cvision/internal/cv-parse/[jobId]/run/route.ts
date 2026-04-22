import { logger } from '@/lib/monitoring/logger';
/**
 * CVision CV Parse Runner API (Dev-Only)
 * POST /api/cvision/internal/cv-parse/:jobId/run - Run CV parsing job
 *
 * Phase 1 Scope: Raw Text Extraction Only
 * - Extract RAW TEXT from PDF/DOC/DOCX reliably
 * - Status DONE only if rawText length > 300 chars
 *
 * Phase 2 Scope: Structured Data Extraction (Regex)
 * - Extract structured fields from raw text using regex patterns
 * - Fields: email, phone, fullName, education, skills, yearsOfExperience,
 *   nationality, languages
 * - Supports both English and Arabic CVs
 * - Stores results in extractedJson field
 *
 * Phase 3 (future): Semantic extraction will be added using AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  findById,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { extractStructuredData, type CvStructuredData } from '@/lib/cvision/cv-structured-extract';
import type {
  CVisionCvParseJob,
  CVisionCandidateDocument,
} from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// extractStructuredData + CvStructuredData imported from @/lib/cvision/cv-structured-extract.ts

/**
 * CV Parsing Logic - Phase 1: Raw Text Extraction Only
 *
 * Phase 1 Scope:
 * - Extract RAW TEXT from PDF/DOC/DOCX reliably
 * - Store metadata: pages, mimeType, parserVersion
 *
 * Phase 2 (regex extraction) is handled by extractStructuredData() above and
 * invoked after Phase 1 succeeds in the POST handler.
 *
 * Phase 3 (future): Semantic extraction will be added using AI
 */
async function parseCv(
  document: CVisionCandidateDocument,
  tenantId: string,
  fileContent?: string
): Promise<{
  extractedRawText: string;
  metaJson: Record<string, any>;
  errors: string | null;
}> {
  const PARSER_VERSION = '1.0.0-phase1';
  const MIN_TEXT_LENGTH = 300;
  
  try {
    let extractedRawText = '';
    let pageCount = 0;
    let parserUsed = 'unknown';

    // Try to extract text from document.extractedText first (pre-extracted by upload endpoint)
    if (document.extractedText && document.extractedText.trim().length > 0) {
      extractedRawText = document.extractedText.trim();
      parserUsed = 'pre-extracted';
      logger.info('[CV Parse Phase 1] Using pre-extracted text:', extractedRawText.length, 'characters');
    } 
    // Try to extract from fileContent (if file was read from storage)
    else if (fileContent && fileContent.trim().length > 0) {
      extractedRawText = fileContent.trim();
      parserUsed = 'file-content';
      logger.info('[CV Parse Phase 1] Using file content:', extractedRawText.length, 'characters');
    }
    // Try to read file from storageKey if available
    else if (document.storageKey && document.storageKey.startsWith('/tmp/')) {
      try {
        const fs = await import('fs/promises');
        const filePath = document.storageKey;
        
        // Check if file exists
        try {
          await fs.access(filePath);
        } catch {
          throw new Error(`File not found at ${filePath}`);
        }

        // Extract based on file type
        if (document.mimeType === 'application/pdf' || document.fileName.endsWith('.pdf')) {
          try {
            const pdfParseModule = await import('pdf-parse');
            
            // Get PDFParse class (pdf-parse v2+)
            let PDFParseClass: any;
            if (pdfParseModule.PDFParse) {
              PDFParseClass = pdfParseModule.PDFParse;
            } else if (pdfParseModule.default && pdfParseModule.default.PDFParse) {
              PDFParseClass = pdfParseModule.default.PDFParse;
            } else if (pdfParseModule.default && typeof pdfParseModule.default === 'function') {
              PDFParseClass = pdfParseModule.default;
            } else {
              throw new Error('PDFParse class not found in pdf-parse module');
            }
            
            const fileBuffer = await fs.readFile(filePath);
            const parser = new PDFParseClass({ data: fileBuffer });
            const result = await parser.getText();
            extractedRawText = (result?.text || result?.content || result || '').trim();
            
            // Clean up parser
            await parser.destroy().catch(() => {
              // Ignore destroy errors
            });
            pageCount = result?.numpages || result?.numPages || 0;
            parserUsed = 'pdf-parse';
            
            // Check if PDF is image-only (scanned)
            if (extractedRawText.length < MIN_TEXT_LENGTH && pageCount > 0) {
              // Likely scanned PDF - check if text is mostly empty
              const nonWhitespaceChars = extractedRawText.replace(/\s/g, '').length;
              if (nonWhitespaceChars < MIN_TEXT_LENGTH * 0.1) {
                throw new Error('Scanned PDF not supported yet. Please provide a text-based PDF.');
              }
            }
            
            logger.info('[CV Parse Phase 1] Extracted from PDF:', extractedRawText.length, 'characters,', pageCount, 'pages');
          } catch (pdfError: any) {
            // If pdf-parse fails, check if it's a scanned PDF
            if (pdfError.message?.includes('No text') || pdfError.message?.includes('empty')) {
              throw new Error('Scanned PDF not supported yet. Please provide a text-based PDF.');
            }
            throw pdfError;
          }
        } 
        else if (document.mimeType?.includes('word') || document.fileName.endsWith('.docx')) {
          try {
            const mammoth = await import('mammoth');
            const fileBuffer = await fs.readFile(filePath);
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            extractedRawText = result.value.trim();
            parserUsed = 'mammoth-docx';
            // Estimate page count (rough: ~500 chars per page)
            pageCount = Math.max(1, Math.ceil(extractedRawText.length / 500));
            logger.info('[CV Parse Phase 1] Extracted from DOCX:', extractedRawText.length, 'characters');
          } catch (docxError: any) {
            throw new Error(`DOCX parsing failed: ${docxError.message}`);
          }
        }
        else if (document.fileName.endsWith('.doc')) {
          // .doc files require different library (not implemented in Phase 1)
          throw new Error('Legacy .doc format not supported. Please convert to .docx or PDF.');
        }
        else {
          // Try plain text read for other formats
          try {
            extractedRawText = (await fs.readFile(filePath, 'utf-8')).trim();
            parserUsed = 'text-read';
            pageCount = Math.max(1, Math.ceil(extractedRawText.split('\n').length / 50));
            logger.info('[CV Parse Phase 1] Read as text:', extractedRawText.length, 'characters');
          } catch (textError: any) {
            throw new Error(`Text read failed: ${textError.message}`);
          }
        }
      } catch (fileError: any) {
        const errorMsg = fileError.message || 'File read failed';
        logger.error('[CV Parse Phase 1] File extraction error:', errorMsg);
        return {
          extractedRawText: '',
          metaJson: {
            pages: 0,
            mimeType: document.mimeType || 'unknown',
            parserVersion: PARSER_VERSION,
            parserUsed: 'none',
            fileName: document.fileName,
          },
          errors: errorMsg,
        };
      }
    }
    else {
      // No file content available - check if we have extractedText but it wasn't used
      if (document.extractedText && document.extractedText.trim().length > 0) {
        // This shouldn't happen, but handle it gracefully
        extractedRawText = document.extractedText.trim();
        parserUsed = 'pre-extracted-fallback';
        logger.info('[CV Parse Phase 1] Using extractedText as fallback:', extractedRawText.length, 'characters');
      } else {
        // No file content available
        return {
          extractedRawText: '',
          metaJson: {
            pages: 0,
            mimeType: document.mimeType || 'unknown',
            parserVersion: PARSER_VERSION,
            parserUsed: 'none',
            fileName: document.fileName,
          },
          errors: 'No file content available for extraction. Please ensure the file was uploaded correctly and extractedText is provided.',
        };
      }
    }

    // Validate extracted text length
    if (extractedRawText.length < MIN_TEXT_LENGTH) {
      const errorMsg = `Extracted text too short (${extractedRawText.length} chars, minimum ${MIN_TEXT_LENGTH}). File may be corrupted, empty, or image-only.`;
      logger.warn('[CV Parse Phase 1]', errorMsg);
      return {
        extractedRawText: extractedRawText, // Keep what we have for debugging
        metaJson: {
          pages: pageCount,
          mimeType: document.mimeType || 'unknown',
          parserVersion: PARSER_VERSION,
          parserUsed,
          fileName: document.fileName,
          fileSize: document.fileSize || null,
        },
        errors: errorMsg,
      };
    }

    // Success: return raw text and metadata
    const metaJson = {
      pages: pageCount,
      mimeType: document.mimeType || 'unknown',
      parserVersion: PARSER_VERSION,
      parserUsed,
      fileName: document.fileName,
      fileSize: document.fileSize || null,
      extractedAt: new Date().toISOString(),
      textLength: extractedRawText.length,
    };

    logger.info('[CV Parse Phase 1] Success:', {
      textLength: extractedRawText.length,
      pages: pageCount,
      parserUsed,
      mimeType: document.mimeType,
    });

    return {
      extractedRawText,
      metaJson,
      errors: null,
    };
  } catch (error: any) {
    logger.error('[CV Parse Phase 1] Error:', error?.message || String(error));
    return {
      extractedRawText: '',
      metaJson: {
        pages: 0,
        mimeType: document.mimeType || 'unknown',
        parserVersion: PARSER_VERSION,
        parserUsed: 'none',
        fileName: document.fileName,
      },
      errors: `Parsing failed: ${error?.message || String(error)}`,
    };
  }
}

// POST - Run CV parsing job
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      // Dev-only check (in production, this would be behind admin auth)
      const isDev = process.env.NODE_ENV === 'development';
      if (!isDev) {
        return NextResponse.json(
          { error: 'This endpoint is only available in development' },
          { status: 403 }
        );
      }

      const resolvedParams = await params;
      const jobId = resolvedParams?.jobId as string;

      if (!jobId) {
        return NextResponse.json(
          { error: 'Job ID is required' },
          { status: 400 }
        );
      }

      const parseJobCollection = await getCVisionCollection<CVisionCvParseJob>(
        tenantId,
        'cvParseJobs'
      );
      const documentCollection = await getCVisionCollection<CVisionCandidateDocument>(
        tenantId,
        'candidateDocuments'
      );

      // Get parse job
      const parseJob = await findById(parseJobCollection, tenantId, jobId);
      if (!parseJob) {
        return NextResponse.json(
          { error: 'Parse job not found' },
          { status: 404 }
        );
      }

      // Check if already processed
      if (parseJob.status === 'DONE') {
        return NextResponse.json({
          success: true,
          message: 'Job already completed',
          parseJob: {
            id: parseJob.id,
            status: parseJob.status,
            extractedRawText: parseJob.extractedRawText,
            metaJson: parseJob.metaJson,
            // Backward compatibility
            extractedText: parseJob.extractedRawText || parseJob.extractedText,
            extractedJson: parseJob.extractedJson,
          },
        });
      }

      if (parseJob.status === 'FAILED') {
        return NextResponse.json(
          {
            error: 'Job previously failed',
            parseJob: {
              id: parseJob.id,
              status: parseJob.status,
              errors: parseJob.errors,
            },
          },
          { status: 400 }
        );
      }

      // Get document
      const document = await findById(documentCollection, tenantId, parseJob.documentId);
      if (!document) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }

      // Note: File reading is now handled inside parseCv function
      // We pass empty string here - parseCv will handle file reading if needed
      const fileContent = '';

      // Update job status to processing (implicitly QUEUED -> processing)
      const startedAt = new Date();
      await parseJobCollection.updateOne(
        createTenantFilter(tenantId, { id: jobId }),
        {
          $set: {
            status: 'QUEUED', // Keep as QUEUED during processing
            startedAt,
            updatedAt: startedAt,
            updatedBy: userId,
          },
        }
      );

      // Parse CV (Phase 1: Raw text extraction only)
      const parseResult = await parseCv(document, tenantId, fileContent);

      const completedAt = new Date();
      
      // Determine status: DONE only if raw text length > threshold and no errors
      const MIN_TEXT_LENGTH = 300;
      const hasValidText = parseResult.extractedRawText && parseResult.extractedRawText.length >= MIN_TEXT_LENGTH;
      const finalStatus: 'DONE' | 'FAILED' = (parseResult.errors || !hasValidText) ? 'FAILED' : 'DONE';
      
      // If failed but we have some text, include it in error message
      let finalError = parseResult.errors;
      if (finalStatus === 'FAILED' && !finalError) {
        finalError = `Extracted text too short (${parseResult.extractedRawText?.length || 0} chars, minimum ${MIN_TEXT_LENGTH})`;
      }

      // -----------------------------------------------------------------------
      // Phase 2: Structured data extraction (regex-based)
      // Only run when Phase 1 succeeded (we have valid raw text)
      // -----------------------------------------------------------------------
      let structuredData: CvStructuredData | null = null;
      if (finalStatus === 'DONE' && parseResult.extractedRawText) {
        try {
          structuredData = extractStructuredData(parseResult.extractedRawText);
          logger.info('[CV Parse Phase 2] Structured extraction complete:', {
            hasEmail: !!structuredData.email,
            hasPhone: !!structuredData.phone,
            hasName: !!structuredData.fullName,
            educationCount: structuredData.education?.length ?? 0,
            skillsCount: structuredData.skills?.length ?? 0,
            yearsOfExperience: structuredData.yearsOfExperience,
            hasNationality: !!structuredData.nationality,
            languagesCount: structuredData.languages?.length ?? 0,
          });
        } catch (phase2Error: any) {
          // Phase 2 failure is non-fatal -- log and continue with null
          logger.warn('[CV Parse Phase 2] Extraction error (non-fatal):', phase2Error?.message || String(phase2Error));
          structuredData = null;
        }
      }

      // Build the extractedJson payload (Phase 2 structured data)
      const extractedJson: Record<string, any> | null = structuredData
        ? {
            ...structuredData,
            _extractionVersion: '2.0.0-phase2',
            _extractedAt: new Date().toISOString(),
          }
        : null;

      // Update parse job with results
      await parseJobCollection.updateOne(
        createTenantFilter(tenantId, { id: jobId }),
        {
          $set: {
            status: finalStatus,
            extractedRawText: parseResult.extractedRawText || null,
            metaJson: parseResult.metaJson || null,
            // Keep deprecated fields for backward compatibility (will be removed in Phase 3)
            extractedText: parseResult.extractedRawText || null,
            extractedJson, // Phase 2: Regex-based structured extraction
            errors: finalError,
            completedAt,
            updatedAt: completedAt,
            updatedBy: userId,
          },
        }
      );

      // Update document with extracted text
      if (parseResult.extractedRawText) {
        await documentCollection.updateOne(
          createTenantFilter(tenantId, { id: document.id }),
          {
            $set: {
              extractedText: parseResult.extractedRawText,
              updatedAt: completedAt,
              updatedBy: userId,
            },
          }
        );
      }

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'cv_parse_job_run',
        'cv_parse_job',
        {
          resourceId: jobId,
          changes: {
            before: { status: 'QUEUED' },
            after: {
              status: finalStatus,
              extractedRawTextLength: parseResult.extractedRawText?.length || 0,
              metaJson: parseResult.metaJson,
              errors: finalError,
              phase2Extracted: !!structuredData,
              phase2Fields: structuredData
                ? {
                    hasEmail: !!structuredData.email,
                    hasPhone: !!structuredData.phone,
                    hasName: !!structuredData.fullName,
                    educationCount: structuredData.education?.length ?? 0,
                    skillsCount: structuredData.skills?.length ?? 0,
                    yearsOfExperience: structuredData.yearsOfExperience,
                    hasNationality: !!structuredData.nationality,
                    languagesCount: structuredData.languages?.length ?? 0,
                  }
                : null,
            },
          },
        }
      );

      const updatedJob = await findById(parseJobCollection, tenantId, jobId);

      return NextResponse.json({
        success: true,
        parseJob: {
          id: updatedJob!.id,
          status: updatedJob!.status,
          extractedRawText: updatedJob!.extractedRawText,
          metaJson: updatedJob!.metaJson,
          // Backward compatibility
          extractedText: updatedJob!.extractedRawText || updatedJob!.extractedText,
          extractedJson: updatedJob!.extractedJson,
          errors: updatedJob!.errors,
          startedAt: updatedJob!.startedAt,
          completedAt: updatedJob!.completedAt,
        },
      });
    } catch (error: any) {
      logger.error('[CVision CV Parse Run POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
