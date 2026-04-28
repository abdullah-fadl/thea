import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { logger } from '@/lib/monitoring/logger';

/**
 * DELETE endpoint to delete ALL OPD Dashboard data for the current tenant
 * This will delete all records from opd_census and opd_daily_data tables
 * with tenant isolation (only deletes data for the authenticated tenant)
 */
export const DELETE = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    let deletedCounts: { opd_census: number; opd_daily_data: number } = {
      opd_census: 0,
      opd_daily_data: 0,
    };

    // Count before deletion
    const totalCensusBefore = await prisma.opdCensus.count({ where: { tenantId: tenant.id } });
    logger.info('OPD census records before deletion', { category: 'api', route: 'DELETE /api/admin/delete-all-opd-data', collection: 'opd_census', count: totalCensusBefore, tenantId });

    // Delete ALL records from opd_census for this tenant
    const censusResult = await prisma.opdCensus.deleteMany({ where: { tenantId: tenant.id } });
    deletedCounts.opd_census = censusResult.count;
    logger.info('Deleted OPD census records', { category: 'api', route: 'DELETE /api/admin/delete-all-opd-data', collection: 'opd_census', deletedCount: deletedCounts.opd_census });

    // Count before deletion
    const totalDailyDataBefore = await prisma.opdDailyData.count({ where: { tenantId: tenant.id } });
    logger.info('OPD daily data records before deletion', { category: 'api', route: 'DELETE /api/admin/delete-all-opd-data', collection: 'opd_daily_data', count: totalDailyDataBefore, tenantId });

    // Delete ALL records from opd_daily_data for this tenant
    const dailyDataResult = await prisma.opdDailyData.deleteMany({ where: { tenantId: tenant.id } });
    deletedCounts.opd_daily_data = dailyDataResult.count;
    logger.info('Deleted OPD daily data records', { category: 'api', route: 'DELETE /api/admin/delete-all-opd-data', collection: 'opd_daily_data', deletedCount: deletedCounts.opd_daily_data });

    return NextResponse.json({
      success: true,
      message: 'All OPD Dashboard data deleted successfully for tenant',
      deletedCounts,
      totalDeleted: deletedCounts.opd_census + deletedCounts.opd_daily_data,
    });
  } catch (error) {
    logger.error('Delete all OPD data error', { category: 'api', route: 'DELETE /api/admin/delete-all-opd-data', error });
    return NextResponse.json(
      // [SEC-03]
      { error: 'Failed to delete all OPD data' },
      { status: 500 }
    );
  }
}, { permissionKey: 'admin.delete-data' });
