import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/pharmacy/stats
 *
 * Returns pharmacy dashboard KPIs:
 * - Pending prescriptions count
 * - Dispensed today count
 * - Verified today count
 * - Rejected today count
 * - Average verification time (minutes)
 * - Inventory alerts count
 * - Controlled substance dispensations today
 */
export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Run all queries in parallel
    const [
      pendingCount,
      verifiedTodayCount,
      rejectedTodayCount,
      dispensedTodayCount,
      verifiedToday,
      inventoryAlerts,
      controlledToday,
    ] = await Promise.all([
      // Pending prescriptions
      prisma.pharmacyPrescription.count({
        where: { tenantId, status: 'PENDING' },
      }),

      // Verified today
      prisma.pharmacyPrescription.count({
        where: {
          tenantId,
          status: 'VERIFIED',
          verifiedAt: { gte: startOfDay },
        },
      }),

      // Rejected today (check both REJECTED and CANCELLED with rejectedAt)
      prisma.pharmacyPrescription.count({
        where: {
          tenantId,
          OR: [
            { status: 'REJECTED', updatedAt: { gte: startOfDay } },
            { status: 'CANCELLED', cancelledAt: { gte: startOfDay } },
          ],
        },
      }),

      // Dispensed today
      prisma.pharmacyPrescription.count({
        where: {
          tenantId,
          status: 'DISPENSED',
          dispensedAt: { gte: startOfDay },
        },
      }),

      // Verified prescriptions today (for avg verification time calculation)
      prisma.pharmacyPrescription.findMany({
        where: {
          tenantId,
          status: { in: ['VERIFIED', 'DISPENSED'] },
          verifiedAt: { gte: startOfDay },
        },
        select: {
          prescribedAt: true,
          verifiedAt: true,
        },
        take: 500,
      }),

      // Inventory alerts (low stock + out of stock)
      prisma.pharmacyInventory.count({
        where: {
          tenantId,
          status: { in: ['LOW_STOCK', 'OUT_OF_STOCK'] },
        },
      }),

      // Controlled substance dispensations today
      prisma.pharmacyPrescription.count({
        where: {
          tenantId,
          status: 'DISPENSED',
          dispensedAt: { gte: startOfDay },
          OR: [
            { priority: 'controlled' },
            { form: 'injection' },
          ],
        },
      }).catch(() => 0), // Graceful fallback if columns don't exist yet
    ]);

    // Calculate average verification time in minutes
    let avgVerificationMinutes: number | null = null;
    if (verifiedToday.length > 0) {
      const validTimes: number[] = [];
      for (const rx of verifiedToday) {
        const prescribed = rx.prescribedAt;
        const verified = rx.verifiedAt;
        if (prescribed && verified) {
          const prescribedTime = new Date(prescribed).getTime();
          const verifiedTime = new Date(verified).getTime();
          const diffMinutes = (verifiedTime - prescribedTime) / (1000 * 60);
          if (diffMinutes >= 0 && diffMinutes < 1440) {
            // Only count reasonable times (< 24 hours)
            validTimes.push(diffMinutes);
          }
        }
      }
      if (validTimes.length > 0) {
        avgVerificationMinutes =
          Math.round((validTimes.reduce((a, b) => a + b, 0) / validTimes.length) * 10) / 10;
      }
    }

    return NextResponse.json({
      pending: pendingCount,
      verifiedToday: verifiedTodayCount,
      rejectedToday: rejectedTodayCount,
      dispensedToday: dispensedTodayCount,
      avgVerificationMinutes,
      inventoryAlerts,
      controlledSubstancesToday: controlledToday,
      timestamp: now.toISOString(),
    });
  }),
  { tenantScoped: true, permissionKey: 'pharmacy.view' }
);
