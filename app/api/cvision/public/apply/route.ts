import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Public Apply API
 * POST /api/cvision/public/apply - Submit job application
 * 
 * Validates kill-out questions before submit.
 * If disqualified => stored as DISQUALIFIED with reason.
 * Tenant-scoped via posting. No authentication required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  getCVisionCollection,
  findById,
  createTenantFilter,
} from '@/lib/cvision/db';
import { z } from 'zod';
import type {
  CVisionJobPosting,
  CVisionKilloutQuestion,
  CVisionApplication,
} from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const applySchema = z.object({
  postingId: z.string().uuid(),
  candidateEmail: z.string().email(),
  candidateName: z.string().min(1).max(200),
  answers: z.record(z.string(), z.any()), // questionId -> answer
  tenantId: z.string().optional(), // Optional, can be derived from posting
});

/**
 * Validate kill-out question answer against disqualify rule
 */
function validateKilloutAnswer(
  question: CVisionKilloutQuestion,
  answer: any
): { disqualified: boolean; reason?: string } {
  const rule = question.disqualifyRuleJson as Record<string, any>;

  switch (question.type) {
    case 'YESNO': {
      const expectedAnswer = rule.expectedAnswer; // true or false
      const answerBool = answer === true || answer === 'true' || answer === 'yes';
      
      if (rule.disqualifyOn === 'mismatch' && answerBool !== expectedAnswer) {
        return {
          disqualified: true,
          reason: `Answer to "${question.questionText}" does not meet requirements`,
        };
      }
      if (rule.disqualifyOn === 'match' && answerBool === expectedAnswer) {
        return {
          disqualified: true,
          reason: `Answer to "${question.questionText}" disqualifies application`,
        };
      }
      break;
    }

    case 'MULTI': {
      const allowedValues = rule.allowedValues as string[];
      const answerValue = String(answer);
      
      if (rule.disqualifyOn === 'not_in' && !allowedValues.includes(answerValue)) {
        return {
          disqualified: true,
          reason: `Answer to "${question.questionText}" is not in allowed values`,
        };
      }
      if (rule.disqualifyOn === 'in' && allowedValues.includes(answerValue)) {
        return {
          disqualified: true,
          reason: `Answer to "${question.questionText}" disqualifies application`,
        };
      }
      break;
    }

    case 'TEXT': {
      const minLength = rule.minLength as number | undefined;
      const maxLength = rule.maxLength as number | undefined;
      const requiredKeywords = rule.requiredKeywords as string[] | undefined;
      const forbiddenKeywords = rule.forbiddenKeywords as string[] | undefined;
      const answerText = String(answer).toLowerCase();

      if (minLength && answerText.length < minLength) {
        return {
          disqualified: true,
          reason: `Answer to "${question.questionText}" is too short (minimum ${minLength} characters)`,
        };
      }

      if (maxLength && answerText.length > maxLength) {
        return {
          disqualified: true,
          reason: `Answer to "${question.questionText}" is too long (maximum ${maxLength} characters)`,
        };
      }

      if (requiredKeywords && requiredKeywords.length > 0) {
        const hasAllKeywords = requiredKeywords.every((keyword) =>
          answerText.includes(keyword.toLowerCase())
        );
        if (!hasAllKeywords) {
          return {
            disqualified: true,
            reason: `Answer to "${question.questionText}" must include required keywords`,
          };
        }
      }

      if (forbiddenKeywords && forbiddenKeywords.length > 0) {
        const hasForbiddenKeyword = forbiddenKeywords.some((keyword) =>
          answerText.includes(keyword.toLowerCase())
        );
        if (hasForbiddenKeyword) {
          return {
            disqualified: true,
            reason: `Answer to "${question.questionText}" contains forbidden keywords`,
          };
        }
      }
      break;
    }
  }

  return { disqualified: false };
}

// POST - Submit job application
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = applySchema.parse(body);

    // Get tenantId from request or default
    const tenantId =
      data.tenantId ||
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
    const applicationCollection = await getCVisionCollection<CVisionApplication>(
      tenantId,
      'applications'
    );

    // Verify posting exists and is OPEN
    const posting = await findById(postingCollection, tenantId, data.postingId);
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

    // Fetch kill-out questions for this posting
    const questions = await questionCollection
      .find(createTenantFilter(tenantId, { postingId: data.postingId }))
      .sort({ sortOrder: 1 })
      .toArray();

    // Validate all kill-out questions
    let disqualifyReason: string | null = null;
    let status: 'SUBMITTED' | 'DISQUALIFIED' = 'SUBMITTED';

    for (const question of questions) {
      const answer = data.answers[question.id];
      
      // Check if answer is provided
      if (answer === undefined || answer === null || answer === '') {
        return NextResponse.json(
          {
            error: 'Missing answer',
            message: `Answer required for question: ${question.questionText}`,
            questionId: question.id,
          },
          { status: 400 }
        );
      }

      // Validate against disqualify rule
      const validation = validateKilloutAnswer(question, answer);
      if (validation.disqualified) {
        status = 'DISQUALIFIED';
        disqualifyReason = validation.reason || 'Failed kill-out question validation';
        break; // Stop on first disqualification
      }
    }

    // Create application
    const now = new Date();
    const application: CVisionApplication = {
      id: uuidv4(),
      tenantId,
      postingId: data.postingId,
      candidateEmail: data.candidateEmail,
      candidateName: data.candidateName,
      answersJson: data.answers,
      status,
      disqualifyReason,
      createdAt: now,
      updatedAt: now,
      createdBy: 'public',
      updatedBy: 'public',
    };

    await applicationCollection.insertOne(application);

    return NextResponse.json(
      {
        success: true,
        application: {
          id: application.id,
          status: application.status,
          disqualifyReason: application.disqualifyReason,
        },
        message:
          status === 'DISQUALIFIED'
            ? 'Application received but disqualified based on answers'
            : 'Application submitted successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    logger.error('[CVision Public Apply POST]', error?.message || String(error));
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
