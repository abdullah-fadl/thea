/**
 * Imdad Dashboard — Command Center KPIs
 *
 * GET /api/imdad/dashboard/command-center — Aggregated KPIs in one call
 *
 * Uses raw SQL to bypass Prisma model/relation issues and query data directly.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

interface RawCount { count: bigint | number }
interface RawSum { total: string | number | null }

export const GET = withAuthTenant(
  async (_req, { tenantId }) => {
    const now = new Date();
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const fiscalYearStart = new Date(now.getFullYear(), 0, 1);

    try {
      const [
        inventoryValueRows,
        pendingPORows,
        overdueRows,
        expiringRows,
        pendingPRRows,
        pendingPOApprovalRows,
        activeVendorRows,
        openRecallRows,
        budgetAllocatedRows,
        budgetConsumedRows,
      ] = await Promise.all([
        // 1. Total inventory value: sum(currentStock * standardCost) from item_locations JOIN item_masters
        prisma.$queryRaw<RawSum[]>(
          Prisma.sql`SELECT COALESCE(SUM(il."currentStock" * COALESCE(im."standardCost", 0)), 0)::text AS total
           FROM imdad_item_locations il
           JOIN imdad_item_masters im ON im.id = il."itemId"
           WHERE il."tenantId" = ${tenantId}::uuid
             AND il."isDeleted" = false`
        ),

        // 2. Pending POs
        prisma.$queryRaw<RawCount[]>(
          Prisma.sql`SELECT COUNT(*)::bigint AS count
           FROM imdad_purchase_orders
           WHERE "tenantId" = ${tenantId}::uuid
             AND "isDeleted" = false
             AND status IN ('DRAFT', 'PENDING_APPROVAL', 'SENT', 'ACKNOWLEDGED')`
        ),

        // 3. Overdue deliveries
        prisma.$queryRaw<RawCount[]>(
          Prisma.sql`SELECT COUNT(*)::bigint AS count
           FROM imdad_purchase_orders
           WHERE "tenantId" = ${tenantId}::uuid
             AND "isDeleted" = false
             AND status IN ('SENT', 'ACKNOWLEDGED')
             AND "expectedDeliveryDate" < ${now}`
        ),

        // 4. Expiring items within 90 days
        prisma.$queryRaw<RawCount[]>(
          Prisma.sql`SELECT COUNT(*)::bigint AS count
           FROM imdad_batch_lots
           WHERE "tenantId" = ${tenantId}::uuid
             AND "isDeleted" = false
             AND status = 'ACTIVE'
             AND "expiryDate" >= ${now}
             AND "expiryDate" <= ${in90Days}`
        ),

        // 5a. Pending PR approvals
        prisma.$queryRaw<RawCount[]>(
          Prisma.sql`SELECT COUNT(*)::bigint AS count
           FROM imdad_purchase_requisitions
           WHERE "tenantId" = ${tenantId}::uuid
             AND "isDeleted" = false
             AND status = 'PENDING_APPROVAL'`
        ),

        // 5b. Pending PO approvals
        prisma.$queryRaw<RawCount[]>(
          Prisma.sql`SELECT COUNT(*)::bigint AS count
           FROM imdad_purchase_orders
           WHERE "tenantId" = ${tenantId}::uuid
             AND "isDeleted" = false
             AND status = 'PENDING_APPROVAL'`
        ),

        // 6. Active vendors
        prisma.$queryRaw<RawCount[]>(
          Prisma.sql`SELECT COUNT(*)::bigint AS count
           FROM imdad_vendors
           WHERE "tenantId" = ${tenantId}::uuid
             AND "isDeleted" = false
             AND status = 'APPROVED'`
        ),

        // 7. Open recalls
        prisma.$queryRaw<RawCount[]>(
          Prisma.sql`SELECT COUNT(*)::bigint AS count
           FROM imdad_recalls
           WHERE "tenantId" = ${tenantId}::uuid
             AND "isDeleted" = false
             AND status IN ('INITIATED', 'IN_PROGRESS')`
        ),

        // 8a. Budget allocated (current fiscal year)
        prisma.$queryRaw<RawSum[]>(
          Prisma.sql`SELECT COALESCE(SUM("allocatedAmount"), 0)::text AS total
           FROM imdad_budgets
           WHERE "tenantId" = ${tenantId}::uuid
             AND "isDeleted" = false
             AND "fiscalYear" = ${now.getFullYear()}`
        ),

        // 8b. Budget consumed (current fiscal year)
        prisma.$queryRaw<RawSum[]>(
          Prisma.sql`SELECT COALESCE(SUM(amount), 0)::text AS total
           FROM imdad_budget_consumptions
           WHERE "tenantId" = ${tenantId}::uuid
             AND "isDeleted" = false
             AND "createdAt" >= ${fiscalYearStart}`
        ),
      ]);

      const totalInventoryValue = Math.round(Number(inventoryValueRows?.[0]?.total ?? 0));
      const pendingPOs = Number(pendingPORows?.[0]?.count ?? 0);
      const overdueDeliveries = Number(overdueRows?.[0]?.count ?? 0);
      const expiringItems90d = Number(expiringRows?.[0]?.count ?? 0);
      const pendingApprovals =
        Number(pendingPRRows?.[0]?.count ?? 0) + Number(pendingPOApprovalRows?.[0]?.count ?? 0);
      const activeVendors = Number(activeVendorRows?.[0]?.count ?? 0);
      const openRecalls = Number(openRecallRows?.[0]?.count ?? 0);

      const totalBudget = Number(budgetAllocatedRows?.[0]?.total ?? 0);
      const totalConsumed = Number(budgetConsumedRows?.[0]?.total ?? 0);
      const budgetUtilizationPct =
        totalBudget > 0 ? Math.round((totalConsumed / totalBudget) * 100) : 0;

      return NextResponse.json({
        data: {
          totalInventoryValue,
          pendingPOs,
          overdueDeliveries,
          expiringItems90d,
          budgetUtilizationPct,
          pendingApprovals,
          activeVendors,
          openRecalls,
        },
      });
    } catch (err: any) {
      console.error('[IMDAD] command-center error:', err?.message || err);
      return NextResponse.json({
        data: {
          totalInventoryValue: 0,
          pendingPOs: 0,
          overdueDeliveries: 0,
          expiringItems90d: 0,
          budgetUtilizationPct: 0,
          pendingApprovals: 0,
          activeVendors: 0,
          openRecalls: 0,
        },
        _error: process.env.NODE_ENV === 'development' ? err?.message : undefined,
      });
    }
  },
  {
    tenantScoped: true,
    platformKey: 'imdad',
    permissionKey: 'imdad.dashboard.view',
  },
);
