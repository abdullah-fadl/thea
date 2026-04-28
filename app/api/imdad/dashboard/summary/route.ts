/**
 * SCM Dashboard Summary — Aggregated stats from all bounded contexts
 *
 * GET /api/imdad/dashboard/summary — Returns all dashboard stats in a single response
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

// ---------------------------------------------------------------------------
// Helper: safe count — returns 0 if model doesn't exist in DB yet
// ---------------------------------------------------------------------------
async function safeCount(fn: () => Promise<number>): Promise<number> {
  try {
    return await fn();
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// GET — Dashboard summary
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (_req, { tenantId }) => {
    const now = new Date();
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      // BC1 — Inventory
      totalItems,
      lowStockItems,
      expiringSoon,
      // BC3 — Procurement
      pendingRequisitions,
      activePOs,
      overduePOs,
      // BC2 — Warehouse
      activeWarehouses,
      pendingTransfers,
      temperatureAlerts,
      // BC5 — Clinical
      pendingDispenses,
      formularyItems,
      // BC6 — Quality
      activeRecalls,
      expiringCertificates,
      openNCRs,
      // BC7 — Assets
      totalAssets,
      overdueMaintenance,
      // BC4 — Financial
      pendingInvoices,
      // BC8 — Analytics
      activeAlerts,
    ] = await Promise.all([
      // -----------------------------------------------------------------------
      // BC1 — Inventory
      // -----------------------------------------------------------------------

      // totalItems: count of ImdadItemMaster
      safeCount(() =>
        prisma.imdadItemMaster.count({
          where: { tenantId, isDeleted: false },
        }),
      ),

      // lowStockItems: items where reorderPoint > 0 (placeholder — real logic
      // would compare currentStock against reorderPoint via ImdadItemLocation)
      safeCount(() =>
        prisma.imdadReorderRule.count({
          where: { tenantId, isDeleted: false, reorderPoint: { gt: 0 }, isActive: true },
        }),
      ),

      // expiringSoon: batch lots expiring within 90 days
      safeCount(() =>
        prisma.imdadBatchLot.count({
          where: {
            tenantId,
            isDeleted: false,
            status: 'ACTIVE',
            expiryDate: { gte: now, lte: in90Days },
          },
        }),
      ),

      // -----------------------------------------------------------------------
      // BC3 — Procurement
      // -----------------------------------------------------------------------

      // pendingRequisitions: PRs awaiting approval
      safeCount(() =>
        prisma.imdadPurchaseRequisition.count({
          where: { tenantId, isDeleted: false, status: 'PENDING_APPROVAL' },
        }),
      ),

      // activePOs: POs that are sent, acknowledged, or partially received
      safeCount(() =>
        prisma.imdadPurchaseOrder.count({
          where: {
            tenantId,
            isDeleted: false,
            status: { in: ['SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'] },
          },
        }),
      ),

      // overduePOs: POs sent but past expected delivery date
      safeCount(() =>
        prisma.imdadPurchaseOrder.count({
          where: {
            tenantId,
            isDeleted: false,
            status: { in: ['SENT', 'ACKNOWLEDGED'] },
            expectedDeliveryDate: { lt: now },
          },
        }),
      ),

      // -----------------------------------------------------------------------
      // BC2 — Warehouse
      // -----------------------------------------------------------------------

      // activeWarehouses
      safeCount(() =>
        prisma.imdadWarehouse.count({
          where: { tenantId, isDeleted: false, isActive: true },
        }),
      ),

      // pendingTransfers
      safeCount(() =>
        prisma.imdadTransferRequest.count({
          where: { tenantId, isDeleted: false, status: 'REQUESTED' },
        }),
      ),

      // temperatureAlerts: out-of-range readings in last 24h
      safeCount(() =>
        prisma.imdadTemperatureLog.count({
          where: {
            tenantId,
            isOutOfRange: true,
            createdAt: { gte: last24h },
          },
        }),
      ),

      // -----------------------------------------------------------------------
      // BC5 — Clinical
      // -----------------------------------------------------------------------

      // pendingDispenses
      safeCount(() =>
        prisma.imdadDispenseRequest.count({
          where: { tenantId, isDeleted: false, status: 'PENDING' },
        }),
      ),

      // formularyItems (active)
      safeCount(() =>
        prisma.imdadFormularyItem.count({
          where: { tenantId, isDeleted: false, isActive: true },
        }),
      ),

      // -----------------------------------------------------------------------
      // BC6 — Quality
      // -----------------------------------------------------------------------

      // activeRecalls: recalls in progress (INITIATED or IN_PROGRESS)
      safeCount(() =>
        prisma.imdadRecall.count({
          where: {
            tenantId,
            isDeleted: false,
            status: { in: ['INITIATED', 'IN_PROGRESS'] },
          },
        }),
      ),

      // expiringCertificates: certificates expiring within 90 days
      safeCount(() =>
        prisma.imdadComplianceCertificate.count({
          where: {
            tenantId,
            isDeleted: false,
            isActive: true,
            expiryDate: { gte: now, lte: in90Days },
          },
        }),
      ),

      // openNCRs: non-conformance reports that are open or under investigation
      safeCount(() =>
        prisma.imdadNonConformanceReport.count({
          where: {
            tenantId,
            isDeleted: false,
            status: { in: ['OPEN', 'INVESTIGATING'] },
          },
        }),
      ),

      // -----------------------------------------------------------------------
      // BC7 — Assets
      // -----------------------------------------------------------------------

      // totalAssets
      safeCount(() =>
        prisma.imdadAsset.count({
          where: { tenantId, isDeleted: false },
        }),
      ),

      // overdueMaintenance
      safeCount(() =>
        prisma.imdadMaintenanceOrder.count({
          where: { tenantId, isDeleted: false, status: 'OVERDUE' },
        }),
      ),

      // -----------------------------------------------------------------------
      // BC4 — Financial
      // -----------------------------------------------------------------------

      // pendingInvoices: invoices received but not yet approved/paid
      safeCount(() =>
        prisma.imdadInvoice.count({
          where: {
            tenantId,
            isDeleted: false,
            status: { in: ['RECEIVED', 'VERIFIED', 'MATCHED'] },
          },
        }),
      ),

      // -----------------------------------------------------------------------
      // BC8 — Analytics
      // -----------------------------------------------------------------------

      // activeAlerts
      safeCount(() =>
        prisma.imdadAlertInstance.count({
          where: { tenantId, isDeleted: false, status: 'ACTIVE' },
        }),
      ),
    ]);

    return NextResponse.json({
      inventory: {
        totalItems,
        lowStockItems,
        expiringSoon,
      },
      procurement: {
        pendingRequisitions,
        activePOs,
        overduePOs,
      },
      warehouse: {
        activeWarehouses,
        pendingTransfers,
        temperatureAlerts,
      },
      clinical: {
        pendingDispenses,
        formularyItems,
      },
      quality: {
        activeRecalls,
        expiringCertificates,
        openNCRs,
      },
      assets: {
        totalAssets,
        overdueMaintenance,
      },
      financial: {
        pendingInvoices,
        budgetUtilization: 0, // Placeholder — requires aggregation logic
      },
      alerts: {
        activeAlerts,
      },
    });
  },
  {
    tenantScoped: true,
    platformKey: 'imdad',
    permissionKey: 'imdad.dashboard.view',
  },
);
