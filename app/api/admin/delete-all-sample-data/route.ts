import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';

/**
 * DELETE endpoint to delete ALL sample data for the current tenant
 * This will delete records with createdBy='system' or null createdBy
 * from key tables, with tenant isolation
 */
export const DELETE = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const deletedCounts: Record<string, number> = {};

    logger.info('Starting deletion of all sample data', { category: 'api', route: 'DELETE /api/admin/delete-all-sample-data', tenantId });

    // Delete sample data from opd_census
    try {
      const result = await prisma.opdCensus.deleteMany({
        where: { tenantId: tenant.id, OR: [{ createdBy: 'system' }, { createdBy: null }] },
      });
      deletedCounts['opd_census'] = result.count;
      if (result.count > 0) {
        logger.info('Deleted sample records', { category: 'api', route: 'DELETE /api/admin/delete-all-sample-data', collection: 'opd_census', deletedCount: result.count });
      }
    } catch { deletedCounts['opd_census'] = 0; }

    // Delete sample data from opd_daily_data
    try {
      const result = await prisma.opdDailyData.deleteMany({
        where: { tenantId: tenant.id, OR: [{ createdBy: 'system' }, { createdBy: null }] },
      });
      deletedCounts['opd_daily_data'] = result.count;
      if (result.count > 0) {
        logger.info('Deleted sample records', { category: 'api', route: 'DELETE /api/admin/delete-all-sample-data', collection: 'opd_daily_data', deletedCount: result.count });
      }
    } catch { deletedCounts['opd_daily_data'] = 0; }

    // Delete sample data from departments
    try {
      const result = await prisma.department.deleteMany({
        where: { tenantId: tenant.id, OR: [{ createdBy: 'system' }, { createdBy: null }] },
      });
      deletedCounts['departments'] = result.count;
      if (result.count > 0) {
        logger.info('Deleted sample records', { category: 'api', route: 'DELETE /api/admin/delete-all-sample-data', collection: 'departments', deletedCount: result.count });
      }
    } catch { deletedCounts['departments'] = 0; }

    // Delete sample EHR patients
    try {
      const result = await prisma.ehrPatient.deleteMany({
        where: { tenantId: tenant.id, OR: [{ createdBy: 'system' }, { createdBy: null }] },
      });
      deletedCounts['ehr_patients'] = result.count;
      if (result.count > 0) {
        logger.info('Deleted sample records', { category: 'api', route: 'DELETE /api/admin/delete-all-sample-data', collection: 'ehr_patients', deletedCount: result.count });
      }
    } catch { deletedCounts['ehr_patients'] = 0; }

    // Delete sample EHR encounters
    try {
      const result = await prisma.ehrEncounter.deleteMany({
        where: { tenantId: tenant.id, OR: [{ createdBy: 'system' }, { createdBy: null }] },
      });
      deletedCounts['ehr_encounters'] = result.count;
      if (result.count > 0) {
        logger.info('Deleted sample records', { category: 'api', route: 'DELETE /api/admin/delete-all-sample-data', collection: 'ehr_encounters', deletedCount: result.count });
      }
    } catch { deletedCounts['ehr_encounters'] = 0; }

    // Delete sample EHR orders
    try {
      const result = await prisma.ehrOrder.deleteMany({
        where: { tenantId: tenant.id, OR: [{ createdBy: 'system' }, { createdBy: null }] },
      });
      deletedCounts['ehr_orders'] = result.count;
      if (result.count > 0) {
        logger.info('Deleted sample records', { category: 'api', route: 'DELETE /api/admin/delete-all-sample-data', collection: 'ehr_orders', deletedCount: result.count });
      }
    } catch { deletedCounts['ehr_orders'] = 0; }

    // Delete sample EHR notes
    try {
      const result = await prisma.ehrNote.deleteMany({
        where: { tenantId: tenant.id, OR: [{ createdBy: 'system' }, { createdBy: null }] },
      });
      deletedCounts['ehr_notes'] = result.count;
      if (result.count > 0) {
        logger.info('Deleted sample records', { category: 'api', route: 'DELETE /api/admin/delete-all-sample-data', collection: 'ehr_notes', deletedCount: result.count });
      }
    } catch { deletedCounts['ehr_notes'] = 0; }

    // Delete sample EHR tasks
    try {
      const result = await prisma.ehrTask.deleteMany({
        where: { tenantId: tenant.id, OR: [{ createdBy: 'system' }, { createdBy: null }] },
      });
      deletedCounts['ehr_tasks'] = result.count;
      if (result.count > 0) {
        logger.info('Deleted sample records', { category: 'api', route: 'DELETE /api/admin/delete-all-sample-data', collection: 'ehr_tasks', deletedCount: result.count });
      }
    } catch { deletedCounts['ehr_tasks'] = 0; }

    // Calculate total deleted
    const totalDeleted = Object.values(deletedCounts).reduce((sum, count) => sum + count, 0);

    logger.info('Sample data deletion completed', { category: 'api', route: 'DELETE /api/admin/delete-all-sample-data', totalDeleted, tenantId });

    await createAuditLog(
      'tenant',
      tenantId,
      'SAMPLE_DATA_DELETED',
      (user as any)?.userId || 'system',
      user?.email,
      { deletedCounts, totalDeleted },
      tenantId
    );

    return NextResponse.json({
      success: true,
      message: 'All sample data deleted successfully for tenant',
      deletedCounts,
      totalDeleted,
      collectionsProcessed: Object.keys(deletedCounts).length,
    });
  } catch (error) {
    logger.error('Delete all sample data error', { category: 'api', route: 'DELETE /api/admin/delete-all-sample-data', error });
    return NextResponse.json(
      // [SEC-10]
      { error: 'Failed to delete all sample data' },
      { status: 500 }
    );
  }
}, { permissionKey: 'admin.delete-data' });
