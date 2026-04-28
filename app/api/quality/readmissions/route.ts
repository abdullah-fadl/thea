import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getReadmissions, detectReadmission } from '@/lib/quality/readmissionTracker';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/quality/readmissions?patientId=...&reviewStatus=...&isPreventable=...&rootCause=...&dateFrom=...&dateTo=...&page=1&limit=20
 *
 * List readmission records with optional filters.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = req.nextUrl;
    const patientId = url.searchParams.get('patientId') || undefined;
    const department = url.searchParams.get('department') || undefined;
    const reviewStatus = url.searchParams.get('reviewStatus') || undefined;
    const isPreventable = url.searchParams.get('isPreventable') || undefined;
    const rootCause = url.searchParams.get('rootCause') || undefined;
    const dateFromStr = url.searchParams.get('dateFrom');
    const dateToStr = url.searchParams.get('dateTo');
    const page = Math.max(Number(url.searchParams.get('page')) || 1, 1);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 100);

    const result = await getReadmissions(tenantId, {
      patientId,
      department,
      reviewStatus,
      isPreventable,
      rootCause,
      dateFrom: dateFromStr ? new Date(dateFromStr) : undefined,
      dateTo: dateToStr ? new Date(dateToStr) : undefined,
      page,
      limit,
    });

    return NextResponse.json(result);
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'readmissions.view',
  }
);

const recordSchema = z.object({
  encounterId: z.string().uuid(),
}).passthrough();

/**
 * POST /api/quality/readmissions
 *
 * Detect and record a readmission for a given encounter ID.
 * This checks if the encounter is within 30 days of a previous discharge.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const body = await req.json();

    const parsed = recordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await detectReadmission(parsed.data.encounterId, tenantId);

    if (result.isReadmission) {
      return NextResponse.json({
        ok: true,
        isReadmission: true,
        record: result.record,
      }, { status: 201 });
    }

    return NextResponse.json({
      ok: true,
      isReadmission: false,
      message: 'No readmission detected within 30 days',
    });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'readmissions.view',
  }
);
