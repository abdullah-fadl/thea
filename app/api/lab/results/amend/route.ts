import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';
import { validateBody } from '@/lib/validation/helpers';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const amendResultSchema = z.object({
  resultId: z.string().min(1, 'resultId is required'),
  orderId: z.string().optional(),
  amendedValues: z.record(
    z.string(),
    z.object({
      value: z.string(),
      unit: z.string(),
    })
  ),
  reason: z.string().min(1, 'Amendment reason is required'),
});

/**
 * POST /api/lab/results/amend
 *
 * Amend a verified lab result. Creates an amendment record that preserves
 * the original values, updates the result with new values, and marks it
 * as AMENDED. Full audit trail is maintained.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, amendResultSchema);
    if ('error' in v) return v.error;

    const { resultId, orderId, amendedValues, reason } = v.data;

    // Verify the result exists and belongs to this tenant
    const existingResult = await prisma.labResult.findFirst({
      where: { tenantId, id: resultId },
    });

    if (!existingResult) {
      return NextResponse.json(
        { error: 'Result not found / النتيجة غير موجودة' },
        { status: 404 }
      );
    }

    const resultStatus = existingResult.status;

    // Only verified or already-amended results can be amended
    if (!['VERIFIED', 'AMENDED', 'COMPLETED', 'RESULTED'].includes(resultStatus)) {
      return NextResponse.json(
        {
          error: `Cannot amend result with status "${resultStatus}". Only verified/completed results can be amended. / لا يمكن تعديل نتيجة بحالة "${resultStatus}". يمكن فقط تعديل النتائج المُتحققة.`,
        },
        { status: 400 }
      );
    }

    // Build snapshot of original values being changed
    const currentParameters = existingResult.parameters;
    const originalValues: Record<string, { value: string; unit: string }> = {};

    if (Array.isArray(currentParameters)) {
      // Parameters stored as array of objects: [{ code, value, unit, ... }]
      for (const key of Object.keys(amendedValues)) {
        const existing = (currentParameters as Array<any>).find(
          (p) => p.code === key || p.parameterId === key || p.name === key
        );
        if (existing) {
          originalValues[key] = {
            value: String(existing.value ?? ''),
            unit: String(existing.unit ?? ''),
          };
        }
      }
    } else if (currentParameters && typeof currentParameters === 'object') {
      // Parameters stored as key-value object
      const paramsObj = currentParameters as Record<string, any>;
      for (const key of Object.keys(amendedValues)) {
        if (paramsObj[key]) {
          const existing = paramsObj[key];
          originalValues[key] = {
            value: String(existing.value ?? existing),
            unit: String(existing.unit ?? ''),
          };
        }
      }
    }

    // Count existing amendments to determine the amendment number
    const existingAmendments = await prisma.labResultAmendment.count({
      where: { tenantId, resultId },
    });
    const amendmentNumber = existingAmendments + 1;

    const now = new Date();
    const userName = user?.displayName || user?.email || userId;

    // Create the amendment record
    const amendment = await prisma.labResultAmendment.create({
      data: {
        tenantId,
        resultId,
        orderId: orderId || existingResult.orderId || null,
        amendmentNumber,
        originalValues,
        amendedValues,
        reason,
        amendedByUserId: userId,
        amendedByName: userName,
        createdAt: now,
      },
    });

    // Update the lab result with the new values
    let updatedParameters = currentParameters;

    if (Array.isArray(currentParameters)) {
      updatedParameters = (currentParameters as Array<any>).map((p) => {
        const key = (p.code || p.parameterId || p.name) as string;
        if (key && amendedValues[key]) {
          return {
            ...p,
            value: amendedValues[key].value,
            unit: amendedValues[key].unit,
            amended: true,
            amendedAt: now.toISOString(),
          };
        }
        return p;
      });
    } else if (currentParameters && typeof currentParameters === 'object') {
      const paramsClone = { ...(currentParameters as Record<string, any>) };
      for (const [key, newVal] of Object.entries(amendedValues)) {
        paramsClone[key] = {
          ...(paramsClone[key] || {}),
          value: newVal.value,
          unit: newVal.unit,
          amended: true,
          amendedAt: now.toISOString(),
        };
      }
      updatedParameters = paramsClone;
    }

    await prisma.labResult.updateMany({
      where: { tenantId, id: resultId },
      data: {
        parameters: updatedParameters as Prisma.InputJsonValue,
        status: 'AMENDED',
        updatedAt: now,
      },
    });

    // Audit trail
    await createAuditLog(
      'LabResult',
      resultId,
      'AMEND',
      userId,
      user?.email,
      {
        amendmentNumber,
        originalValues,
        amendedValues,
        reason,
      },
      tenantId,
      req
    );

    return NextResponse.json({
      success: true,
      amendment: {
        id: amendment.id,
        amendmentNumber,
        resultId,
        originalValues,
        amendedValues,
        reason,
        amendedBy: userName,
        createdAt: now,
      },
    });
  }),
  { tenantScoped: true, permissionKey: 'lab.view' }
);
