/**
 * Admin EHR Orders API
 * POST /api/admin/ehr/orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Order } from '@/lib/ehr/models';
import { v4 as uuidv4 } from 'uuid';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, validateISOTimestamp, formatValidationErrors } from '@/lib/ehr/utils/validation';
import { emitAutoTriggerEvent } from '@/lib/integrations/auto-trigger';
import { canAutoTrigger } from '@/lib/integrations/check-entitlements';
import { isAutoTriggerEnabled } from '@/lib/integrations/settings';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';
import { tenantWhere } from '@/lib/db/tenantLookup';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ehrOrderSchema = z.object({
  patientId: z.string().min(1),
  mrn: z.string().min(1),
  orderType: z.enum(['MEDICATION', 'LAB', 'IMAGING', 'PROCEDURE', 'CONSULT', 'OTHER']),
  description: z.string().min(1),
  orderedBy: z.string().min(1),
}).passthrough();

export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();
    const v = validateBody(body, ehrOrderSchema);
    if ('error' in v) return v.error;

    // Validation
    const requiredFields = ['patientId', 'mrn', 'orderType', 'description', 'orderedBy'];
    const validationErrors = validateRequired(body, requiredFields);

    if (!['MEDICATION', 'LAB', 'IMAGING', 'PROCEDURE', 'CONSULT', 'OTHER'].includes(body.orderType)) {
      validationErrors.push({ field: 'orderType', message: 'Invalid order type' });
    }

    if (body.priority && !['ROUTINE', 'URGENT', 'STAT', 'ASAP'].includes(body.priority)) {
      validationErrors.push({ field: 'priority', message: 'Invalid priority' });
    }

    if (body.startDate && !validateISOTimestamp(body.startDate)) {
      validationErrors.push({ field: 'startDate', message: 'Invalid timestamp format. Use ISO 8601' });
    }

    if (body.scheduledTime && !validateISOTimestamp(body.scheduledTime)) {
      validationErrors.push({ field: 'scheduledTime', message: 'Invalid timestamp format. Use ISO 8601' });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(formatValidationErrors(validationErrors), { status: 400 });
    }

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Verify patient exists - with tenant isolation
    const patient = await prisma.ehrPatient.findFirst({
      where: { tenantId: tenant.id, id: body.patientId, mrn: body.mrn },
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Create order - with tenant isolation
    const now = getISOTimestamp();
    const order = await prisma.ehrOrder.create({
      data: {
        tenantId: tenant.id,
        patientId: body.patientId,
        encounterId: body.encounterId || null,
        mrn: body.mrn,
        orderType: body.orderType,
        description: body.description,
        code: body.code || null,
        orderedBy: body.orderedBy,
        orderingProviderName: body.orderingProviderName || null,
        status: body.status || 'SUBMITTED',
        priority: body.priority || 'ROUTINE',
        instructions: body.instructions || null,
        createdBy: user.id,
      },
    });

    // Audit log - with tenant isolation
    await createAuditLog({
      action: 'CREATE_ORDER',
      resourceType: 'order',
      resourceId: order.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      tenantId,
      patientId: order.patientId,
      mrn: order.mrn || undefined,
      success: true,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    // Auto-trigger policy check (fire-and-forget, non-blocking)
    const token = req.cookies.get('auth-token')?.value;
    if (token) {
      const hasEntitlements = await canAutoTrigger(token);
      const autoTriggerEnabled = await isAutoTriggerEnabled(tenantId);
      if (hasEntitlements && autoTriggerEnabled) {
        const orderText = order.description || order.instructions || '';

        emitAutoTriggerEvent({
          tenantId,
          userId: user.id,
          type: 'ORDER',
          source: 'order_submit',
          subject: order.mrn || '',
          payload: {
            text: orderText,
            metadata: {
              orderId: order.id,
              orderType: order.orderType,
            },
          },
        }).catch((error) => {
          logger.error('Failed to emit auto-trigger order event', { category: 'api', error });
        });
      }
    }

    return NextResponse.json(
      { success: true, order },
      { status: 201 }
    );
  } catch (error: any) {
    logger.error('Create order error', { category: 'api', route: 'POST /api/admin/ehr/orders', error });
    // [SEC-03]
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}, { permissionKey: 'admin.ehr.orders' });
