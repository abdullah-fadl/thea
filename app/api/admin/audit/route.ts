/**
 * Admin EHR Audit API
 * GET /api/admin/audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { logger } from '@/lib/monitoring/logger';
import { validateISOTimestamp, formatValidationErrors } from '@/lib/ehr/utils/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');
    const patientId = searchParams.get('patientId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    // [P-03] Cap limit to prevent abuse (max 1000 per request)
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000);

    // Validation
    const validationErrors: Array<{ field: string; message: string }> = [];

    if (startDate && !validateISOTimestamp(startDate)) {
      validationErrors.push({ field: 'startDate', message: 'Invalid timestamp format. Use ISO 8601' });
    }

    if (endDate && !validateISOTimestamp(endDate)) {
      validationErrors.push({ field: 'endDate', message: 'Invalid timestamp format. Use ISO 8601' });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(formatValidationErrors(validationErrors), { status: 400 });
    }

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Build Prisma where clause with tenant isolation
    const where: any = { tenantId: tenant.id };

    if (userId) {
      where.userId = userId;
    }

    if (resourceType) {
      where.resource = resourceType;
    }

    if (resourceId) {
      where.resourceId = resourceId;
    }

    if (patientId) {
      // patientId is stored in details JSON
      where.details = { path: ['patientId'], equals: patientId };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Query audit logs
    const logs = await prisma.ehrAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
    });
  } catch (error: any) {
    logger.error('Get audit logs error', { category: 'api', route: 'GET /api/admin/audit', error });
    // [P-07] Do not leak internal error details to the client
    return NextResponse.json(
      { error: 'Failed to get audit logs' },
      { status: 500 }
    );
  }
}, { permissionKey: 'admin.audit' });
