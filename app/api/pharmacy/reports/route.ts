import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const range = req.nextUrl.searchParams.get('range') || '30'; // days
    const days = Math.min(parseInt(range) || 30, 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Dispensed prescriptions in the range
    const dispensed = await prisma.pharmacyPrescription.findMany({
      where: {
        tenantId,
        status: { in: ['DISPENSED', 'PICKED_UP'] },
        dispensedAt: { gte: since },
      },
      orderBy: { dispensedAt: 'desc' },
      take: 500,
    });

    // All prescriptions in range (for status breakdown)
    const allRx = await prisma.pharmacyPrescription.findMany({
      where: {
        tenantId,
        prescribedAt: { gte: since },
      },
      select: { status: true, prescribedAt: true },
      take: 200,
    });

    // Top dispensed medications
    const medCounts: Record<string, { count: number; nameAr?: string; quantity: number }> = {};
    for (const rx of dispensed) {
      const key = rx.medication || 'Unknown';
      if (!medCounts[key]) {
        medCounts[key] = { count: 0, nameAr: rx.medicationAr, quantity: 0 };
      }
      medCounts[key].count += 1;
      medCounts[key].quantity += rx.quantity || 1;
    }
    const topMedications = Object.entries(medCounts)
      .map(([name, data]) => ({
        medication: name,
        medicationAr: data.nameAr,
        count: data.count,
        quantity: data.quantity,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Inventory summary
    const inventory = await prisma.pharmacyInventory.findMany({
      where: { tenantId },
      select: {
        medicationName: true,
        medicationNameAr: true,
        currentStock: true,
        minStock: true,
        unitPrice: true,
        expiryDate: true,
        status: true,
      },
      take: 200,
    });

    const inventoryStats = {
      total: inventory.length,
      inStock: inventory.filter((i: any) => i.currentStock > (i.minStock || 0)).length,
      lowStock: inventory.filter((i: any) => i.currentStock > 0 && i.currentStock <= (i.minStock || 0)).length,
      outOfStock: inventory.filter((i: any) => i.currentStock === 0).length,
      expired: inventory.filter((i: any) => i.expiryDate && new Date(i.expiryDate) < new Date()).length,
      totalValue: inventory.reduce(
        (sum: number, i: any) => sum + (i.currentStock || 0) * (i.unitPrice || 0),
        0
      ),
    };

    // Status breakdown
    const statusBreakdown: Record<string, number> = {};
    for (const rx of allRx) {
      statusBreakdown[rx.status] = (statusBreakdown[rx.status] || 0) + 1;
    }

    // Daily dispensing trend (last 14 days bucketed by day)
    const dailyTrend: Record<string, number> = {};
    const trendDays = Math.min(days, 14);
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      dailyTrend[key] = 0;
    }
    for (const rx of dispensed) {
      if (rx.dispensedAt) {
        const key = new Date(rx.dispensedAt).toISOString().split('T')[0];
        if (key in dailyTrend) dailyTrend[key]++;
      }
    }

    const trend = Object.entries(dailyTrend).map(([date, count]) => ({ date, count }));

    return NextResponse.json({
      summary: {
        totalDispensed: dispensed.length,
        totalPrescribed: allRx.length,
        dispensingRate:
          allRx.length > 0
            ? Math.round((dispensed.length / allRx.length) * 100)
            : 0,
        statusBreakdown,
      },
      topMedications,
      inventoryStats,
      trend,
      rangeDays: days,
    });
  }),
  { tenantScoped: true, permissionKey: 'pharmacy.inventory.view' }
);
