/**
 * IMDAD Dashboard — Diagnostics
 *
 * GET /api/imdad/dashboard/diagnostics
 *
 * Checks all prerequisites for the IMDAD dashboard:
 * - Auth status
 * - Tenant ID validity
 * - Subscription contract and enabledScm flag
 * - Table row counts
 * - Sample queries
 *
 * Helps diagnose why the dashboard shows "—" or "No data".
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

interface CountRow { count: bigint | number }

export const GET = withAuthTenant(
  async (_req, { tenantId, role, userId }) => {
    const checks: Record<string, any> = {};

    // 1. Auth info
    checks.auth = {
      tenantId,
      userId,
      role,
      isAdmin: ['admin', 'tenant-admin', 'thea-owner'].includes(String(role).toLowerCase()),
    };

    // 2. Subscription contract
    try {
      const tenant = await prisma.tenant.findFirst({
        where: { id: tenantId },
        select: { id: true, tenantId: true, name: true },
      });

      if (!tenant) {
        const tenantByKey = await prisma.tenant.findFirst({
          where: { tenantId },
          select: { id: true, tenantId: true, name: true },
        });
        checks.tenant = tenantByKey ? { found: true, ...tenantByKey } : { found: false, searchedId: tenantId };
      } else {
        checks.tenant = { found: true, id: tenant.id, tenantId: (tenant as any).tenantId, name: (tenant as any).name };
      }

      const effectiveId = (checks.tenant?.id ?? tenantId) as string;
      const contract = await prisma.subscriptionContract.findFirst({
        where: { tenantId: effectiveId },
        select: {
          id: true,
          status: true,
          enabledSam: true,
          enabledTheaHealth: true,
          enabledScm: true,
          enabledCvision: true,
          enabledEdrac: true,
          subscriptionStartsAt: true,
          subscriptionEndsAt: true,
        } as any,
      });

      checks.subscription = contract
        ? {
            found: true,
            ...contract,
            imdadEnabled: (contract as any).enabledScm,
            issue: !(contract as any).enabledScm
              ? 'enabledScm is FALSE — IMDAD APIs will return 403 for non-admin users. POST to /api/imdad/dashboard/enable-platform to fix.'
              : null,
          }
        : {
            found: false,
            issue: 'No subscription contract found — IMDAD APIs will return 403. POST to /api/imdad/dashboard/enable-platform to create one.',
          };
    } catch (err: any) {
      checks.subscription = { error: err?.message };
    }

    // 3. Table row counts
    const tables = [
      'imdad_item_masters',
      'imdad_item_locations',
      'imdad_purchase_orders',
      'imdad_vendors',
      'imdad_batch_lots',
      'imdad_budgets',
      'imdad_budget_consumptions',
      'imdad_recalls',
      'imdad_alert_instances',
      'imdad_purchase_requisitions',
      'imdad_invoices',
      'imdad_kpi_snapshots',
      'imdad_organizations',
    ];

    checks.tableCounts = {};
    for (const table of tables) {
      try {
        const rows = await prisma.$queryRawUnsafe<CountRow[]>(
          `SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "tenantId" = $1::uuid`,
          tenantId,
        );
        checks.tableCounts[table] = Number(rows?.[0]?.count ?? 0);
      } catch (err: any) {
        // Table might not exist or query failed — report error without cross-tenant data exposure
        checks.tableCounts[table] = { error: 'Query failed — table may not exist or tenantId mismatch', withTenant: 0 };
      }
    }

    // 4. Sample data check — verify tenantId values in the data
    try {
      // Only check current tenant's data count (do not expose other tenants' data)
      const tenantCount = await prisma.$queryRawUnsafe<[{ cnt: bigint | number }]>(
        `SELECT COUNT(*)::bigint AS cnt FROM imdad_purchase_orders WHERE "tenantId" = $1::uuid`,
        tenantId,
      );
      checks.sampleTenantIds = {
        purchaseOrders: [{
          tenantId,
          count: Number(tenantCount?.[0]?.cnt ?? 0),
          isCurrentTenant: true,
        }],
      };
    } catch (err: any) {
      checks.sampleTenantIds = { error: err?.message };
    }

    return NextResponse.json({
      message: 'IMDAD Dashboard Diagnostics',
      checks,
    });
  },
  {
    tenantScoped: true,
    // No platformKey — diagnostics should work even if platform is not enabled
  },
);
