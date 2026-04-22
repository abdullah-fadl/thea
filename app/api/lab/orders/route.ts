import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { validateBody } from '@/lib/validation/helpers';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/monitoring/logger';
import { decryptField } from '@/lib/security/fieldEncryption';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const status = req.nextUrl.searchParams.get('status');
    const search = req.nextUrl.searchParams.get('search') || '';

    const where: any = {
      tenantId,
      departmentKey: 'laboratory',
      kind: 'LAB',
    };
    if (status) where.status = status;

    const rawOrders = await prisma.ordersHub.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { orderedAt: 'asc' }],
      take: 100,
    });

    // Enrich with patient data
    const patientIds = [...new Set(rawOrders.map((o: any) => String(o.patientMasterId || '')).filter(Boolean))];
    const patients = patientIds.length
      ? await prisma.patientMaster.findMany({
          where: { tenantId, id: { in: patientIds } },
        })
      : [];
    const patientsById = patients.reduce<Record<string, (typeof patients)[0]>>((acc, p) => {
      acc[String(p.id || '')] = p;
      return acc;
    }, {});

    let orders = rawOrders.map((order: any) => {
      const patient = patientsById[String(order.patientMasterId || '')] || {} as any;
      const firstName = decryptField((patient as any).firstName);
      const lastName = decryptField((patient as any).lastName);
      const patientName = [firstName, lastName].filter(Boolean).join(' ') || order.patientName || 'Unknown';
      return {
        ...order,
        testCode: order.orderCode || order.testCode,
        testName: order.orderName || order.testName,
        testNameAr: order.testNameAr || null,
        patientId: order.patientMasterId || order.patientId,
        patientName,
        mrn: (patient as any).mrn || null,
        orderId: order.id,
        encounterId: order.encounterCoreId,
      };
    });

    // Apply search filter post-enrichment
    if (search) {
      const searchLower = search.toLowerCase();
      orders = orders.filter((o: any) =>
        (o.patientName || '').toLowerCase().includes(searchLower) ||
        (o.mrn || '').toLowerCase().includes(searchLower) ||
        (o.id || '').toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({ orders });
  }),
  { tenantScoped: true, permissionKey: 'lab.orders.view' }
);

const createLabOrderSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  mrn: z.string().min(1),
  encounterId: z.string().optional(),
  testCode: z.string().min(1),
  testName: z.string().min(1),
  testNameAr: z.string().optional(),
  category: z.string().optional(),
  priority: z.number().int().min(0).max(3).default(0),
  clinicalNotes: z.string().optional(),
  orderingDoctorId: z.string().optional(),
  orderingDoctorName: z.string().optional(),
  fasting: z.boolean().default(false),
  specimenType: z.string().optional(),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, createLabOrderSchema);
    if ('error' in v) return v.error;

    const now = new Date();
    const orderId = uuidv4();

    // Step 1: Write to orders_hub FIRST (primary source of truth)
    const order = await prisma.ordersHub.create({
      data: {
        id: orderId,
        tenantId,
        kind: 'LAB',
        departmentKey: 'laboratory',
        orderCode: v.data.testCode,
        orderName: v.data.testName,
        patientMasterId: v.data.patientId,
        encounterCoreId: v.data.encounterId || null,
        status: 'ORDERED',
        priority: String(v.data.priority),
        orderedAt: now,
        createdByUserId: userId,
        meta: {
          category: v.data.category || null,
          fasting: v.data.fasting || false,
          specimenType: v.data.specimenType || null,
          clinicalNotes: v.data.clinicalNotes || null,
          testNameAr: v.data.testNameAr || null,
          patientName: v.data.patientName,
          mrn: v.data.mrn,
        } as Prisma.InputJsonValue,
        createdAt: now,
        updatedAt: now,
      },
    });

    // Step 2: Sync to lab_orders for backward compatibility (secondary)
    try {
      await prisma.labOrder.create({
        data: {
          id: orderId,
          tenantId,
          patientId: v.data.patientId,
          patientName: v.data.patientName,
          mrn: v.data.mrn,
          encounterId: v.data.encounterId || null,
          testCode: v.data.testCode,
          testName: v.data.testName,
          testNameAr: v.data.testNameAr || null,
          category: v.data.category || null,
          priority: String(v.data.priority),
          clinicalNotes: v.data.clinicalNotes || null,
          orderingDoctorId: v.data.orderingDoctorId || null,
          orderingDoctorName: v.data.orderingDoctorName || null,
          fasting: v.data.fasting || false,
          specimenType: v.data.specimenType || null,
          status: 'ORDERED',
          orderedAt: now,
          orderedBy: userId,
          orderedByName: v.data.orderingDoctorName || user?.displayName || user?.email || null,
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (syncError) {
      logger.error('[lab/orders] Sync to lab_orders failed', { category: 'api', error: syncError });
    }

    await createAuditLog(
      'lab_order',
      order.id,
      'LAB_ORDER_CREATED',
      userId || 'system',
      user?.email,
      { testCode: v.data.testCode, testName: v.data.testName, patientId: v.data.patientId },
      tenantId
    );

    logger.info('Lab order created', {
      category: 'api',
      tenantId,
      userId,
      route: '/api/lab/orders',
      orderId: order.id,
      testCode: v.data.testCode,
    });

    return NextResponse.json({ success: true, order }, { status: 201 });
  }),
  { tenantScoped: true, permissionKey: 'lab.orders.create' }
);
