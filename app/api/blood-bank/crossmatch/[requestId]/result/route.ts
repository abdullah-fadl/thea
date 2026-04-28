import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { createAuditLog } from '@/lib/utils/audit';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_RESULTS = ['COMPATIBLE', 'INCOMPATIBLE'] as const;
const VALID_CROSSMATCH_TYPES = ['ELECTRONIC', 'IMMEDIATE_SPIN', 'FULL'] as const;

const crossmatchResultSchema = z.object({
  result: z.enum(VALID_RESULTS),
  crossmatchType: z.enum(VALID_CROSSMATCH_TYPES).optional(),
  antibodyScreen: z.string().optional(),
  antibodyIdentification: z.string().optional(),
  notes: z.string().optional(),
  performedByUserId: z.string().optional(),
});

/**
 * PUT /api/blood-bank/crossmatch/[requestId]/result
 * Record crossmatch result — marks the request as COMPATIBLE or INCOMPATIBLE.
 */
export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
    const requestId = String((params as Record<string, string>)?.requestId || '').trim();
    if (!requestId) {
      return NextResponse.json(
        { error: 'Missing requestId', errorAr: 'معرف الطلب مطلوب' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, crossmatchResultSchema);
    if ('error' in v) return v.error;
    const { result, crossmatchType, antibodyScreen, antibodyIdentification, notes, performedByUserId } = v.data;

    // Find the crossmatch request
    const existing = await prisma.bloodBankRequest.findFirst({
      where: { id: requestId, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Crossmatch request not found', errorAr: 'طلب اختبار التوافق غير موجود' },
        { status: 404 }
      );
    }

    // Ensure request hasn't already been completed or cancelled
    if (['COMPLETED', 'CANCELLED'].includes(existing.status)) {
      return NextResponse.json(
        { error: 'Request already finalized', errorAr: 'تم الانتهاء من الطلب مسبقا' },
        { status: 409 }
      );
    }

    const now = new Date();

    // Build crossmatch result metadata to store in products
    const existingProducts = Array.isArray(existing.products) ? existing.products : [];
    const crossmatchDetails = {
      _crossmatchResult: {
        result,
        crossmatchType: crossmatchType || null,
        antibodyScreen: antibodyScreen || null,
        antibodyIdentification: antibodyIdentification || null,
        notes: notes || null,
        completedBy: performedByUserId || userId,
        completedAt: now.toISOString(),
      },
    };

    // Determine new status based on result
    const newStatus = result === 'COMPATIBLE' ? 'APPROVED' : 'INCOMPATIBLE';

    const updated = await prisma.bloodBankRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        products: [...existingProducts.filter((p: any) => !p._crossmatchResult), crossmatchDetails],
        updatedAt: now,
      },
    });

    // Create audit log
    await createAuditLog(
      'BloodBankRequest',
      requestId,
      'CROSSMATCH_RESULT_RECORDED',
      userId,
      user?.email,
      {
        requestId,
        previousStatus: existing.status,
        newStatus,
        result,
        crossmatchType: crossmatchType || null,
        performedBy: performedByUserId || userId,
      },
      tenantId,
      req
    );

    logger.info('Crossmatch result recorded', {
      tenantId,
      userId,
      requestId,
      result,
      newStatus,
      category: 'clinical',
    });

    return NextResponse.json({
      success: true,
      message: result === 'COMPATIBLE'
        ? 'Crossmatch compatible — units approved for issue'
        : 'Crossmatch incompatible — units not approved',
      messageAr: result === 'COMPATIBLE'
        ? 'اختبار التوافق متوافق — تمت الموافقة على الوحدات'
        : 'اختبار التوافق غير متوافق — لم تتم الموافقة على الوحدات',
      request: updated,
    });
  }),
  { permissionKey: 'blood_bank.manage' }
);
