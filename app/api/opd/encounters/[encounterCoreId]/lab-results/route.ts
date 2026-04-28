import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const encounterCoreId = String((params as Record<string, string>)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  // Fetch from both lab result sources in parallel
  const [labResults, labOrders] = await Promise.all([
    // Direct lab results (from lab module)
    prisma.labResult.findMany({
      where: { tenantId, encounterId: encounterCoreId },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    }),
    // Lab orders from orders hub (to find order results)
    prisma.ordersHub.findMany({
      where: { tenantId, encounterCoreId, kind: 'LAB' },
      select: { id: true },
      take: 200,
    }),
  ]);

  // Fetch order results for any lab orders
  const labOrderIds = labOrders.map((o: any) => o.id);
  const orderResults = labOrderIds.length
    ? await prisma.orderResult.findMany({
        where: { tenantId, orderId: { in: labOrderIds } },
        orderBy: [{ createdAt: 'desc' }],
      })
    : [];

  // Merge: labResults take priority, add any orderResults not already represented
  const labResultOrderIds = new Set(
    labResults.map((r: any) => r.orderId).filter(Boolean)
  );
  const additionalResults = orderResults
    .filter((r: any) => !labResultOrderIds.has(r.orderId))
    .map((r: any) => ({
      ...r,
      source: 'ORDER_RESULT',
    }));

  const results = [
    ...labResults.map((r: any) => ({ ...r, source: 'LAB_RESULT' })),
    ...additionalResults,
  ];

  return NextResponse.json({ results });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.view' }
);
