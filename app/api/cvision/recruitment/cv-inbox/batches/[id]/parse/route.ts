import { logger } from '@/lib/monitoring/logger';
/**
 * CVision CV Inbox Batch Parse API
 * POST /api/cvision/recruitment/cv-inbox/batches/:id/parse - Extract raw text for all items
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
import type { CVisionCvInboxBatch, CVisionCvInboxItem } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canAccessCvInbox } from '@/lib/cvision/authz/policy';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Extract text from file buffer (Phase 1: Raw text only)
 */
async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType?: string | null
): Promise<{ text: string; error?: string }> {
  try {
    let extractedText = '';

    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
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
      
      const parser = new PDFParseClass({ data: buffer });
      const result = await parser.getText();
      extractedText = (result?.text || result?.content || result || '').trim();
      
      // Clean up parser
      await parser.destroy().catch(() => {
        // Ignore destroy errors
      });
    } else if (
      mimeType?.includes('word') ||
      fileName.endsWith('.docx')
    ) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value.trim();
    } else if (fileName.endsWith('.doc')) {
      // .doc files are not supported in Phase 1
      return {
        text: '',
        error: 'DOC format not supported. Please convert to DOCX or PDF.',
      };
    } else {
      extractedText = buffer.toString('utf-8').trim();
    }

    const MIN_TEXT_LENGTH = 300;
    if (extractedText.length < MIN_TEXT_LENGTH) {
      return {
        text: extractedText,
        error: `TEXT_TOO_SHORT_OR_SCANNED: Extracted text too short (${extractedText.length} chars, minimum ${MIN_TEXT_LENGTH}). Scanned PDFs not supported yet.`,
      };
    }

    return { text: extractedText };
  } catch (error: any) {
    return {
      text: '',
      error: `Parsing failed: ${error.message}`,
    };
  }
}

// POST - Parse all items in batch
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      // Build authz context
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult; // 401 or 403
      }
      const ctx = ctxResult;

      // Check permission (HR roles only - CV Inbox access)
      const cvInboxPolicy = canAccessCvInbox(ctx);
      const enforceResult = await enforce(cvInboxPolicy, request, ctx);
      if (enforceResult) {
        return enforceResult; // 403
      }

      const resolvedParams = await params;
      const batchId = resolvedParams?.id as string;

      if (!batchId) {
        return NextResponse.json(
          { error: 'Batch ID is required' },
          { status: 400 }
        );
      }

      // Verify batch exists
      const batchCollection = await getCVisionCollection<CVisionCvInboxBatch>(
        tenantId,
        'cvInboxBatches'
      );
      const batch = await findById(batchCollection, tenantId, batchId);
      if (!batch) {
        return NextResponse.json(
          { error: 'Batch not found' },
          { status: 404 }
        );
      }

      const itemCollection = await getCVisionCollection<CVisionCvInboxItem>(
        tenantId,
        'cvInboxItems'
      );

      // Get all UPLOADED items or PARSED items with parseError (items that need parsing or re-parsing)
      const items = await itemCollection
        .find(createTenantFilter(tenantId, { 
          batchId, 
          $or: [
            { status: 'UPLOADED' },
            { status: 'PARSED', parseError: { $ne: null } }
          ]
        }))
        .toArray();

      // Filter: only process UPLOADED or PARSED items with parseError (failed)
      const itemsToParse = items.filter(item => 
        item.status === 'UPLOADED' || 
        (item.status === 'PARSED' && item.parseError)
      );

      if (itemsToParse.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No items to parse. All items are already parsed or require file re-upload.',
          parsed: 0,
          failed: 0,
        });
      }

      const now = new Date();
      let parsedCount = 0;
      let failedCount = 0;

      // Parse each item by reading from storageKey
      for (const item of itemsToParse) {
        if (!item.storageKey) {
          logger.warn(`[CV Inbox Parse] Item ${item.id} has no storageKey`);
          failedCount++;
          await itemCollection.updateOne(
            createTenantFilter(tenantId, { id: item.id }),
            {
              $set: {
                parseError: 'File storage key not found',
                status: 'PARSED', // Mark as parsed but failed
                updatedAt: now,
                updatedBy: userId,
              },
            }
          );
          continue;
        }

        // Read file from storage
        let buffer: Buffer;
        try {
          if (!item.storageKey) {
            throw new Error('Storage key not set');
          }
          if (!existsSync(item.storageKey)) {
            throw new Error(`File not found at ${item.storageKey}. File may have been uploaded in a previous serverless invocation. Please re-upload the file.`);
          }
          buffer = await readFile(item.storageKey);
        } catch (error: any) {
          logger.error(`[CV Inbox Parse] Failed to read file for item ${item.id}:`, error.message);
          failedCount++;
          await itemCollection.updateOne(
            createTenantFilter(tenantId, { id: item.id }),
            {
              $set: {
                parseError: `File read failed: ${error.message}`,
                status: 'PARSED', // Mark as parsed but failed
                updatedAt: now,
                updatedBy: userId,
              },
            }
          );
          continue;
        }

        // Extract text from buffer
        const result = await extractTextFromBuffer(buffer, item.fileName, item.mimeType);

        if (result.error || !result.text || result.text.length < 300) {
          // Mark as PARSED but with error (status remains PARSED, but parseError is set)
          await itemCollection.updateOne(
            createTenantFilter(tenantId, { id: item.id }),
            {
              $set: {
                extractedRawText: result.text || null, // Keep partial text for debugging
                parseError: result.error || 'TEXT_TOO_SHORT_OR_SCANNED',
                status: 'PARSED', // Status is PARSED but with error
                updatedAt: now,
                updatedBy: userId,
              },
            }
          );
          failedCount++;
        } else {
          // Mark as PARSED and store extracted text
          await itemCollection.updateOne(
            createTenantFilter(tenantId, { id: item.id }),
            {
              $set: {
                extractedRawText: result.text,
                parseError: null,
                status: 'PARSED',
                updatedAt: now,
                updatedBy: userId,
              },
            }
          );
          parsedCount++;
        }
      }

      // Update batch parsedCount (count only successfully parsed items)
      const currentParsedCount = await itemCollection.countDocuments(
        createTenantFilter(tenantId, { 
          batchId, 
          status: 'PARSED',
          parseError: null, // Only count successful parses
        })
      );

      await batchCollection.updateOne(
        createTenantFilter(tenantId, { id: batchId }),
        {
          $set: {
            parsedCount: currentParsedCount,
            updatedAt: now,
            updatedBy: userId,
          },
        }
      );

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'cv_inbox_batch_parse',
        'cv_inbox_batch',
        {
          resourceId: batchId,
          changes: {
            after: {
              parsedCount,
              failedCount,
              totalItems: items.length,
            },
          },
        }
      );

      return NextResponse.json({
        success: true,
        parsed: parsedCount,
        failed: failedCount,
        totalItems: itemsToParse.length,
      });
    } catch (error: any) {
      logger.error('[CVision CV Inbox Batch Parse POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
