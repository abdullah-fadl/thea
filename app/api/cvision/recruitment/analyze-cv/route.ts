import { logger } from '@/lib/monitoring/logger';
/**
 * CVision CV Analysis API
 * POST /api/cvision/recruitment/analyze-cv - Analyze CV and extract data + suggest positions
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { getCVisionCollection } from '@/lib/cvision/db';
import { analyzeCV, matchToPositions } from '@/lib/ai/cv-analyzer';
import type { CVisionDepartment, CVisionJobTitle } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST - Analyze CV text and suggest positions
export const POST = withAuthTenant(
  async (request, { tenantId }) => {
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

      logger.info('[CV Analyze] Processing:', { fileName, mimeType, size: buffer.length });

      // Step 1: Extract text from file
      let extractedText = '';

      try {
        if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
          // Parse PDF
          const pdfParseModule = await import('pdf-parse');
          let PDFParseClass: any = pdfParseModule.PDFParse || pdfParseModule.default?.PDFParse || pdfParseModule.default;

          if (typeof PDFParseClass === 'function') {
            const parser = new PDFParseClass({ data: buffer });
            const result = await parser.getText();
            extractedText = typeof result === 'string' ? result : (result?.text || result?.content || '');
            await parser.destroy().catch(() => {});
          }
        } else if (
          mimeType?.includes('word') ||
          fileName.endsWith('.docx') ||
          fileName.endsWith('.doc')
        ) {
          // Parse DOCX
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ buffer });
          extractedText = result.value || '';
        } else {
          extractedText = buffer.toString('utf-8');
        }
      } catch (parseError: any) {
        logger.error('[CV Analyze] Parse error:', parseError.message);
        return NextResponse.json(
          { error: 'Failed to extract text from file', message: parseError.message },
          { status: 500 }
        );
      }

      if (!extractedText || extractedText.trim().length < 50) {
        return NextResponse.json(
          { error: 'Could not extract sufficient text from file' },
          { status: 400 }
        );
      }

      logger.info('[CV Analyze] Extracted text length:', extractedText.length);

      // Step 2: Analyze CV with AI
      const cvAnalysis = await analyzeCV(extractedText, fileName);

      logger.info('[CV Analyze] Analysis result:', {
        name: cvAnalysis.fullName,
        email: cvAnalysis.email,
        phone: cvAnalysis.phone,
        skills: cvAnalysis.skills?.length || 0,
      });

      // Step 3: Load departments and job titles for matching
      const deptCollection = await getCVisionCollection<CVisionDepartment>(tenantId, 'departments');
      const jobTitleCollection = await getCVisionCollection<CVisionJobTitle>(tenantId, 'jobTitles');

      const departments = await deptCollection
        .find({ tenantId, isActive: { $ne: false } })
        .toArray();

      const jobTitles = await jobTitleCollection
        .find({ tenantId, isActive: { $ne: false } })
        .toArray();

      logger.info('[CV Analyze] Loaded:', {
        departments: departments.length,
        jobTitles: jobTitles.length,
      });

      // Step 4: Match to positions
      const positionMatches = await matchToPositions(
        cvAnalysis,
        departments.map(d => ({ id: d.id, name: d.name, nameAr: d.nameAr })),
        jobTitles.map(j => ({
          id: j.id,
          name: j.name,
          nameAr: j.nameAr,
          departmentId: j.departmentId,
          requirements: j.requirements,
        }))
      );

      logger.info('[CV Analyze] Position matches:', positionMatches.length);

      return NextResponse.json({
        success: true,
        analysis: cvAnalysis,
        positionMatches,
        extractedText: extractedText.substring(0, 5000), // Return first 5k chars
      });
    } catch (error: any) {
      logger.error('[CV Analyze POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
