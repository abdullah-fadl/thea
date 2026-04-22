import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const inventoryId = String((params as Record<string, string>)?.id || '').trim();
  if (!inventoryId) {
    return NextResponse.json({ error: 'inventoryId is required' }, { status: 400 });
  }

  const movements = await prisma.pharmacyStockMovement.findMany({
    where: { tenantId, inventoryId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ movements });
}),
  { tenantScoped: true, permissionKey: 'pharmacy.inventory.view' });
