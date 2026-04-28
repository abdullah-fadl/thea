import { logger } from '@/lib/monitoring/logger';
/**
 * CVision CV Text Extraction API
 * POST /api/cvision/recruitment/extract-cv-text - Extract text from CV file
 * 
 * Extracts text from PDF/DOC/DOCX files using server-side libraries.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST - Extract text from CV file
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role }) => {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }

      const fileName = file.name;
      const mimeType = file.type;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      let extractedText = '';

      try {
        if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
          // Parse PDF using pdf-parse v2+
          // Use require for CommonJS module (more reliable in Next.js API routes)
          let PDFParseClass: any;
          
          try {
            // Use dynamic import (works with serverComponentsExternalPackages)
            const pdfParseModule = await import('pdf-parse');
            
            // Get PDFParse class
            if (pdfParseModule.PDFParse) {
              PDFParseClass = pdfParseModule.PDFParse;
            } else if (pdfParseModule.default) {
              if (pdfParseModule.default.PDFParse) {
                PDFParseClass = pdfParseModule.default.PDFParse;
              } else if (typeof pdfParseModule.default === 'function') {
                PDFParseClass = pdfParseModule.default;
              } else {
                PDFParseClass = pdfParseModule.default;
              }
            } else {
              // Search for PDFParse in exports
              const exports = Object.values(pdfParseModule);
              PDFParseClass = exports.find((exp: any) => 
                exp && (exp.name === 'PDFParse' || exp.toString().includes('class PDFParse'))
              );
              if (!PDFParseClass) {
                PDFParseClass = exports.find((exp: any) => typeof exp === 'function');
              }
            }
            
            if (!PDFParseClass) {
              logger.error('[CV Extract] pdf-parse module structure:', {
                hasPDFParse: !!pdfParseModule.PDFParse,
                hasDefault: !!pdfParseModule.default,
                defaultType: typeof pdfParseModule.default,
                keys: Object.keys(pdfParseModule),
              });
              throw new Error('PDFParse class not found in pdf-parse module');
            }
          } catch (importError: any) {
            logger.error('[CV Extract] Failed to import pdf-parse:', importError);
            logger.error('[CV Extract] Error details:', {
              message: importError.message,
              stack: importError.stack,
              name: importError.name,
            });
            throw new Error(`Failed to import pdf-parse: ${importError.message}`);
          }
          
          if (!PDFParseClass) {
            throw new Error('PDFParse class not found');
          }
          
          // Ensure buffer is valid
          if (!Buffer.isBuffer(buffer)) {
            throw new Error('Invalid buffer provided to pdf-parse');
          }
          
          // Create PDFParse instance and extract text
          const parser = new PDFParseClass({ data: buffer });
          const result = await parser.getText();
          
          // Extract text from result
          if (typeof result === 'string') {
            extractedText = result;
          } else if (result && typeof result === 'object') {
            extractedText = result.text || result.content || '';
          } else {
            extractedText = String(result || '');
          }
          
          // Clean up parser
          await parser.destroy().catch(() => {
            // Ignore destroy errors
          });
          
          logger.info('[CV Extract] Extracted text from PDF:', extractedText.length, 'characters');
        } else if (
          mimeType?.includes('word') ||
          fileName.endsWith('.docx') ||
          fileName.endsWith('.doc')
        ) {
          // Parse DOCX using mammoth
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ buffer });
          extractedText = result.value || '';
          logger.info('[CV Extract] Extracted text from DOCX:', extractedText.length, 'characters');
        } else {
          // Try to read as text for other formats
          extractedText = buffer.toString('utf-8');
        }
      } catch (parseError: any) {
        logger.error('[CV Extract] Parsing error:', parseError.message);
        logger.error('[CV Extract] Error stack:', parseError.stack);
        return NextResponse.json(
          {
            success: false,
            error: `Failed to extract text: ${parseError.message}`,
            extractedText: '',
          },
          { status: 500 }
        );
      }

      if (!extractedText || extractedText.trim().length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'No text could be extracted from the file',
            extractedText: '',
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        extractedText: extractedText.substring(0, 100000), // Limit to 100KB
        fileName,
        mimeType,
      });
    } catch (error: any) {
      logger.error('[CV Extract POST]', error?.message || String(error));
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
          message: error.message,
          extractedText: '',
        },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
