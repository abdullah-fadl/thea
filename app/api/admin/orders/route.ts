/**
 * Admin EHR Orders API
 * POST /api/admin/orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, validateISOTimestamp, formatValidationErrors } from '@/lib/ehr/utils/validation';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const orderSchema = z.object({
  patientId: z.string().min(1),
  mrn: z.string().min(1),
  orderType: z.enum(['MEDICATION', 'LAB', 'IMAGING', 'PROCEDURE', 'CONSULT', 'OTHER']),
  description: z.string().min(1),
  orderedBy: z.string().min(1),
}).passthrough();

export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();
    const v = validateBody(body, orderSchema);
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

    // Verify patient exists (with tenant isolation)
    const patient = await prisma.ehrPatient.findFirst({
      where: { tenantId: tenant.id, id: body.patientId, mrn: body.mrn },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

    // Create order
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

    return NextResponse.json(
      { success: true, order },
      { status: 201 }
    );
  } catch (error: any) {
    logger.error('Create order error', { category: 'api', route: 'POST /api/admin/orders', error });

    // Audit log for failure
    try {
      await createAuditLog({
        action: 'CREATE_ORDER',
        resourceType: 'order',
        userId: user.id,
        tenantId,
        success: false,
        errorMessage: error.message,
      });
    } catch {}

    // [SEC-03]
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.ehr.orders.access' });
