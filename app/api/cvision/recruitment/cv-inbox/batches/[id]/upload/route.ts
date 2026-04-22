import { logger } from '@/lib/monitoring/logger';
/**
 * CVision CV Inbox Batch Upload API
 * POST /api/cvision/recruitment/cv-inbox/batches/:id/upload - Upload multiple CV files to batch
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
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
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST - Upload files to batch
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

      const formData = await request.formData();
      const files = formData.getAll('files') as File[];

      if (!files || files.length === 0) {
        return NextResponse.json(
          { error: 'No files provided' },
          { status: 400 }
        );
      }

      const itemCollection = await getCVisionCollection<CVisionCvInboxItem>(
        tenantId,
        'cvInboxItems'
      );

      const now = new Date();
      const items: CVisionCvInboxItem[] = [];
      const itemIds: string[] = [];

      // Create storage directory for batch
      const storageBaseDir = process.env.CVISION_STORAGE_DIR || '/tmp/cv-inbox';
      const batchStorageDir = join(storageBaseDir, batchId);
      try {
        await mkdir(batchStorageDir, { recursive: true });
      } catch (error: any) {
        // Directory might already exist, ignore
        if (error.code !== 'EEXIST') {
          logger.warn('[CV Inbox Upload] Failed to create storage directory:', error.message);
        }
      }

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

      // Process each file
      for (const file of files) {
        const fileName = file.name;
        const mimeType = file.type;
        const fileSize = file.size;

        // Validate file type
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        const allowedExtensions = ['.pdf', '.doc', '.docx'];
        const isValidType = allowedTypes.includes(mimeType) || 
          allowedExtensions.some(ext => fileName.toLowerCase().endsWith(ext));

        if (!isValidType) {
          logger.warn(`[CV Inbox Upload] Skipping invalid file type: ${fileName} (${mimeType})`);
          continue;
        }

        const itemId = uuidv4();
        const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storageKey = join(batchStorageDir, `${itemId}-${safeFileName}`);
        
        // Read file buffer and parse immediately (to avoid serverless filesystem issues)
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Try to save file to storage (optional, for future use)
        try {
          await writeFile(storageKey, buffer);
        } catch (error: any) {
          logger.warn(`[CV Inbox Upload] Failed to save file ${fileName} to disk:`, error.message);
          // Continue - we'll parse from buffer anyway
        }

        // Parse text immediately from buffer
        const parseResult = await extractTextFromBuffer(buffer, fileName, mimeType);

        // Determine status based on parse result
        let itemStatus: 'UPLOADED' | 'PARSED' = 'UPLOADED';
        let extractedRawText: string | null = null;
        let parseError: string | null = null;

        if (parseResult.error || !parseResult.text || parseResult.text.length < 300) {
          // Parsing failed - keep as UPLOADED, will retry in parse endpoint
          parseError = parseResult.error || 'TEXT_TOO_SHORT_OR_SCANNED';
          extractedRawText = parseResult.text || null;
        } else {
          // Parsing succeeded - mark as PARSED immediately
          itemStatus = 'PARSED';
          extractedRawText = parseResult.text;
        }

        const item: CVisionCvInboxItem = {
          id: itemId,
          tenantId,
          batchId,
          fileName,
          storageKey, // Storage path (may not exist if write failed)
          mimeType: mimeType || null,
          fileSize: fileSize || null,
          extractedRawText, // Parsed immediately
          status: itemStatus,
          parseError,
          suggestedRequisitionIdsJson: null,
          suggestedScoresJson: null,
          assignedRequisitionId: null,
          assignedCandidateId: null,
          assignedAt: null,
          assignedBy: null,
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
        };

        await itemCollection.insertOne(item);
        items.push(item);
        itemIds.push(itemId);
      }

      // Update batch counts (parsedCount = items successfully parsed)
      const parsedCount = items.filter(i => i.status === 'PARSED' && !i.parseError).length;
      
      await batchCollection.updateOne(
        createTenantFilter(tenantId, { id: batchId }),
        {
          $set: {
            itemCount: batch.itemCount + items.length,
            parsedCount: batch.parsedCount + parsedCount,
            updatedAt: now,
            updatedBy: userId,
          },
        }
      );

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'cv_inbox_batch_upload',
        'cv_inbox_batch',
        {
          resourceId: batchId,
          changes: {
            after: {
              filesUploaded: items.length,
              itemIds: items.map(i => i.id),
            },
          },
        }
      );

      return NextResponse.json({
        success: true,
        createdCount: items.length,
        itemIds,
      });
    } catch (error: any) {
      logger.error('[CVision CV Inbox Batch Upload POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
