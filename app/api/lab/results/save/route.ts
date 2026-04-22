import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { checkCriticalValue } from '@/lib/lab/criticalValues';
import { checkOrderPayment } from '@/lib/billing/paymentGate';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { createAuditLog } from '@/lib/utils/audit';
import type { OrdersHub, Prisma } from '@prisma/client';

// OrdersHub may store additional lab-specific fields in meta or as extra columns
// not yet in the Prisma schema.
interface OrderExtras {
  patientId?: string;
  encounterId?: string;
  testCode?: string;
  testName?: string;
  testNameAr?: string;
  patientName?: string;
  mrn?: string;
}

interface LabParam {
  parameterId?: string;
  code?: string;
  name?: string;
  nameAr?: string;
  value: string | number;
  unit?: string;
  referenceMin?: number;
  referenceMax?: number;
  referenceRange?: string;
  abnormalFlag?: string | null;
}

interface CriticalAlertData {
  tenantId: string;
  orderId: string;
  testCode?: string | null;
  testName?: string | null;
  patientId?: string | null;
  patientName?: string | null;
  mrn?: string | null;
  encounterId?: string | null;
  value: string;
  unit: string;
  criticalType?: string | null;
  threshold?: string | null;
  createdAt: Date;
}

const labParameterSchema = z.object({
  parameterId: z.string().optional(),
  code: z.string().optional(),
  name: z.string().optional(),
  nameAr: z.string().optional(),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  referenceMin: z.number().optional(),
  referenceMax: z.number().optional(),
  referenceRange: z.string().optional(), // e.g. "4.0 - 11.0"
}).passthrough();

const saveLabResultBodySchema = z.object({
  testId: z.string().min(1, 'testId is required'),
  orderId: z.string().min(1, 'orderId is required'),
  results: z.array(labParameterSchema),
  status: z.string().optional(),
}).passthrough();

/** Determine abnormal flag based on value vs reference range */
function getAbnormalFlag(value: number, min?: number, max?: number): 'H' | 'L' | 'N' | null {
  if (min == null && max == null) return null;
  if (max != null && value > max) return 'H';
  if (min != null && value < min) return 'L';
  return 'N';
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
  const body = await req.json().catch(() => ({}));
  const v = validateBody(body, saveLabResultBodySchema);
  if ('error' in v) return v.error;
  const { testId, orderId, results, status } = v.data;

  const order = await prisma.ordersHub.findFirst({
    where: { tenantId, id: orderId, kind: 'LAB' },
  });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const paymentCheck = await checkOrderPayment(null, tenantId, orderId, 'LAB');
  if (!paymentCheck.allowed) {
    return NextResponse.json(
      {
        error: 'PAYMENT_REQUIRED',
        message: paymentCheck.reason,
        paymentStatus: paymentCheck.paymentStatus,
      },
      { status: 402 }
    );
  }

  const now = new Date();

  // Enrich results with abnormal flags based on reference ranges
  const enrichedResults = results.map((param) => {
    const numVal = Number(param.value);
    if (Number.isNaN(numVal)) return param;
    const flag = getAbnormalFlag(numVal, param.referenceMin, param.referenceMax);
    return { ...param, abnormalFlag: flag };
  });

  const o = order as OrdersHub & OrderExtras;

  const labResult = await prisma.labResult.create({
    data: {
      tenantId,
      testId,
      orderId,
      patientId: o.patientMasterId || o.patientId || null,
      encounterId: o.encounterCoreId || o.encounterId || null,
      testCode: o.orderCode || o.testCode || null,
      testName: o.orderName || o.testName || null,
      testNameAr: o.testNameAr || null,
      parameters: enrichedResults as Prisma.InputJsonValue,
      status: status || 'IN_PROGRESS',
      createdAt: now,
      createdByUserId: userId || null,
    },
  });

  const statusPatch: { status: string; updatedAt: Date; completedAt?: Date } = { status: status || 'IN_PROGRESS', updatedAt: now };
  if (status === 'COMPLETED') statusPatch.completedAt = now;

  // Update orders_hub (primary)
  await prisma.ordersHub.updateMany({
    where: { tenantId, id: orderId },
    data: statusPatch,
  });

  // Also update lab_orders for backward compatibility (fire-and-forget)
  prisma.labOrder.updateMany({
    where: { tenantId, id: orderId },
    data: statusPatch,
  }).catch(() => {});

  const alerts: CriticalAlertData[] = [];
  for (const param of results) {
    const valueNum = Number(param.value);
    if (Number.isNaN(valueNum)) continue;
    const critical = checkCriticalValue(param.parameterId || param.code || o.testCode || o.orderCode || '', valueNum);
    if (critical.isCritical) {
      alerts.push({
        tenantId,
        orderId,
        testCode: o.testCode || o.orderCode || null,
        testName: o.testName || o.orderName || null,
        patientId: o.patientId || o.patientMasterId || null,
        patientName: o.patientName || null,
        mrn: o.mrn || null,
        encounterId: o.encounterId || o.encounterCoreId || null,
        value: String(valueNum),
        unit: param.unit || '',
        criticalType: critical.type || null,
        threshold: critical.threshold != null ? String(critical.threshold) : null,
        createdAt: now,
      });
    }
  }
  if (alerts.length) {
    for (const alert of alerts) {
      await prisma.labCriticalAlert.create({ data: alert });
    }
  }

  await createAuditLog(
    'lab_result',
    labResult.id,
    'LAB_RESULT_SAVED',
    userId || 'system',
    undefined,
    { orderId, testId, status: status || 'IN_PROGRESS', alertCount: alerts.length },
    tenantId
  );

  return NextResponse.json({ success: true, labResult, alerts: alerts.length });
}),
  { tenantScoped: true, permissionKey: 'lab.results.create' });
