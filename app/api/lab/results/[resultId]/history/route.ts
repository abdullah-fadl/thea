import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/lab/results/[resultId]/history
 *
 * Returns the amendment history for a specific lab result.
 * Each amendment includes original values, amended values, reason, who amended, and when.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolved = params instanceof Promise ? await params : params;
    const resultId = resolved?.resultId as string;

    if (!resultId) {
      return NextResponse.json(
        { error: 'resultId is required / معرف النتيجة مطلوب' },
        { status: 400 }
      );
    }

    // Verify the result exists and belongs to this tenant
    const result = await prisma.labResult.findFirst({
      where: { tenantId, id: resultId },
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Result not found / النتيجة غير موجودة' },
        { status: 404 }
      );
    }

    // Fetch all amendments for this result, ordered by creation date
    const amendments = await prisma.labResultAmendment.findMany({
      where: { tenantId, resultId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      resultId,
      resultStatus: result.status,
      totalAmendments: amendments.length,
      amendments: amendments.map((a: any) => ({
        id: a.id,
        amendmentNumber: a.amendmentNumber,
        originalValues: a.originalValues,
        amendedValues: a.amendedValues,
        reason: a.reason,
        amendedBy: {
          userId: a.amendedByUserId,
          name: a.amendedByName,
        },
        createdAt: a.createdAt,
      })),
    });
  }),
  { tenantScoped: true, permissionKey: 'lab.view' }
);
