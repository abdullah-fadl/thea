import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { evaluateAutoValidation, evaluateBatch, type ValidationInput } from '@/lib/lab/autoValidation';

const autoValidateSchema = z.object({
  orderId: z.string().min(1),
  results: z.array(
    z.object({
      testCode: z.string().min(1),
      value: z.number(),
      unit: z.string().optional(),
    }),
  ),
  gender: z.enum(['male', 'female']).optional(),
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, autoValidateSchema);
    if ('error' in v) return v.error;
    const { orderId, results, gender } = v.data;

    // Fetch previous results for delta check
    const order = await prisma.ordersHub.findFirst({
      where: { tenantId, id: orderId, kind: 'LAB' },
    });

    const patientId = order?.patientMasterId || (order as any)?.patientId;
    let previousResults: Record<string, number> = {};

    if (patientId) {
      const prevLabs = await prisma.labResult.findMany({
        where: { tenantId, patientId, NOT: { orderId } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { parameters: true, createdAt: true },
      });

      if (prevLabs.length > 0 && Array.isArray((prevLabs[0] as Record<string, unknown>).parameters)) {
        for (const param of (prevLabs[0] as Record<string, unknown>).parameters as Record<string, unknown>[]) {
          const code = String(param.parameterId || param.code || '').toUpperCase();
          const val = Number(param.value);
          if (code && !Number.isNaN(val)) {
            previousResults[code] = val;
          }
        }
      }
    }

    // Check latest QC status per analyte
    const analyteCodes = results.map((r) => r.testCode.toUpperCase());
    const latestQC = await prisma.labQcResult.findMany({
      where: { tenantId, analyteCode: { in: analyteCodes } },
      orderBy: { performedAt: 'desc' },
      select: { analyteCode: true, status: true },
      take: 100,
    });

    const qcStatusMap: Record<string, string> = {};
    for (const qc of latestQC) {
      const code = String(qc.analyteCode).toUpperCase();
      if (!qcStatusMap[code]) qcStatusMap[code] = qc.status as string;
    }

    // Build validation inputs
    const inputs: ValidationInput[] = results.map((r) => ({
      testCode: r.testCode,
      value: r.value,
      unit: r.unit ?? '',
      gender,
      previousValue: previousResults[r.testCode.toUpperCase()],
      qcStatus: (qcStatusMap[r.testCode.toUpperCase()] as ValidationInput['qcStatus']) ?? 'unknown',
    }));

    const validationResults = evaluateBatch(inputs);

    const output: Record<string, unknown> = {};
    for (const [testCode, result] of validationResults) {
      output[testCode] = result;
    }

    return NextResponse.json({ orderId, validations: output });
  }),
  { tenantScoped: true, permissionKey: 'lab.results.create' },
);
