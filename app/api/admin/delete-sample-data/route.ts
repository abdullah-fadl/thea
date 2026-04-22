import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const deleteSampleDataSchema = z.object({
  dataType: z.enum(['opd_census', 'opd_daily_data', 'both']),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  departmentId: z.string().optional(),
  doctorId: z.string().optional(),
  deleteAllSample: z.boolean().optional(),
}).passthrough();

/**
 * Build Prisma where clause from filter parameters.
 */
function buildWhereClause(
  tenantUuid: string,
  opts: {
    deleteAllSample?: boolean;
    fromDate?: string;
    toDate?: string;
    departmentId?: string;
    doctorId?: string;
  }
) {
  const where: any = { tenantId: tenantUuid };

  if (opts.deleteAllSample) {
    where.OR = [
      { createdBy: 'system' },
      { createdBy: null },
    ];
  } else {
    if (opts.fromDate || opts.toDate) {
      where.date = {};
      if (opts.fromDate) {
        const startDate = new Date(opts.fromDate);
        startDate.setHours(0, 0, 0, 0);
        where.date.gte = startDate;
      }
      if (opts.toDate) {
        const endDate = new Date(opts.toDate);
        endDate.setHours(23, 59, 59, 999);
        where.date.lte = endDate;
      }
    } else {
      // No date range: only delete sample data
      where.OR = [
        { createdBy: 'system' },
        { createdBy: null },
      ];
    }

    if (opts.departmentId && opts.departmentId !== 'all' && opts.departmentId !== '') {
      where.departmentId = opts.departmentId;
    }

    if (opts.doctorId) {
      where.doctorId = opts.doctorId;
    }
  }

  return where;
}

export const POST = withAuthTenant(async (req, { user, tenantId, role }) => {
  try {
    // Authorization: Only admin can delete sample data
    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only admin can delete sample data' },
        { status: 403 }
      );
    }

    const rawBody = await req.json();
    const v = validateBody(rawBody, deleteSampleDataSchema);
    if ('error' in v) return v.error;
    const body = v.data;
    const { dataType, fromDate, toDate, departmentId, doctorId, deleteAllSample } = body;

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    let deletedCounts: { opd_census: number; opd_daily_data: number } = {
      opd_census: 0,
      opd_daily_data: 0,
    };

    const where = buildWhereClause(tenant.id, { deleteAllSample, fromDate, toDate, departmentId, doctorId });

    // Delete from opd_census
    if (dataType === 'opd_census' || dataType === 'both') {
      const countBefore = await prisma.opdCensus.count({ where });
      logger.info('Found records matching query in opd_census', { category: 'system', route: 'POST /api/admin/delete-sample-data', count: countBefore });

      const censusResult = await prisma.opdCensus.deleteMany({ where });
      deletedCounts.opd_census = censusResult.count;
      logger.info('Deleted records from opd_census', { category: 'system', route: 'POST /api/admin/delete-sample-data', count: deletedCounts.opd_census });
    }

    // Delete from opd_daily_data
    if (dataType === 'opd_daily_data' || dataType === 'both') {
      const countBefore = await prisma.opdDailyData.count({ where });
      logger.info('Found records matching query in opd_daily_data', { category: 'system', route: 'POST /api/admin/delete-sample-data', count: countBefore });

      const dailyDataResult = await prisma.opdDailyData.deleteMany({ where });
      deletedCounts.opd_daily_data = dailyDataResult.count;
      logger.info('Deleted records from opd_daily_data', { category: 'system', route: 'POST /api/admin/delete-sample-data', count: deletedCounts.opd_daily_data });
    }

    return NextResponse.json({
      success: true,
      message: 'Sample data deleted successfully',
      deletedCounts,
    });
  } catch (error) {
    logger.error('Delete sample data error', { category: 'system', route: 'POST /api/admin/delete-sample-data', error });
    return NextResponse.json(
      // [SEC-10]
      { error: 'Failed to delete sample data' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.data.delete' });

/**
 * GET endpoint to preview what will be deleted
 */
export const GET = withAuthTenant(async (req, { user, tenantId, role }) => {
  try {
    // Authorization: Only admin can preview delete operations
    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only admin can preview delete operations' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const dataType = searchParams.get('dataType') as 'opd_census' | 'opd_daily_data' | 'both' || 'both';
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;
    const departmentId = searchParams.get('departmentId') || undefined;
    const doctorId = searchParams.get('doctorId') || undefined;
    const deleteAllSample = searchParams.get('deleteAllSample') === 'true';

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const where = buildWhereClause(tenant.id, { deleteAllSample, fromDate, toDate, departmentId, doctorId });

    const counts: { opd_census: number; opd_daily_data: number } = {
      opd_census: 0,
      opd_daily_data: 0,
    };

    if (dataType === 'opd_census' || dataType === 'both') {
      counts.opd_census = await prisma.opdCensus.count({ where });
    }

    if (dataType === 'opd_daily_data' || dataType === 'both') {
      counts.opd_daily_data = await prisma.opdDailyData.count({ where });
    }

    return NextResponse.json({
      counts,
      query: {
        dataType,
        fromDate,
        toDate,
        departmentId,
        doctorId,
        deleteAllSample,
      },
    });
  } catch (error) {
    logger.error('Preview delete error', { category: 'system', route: 'GET /api/admin/delete-sample-data', error });
    return NextResponse.json(
      { error: 'Failed to preview delete' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.data.delete' });
