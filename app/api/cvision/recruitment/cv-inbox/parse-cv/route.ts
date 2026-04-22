import { logger } from '@/lib/monitoring/logger';
/**
 * CVision CV Parser API (AI-Powered)
 *
 * POST /api/cvision/recruitment/cv-inbox/parse-cv
 *
 * Uses Claude/OpenAI to intelligently parse CVs and suggest positions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { analyzeCV, matchToPositions } from '@/lib/ai/cv-analyzer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Department {
  id: string;
  name: string;
  nameAr?: string;
}

interface JobTitle {
  id: string;
  name: string;
  nameAr?: string;
  departmentId?: string;
  requirements?: string[];
  skills?: string[];
}

export const POST = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const body = await request.json();
      const {
        fileName,
        rawText,
        departments = [],
        jobTitles = []
      } = body;

      if (!fileName) {
        return NextResponse.json(
          { success: false, error: 'File name is required' },
          { status: 400 }
        );
      }

      logger.info('[CV Parse] Starting AI analysis:', {
        tenantId,
        fileName,
        textLength: rawText?.length || 0,
        deptCount: departments.length,
        jobCount: jobTitles.length,
      });

      // Step 1: Analyze CV with AI
      const parsed = await analyzeCV(rawText || '', fileName);

      // Step 2: Match to positions with AI
      const suggestions = await matchToPositions(
        parsed,
        departments as Department[],
        jobTitles as JobTitle[]
      );

      logger.info('[CV Parse] AI analysis complete:', {
        tenantId,
        fileName,
        parsedName: parsed.fullName,
        skillsCount: parsed.skills?.length || 0,
        suggestionsCount: suggestions.length,
        topScore: suggestions[0]?.matchScore || 0,
      });

      return NextResponse.json({
        success: true,
        parsed: {
          fullName: parsed.fullName,
          email: parsed.email,
          phone: parsed.phone,
          summary: parsed.summary,
          skills: parsed.skills,
          experience: parsed.experience.map(e =>
            `${e.title} at ${e.company} (${e.duration})`
          ),
          education: parsed.education.map(e =>
            `${e.degree} - ${e.institution}${e.year ? ` (${e.year})` : ''}`
          ),
          yearsOfExperience: parsed.yearsOfExperience,
          nationality: parsed.nationality,
          languages: parsed.languages,
          certifications: parsed.certifications,
        },
        suggestions: suggestions.map(s => ({
          departmentId: s.departmentId,
          departmentName: s.departmentName,
          jobTitleId: s.jobTitleId,
          jobTitleName: s.jobTitleName,
          matchScore: s.matchScore,
          reason: s.matchReason,
          strengthPoints: s.strengthPoints,
          gaps: s.gaps,
        })),
      });
    } catch (error: any) {
      logger.error('[CV Parse] Error:', error?.message || String(error));
      return NextResponse.json(
        { success: false, error: 'Failed to parse CV', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
