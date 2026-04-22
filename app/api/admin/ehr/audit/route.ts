/**
 * Admin EHR Audit API
 * GET /api/admin/ehr/audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';
import { AuditLog } from '@/lib/ehr/models';
import { validateISOTimestamp, formatValidationErrors } from '@/lib/ehr/utils/validation';
import { tenantWhere } from '@/lib/db/tenantLookup';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

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
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Build query with tenant isolation
    const where: any = { tenantId: tenant.id };

    if (userId) where.userId = userId;
    if (resourceType) where.resource = resourceType;
    if (resourceId) where.resourceId = resourceId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const logs = await prisma.ehrAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      logs: logs as unknown as AuditLog[],
      count: logs.length,
    });
  } catch (error: any) {
    logger.error('Get audit logs error', { category: 'api', route: 'GET /api/admin/audit', error });
    // [SEC-03]
    return NextResponse.json(
      { error: 'Failed to get audit logs' },
      { status: 500 }
    );
  }
}, { permissionKey: 'admin.audit' });
