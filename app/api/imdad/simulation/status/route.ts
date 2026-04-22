import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getSimulationConfig, getRecentEvents, initializeSimulation } from '@/lib/imdad/simulation/engine';

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    await initializeSimulation(tenantId);
    const config = await getSimulationConfig(tenantId);
    const url = new URL(req.url);
    const eventsLimit = parseInt(url.searchParams.get('events') || '20', 10);
    const events = await getRecentEvents(tenantId, Math.min(eventsLimit, 100));

    const counts = await getLiveCounts(tenantId);

    return NextResponse.json({
      data: {
        config,
        events,
        liveCounts: counts,
      },
    });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.admin' },
);

async function getLiveCounts(tenantId: string) {
  const { prisma } = await import('@/lib/db/prisma');

  // All IMDAD tables use camelCase "tenantId" column
  const tables = [
    'imdad_organizations', 'imdad_purchase_orders', 'imdad_purchase_requisitions',
    'imdad_invoices', 'imdad_goods_receiving_notes', 'imdad_alert_instances',
    'imdad_assets', 'imdad_vendors', 'imdad_item_masters', 'imdad_kpi_snapshots',
    'imdad_budgets', 'imdad_departments', 'imdad_notifications',
  ];

  const counts: Record<string, number> = {};
  for (const table of tables) {
    try {
      const result = await prisma.$queryRawUnsafe<[{ count: string }]>(
        `SELECT COUNT(*)::text as count FROM ${table} WHERE "tenantId" = $1`, tenantId,
      );
      counts[table.replace('imdad_', '')] = parseInt(result[0].count, 10);
    } catch {
      counts[table.replace('imdad_', '')] = 0;
    }
  }

  // Also count simulation-specific tables
  try {
    const { Prisma } = await import('@prisma/client');
    const simEvents = await prisma.$queryRaw<[{ count: string }]>(
      Prisma.sql`SELECT COUNT(*)::text as count FROM imdad_simulation_events WHERE tenant_id = ${tenantId}`
    );
    counts['simulation_events'] = parseInt(simEvents[0].count, 10);
  } catch {
    counts['simulation_events'] = 0;
  }

  return counts;
}
