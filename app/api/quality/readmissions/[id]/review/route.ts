import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { reviewReadmission } from '@/lib/quality/readmissionTracker';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const reviewSchema = z.object({
  isPreventable: z.enum(['yes', 'no', 'unknown', 'under_review']),
  rootCause: z.enum([
    'premature_discharge',
    'inadequate_follow_up',
    'medication_issue',
    'social_factors',
    'disease_progression',
    'complication',
  ]).optional(),
  rootCauseAr: z.string().optional(),
  reviewNotes: z.string().optional(),
  actionPlan: z.string().optional(),
}).passthrough();

/**
 * PATCH /api/quality/readmissions/[id]/review
 *
 * Submit a preventability review for a readmission record.
 */
export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    // Extract ID from path: /api/quality/readmissions/[id]/review
    const segments = req.nextUrl.pathname.split('/');
    const reviewIdx = segments.indexOf('review');
    const id = reviewIdx > 0 ? segments[reviewIdx - 1] : null;

    if (!id) {
      return NextResponse.json({ error: 'Record ID required' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await reviewReadmission(id, tenantId, userId || 'unknown', {
      isPreventable: parsed.data.isPreventable,
      rootCause: parsed.data.rootCause,
      rootCauseAr: parsed.data.rootCauseAr,
      reviewNotes: parsed.data.reviewNotes,
      actionPlan: parsed.data.actionPlan,
    });

    if (!result) {
      return NextResponse.json({ error: 'Readmission record not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, record: result });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'readmissions.review',
  }
);
