import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Public Job Questions API
 * GET /api/cvision/public/jobs/[id]/questions - Get kill-out questions for a job posting
 * 
 * Returns kill-out questions for a specific job posting.
 * No authentication required.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCVisionCollection,
  findById,
  createTenantFilter,
} from '@/lib/cvision/db';
import type {
  CVisionJobPosting,
  CVisionKilloutQuestion,
} from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PublicQuestion {
  id: string;
  questionText: string;
  type: 'YESNO' | 'MULTI' | 'TEXT';
  sortOrder?: number;
  options?: string[]; // For MULTI type questions, extracted from disqualifyRuleJson
  // Note: disqualifyRuleJson is not exposed for security reasons
}

// GET - Get questions for a job posting
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const postingId = resolvedParams.id;
    const { searchParams } = new URL(request.url);
    const tenantId =
      searchParams.get('tenantId') ||
      request.headers.get('x-tenant-id') ||
      process.env.DEFAULT_TENANT_ID ||
      'default';

    const postingCollection = await getCVisionCollection<CVisionJobPosting>(
      tenantId,
      'jobPostings'
    );
    const questionCollection = await getCVisionCollection<CVisionKilloutQuestion>(
      tenantId,
      'killoutQuestions'
    );

    // Verify posting exists and is OPEN
    const posting = await findById(postingCollection, tenantId, postingId);
    if (!posting) {
      return NextResponse.json(
        { error: 'Job posting not found' },
        { status: 404 }
      );
    }

    if (posting.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Job posting is not accepting applications' },
        { status: 400 }
      );
    }

    // Fetch questions
    const questions = await questionCollection
      .find(createTenantFilter(tenantId, { postingId }))
      .sort({ sortOrder: 1 })
      .toArray();

    // Return public-safe questions (without disqualifyRuleJson)
    // Extract options for MULTI type questions from disqualifyRuleJson
    const publicQuestions: PublicQuestion[] = questions.map((q) => {
      const question: PublicQuestion = {
        id: q.id,
        questionText: q.questionText,
        type: q.type,
        sortOrder: q.sortOrder,
      };

      // For MULTI type, extract allowedValues from disqualifyRuleJson
      if (q.type === 'MULTI' && q.disqualifyRuleJson) {
        const rule = q.disqualifyRuleJson as Record<string, any>;
        if (rule.allowedValues && Array.isArray(rule.allowedValues)) {
          question.options = rule.allowedValues;
        }
      }

      return question;
    });

    return NextResponse.json({
      success: true,
      questions: publicQuestions,
      count: publicQuestions.length,
    });
  } catch (error: any) {
    logger.error('[CVision Public Job Questions GET]', error?.message || String(error));
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
