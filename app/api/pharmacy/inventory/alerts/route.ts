import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const now = new Date();
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const typeFilter = req.nextUrl.searchParams.get('type');

    const allItems = await prisma.pharmacyInventory.findMany({
      where: { tenantId },
      take: 200,
    });

    const alerts: Array<{
      id: string;
      medicationName: string;
      medicationNameAr?: string;
      alertType: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRED' | 'EXPIRING_SOON';
      severity: 'critical' | 'warning' | 'info';
      currentStock: number;
      minStock: number;
      expiryDate?: Date;
      message: { ar: string; en: string };
    }> = [];

    for (const item of allItems) {
      const expDate = item.expiryDate ? new Date(item.expiryDate) : null;

      if (item.currentStock === 0) {
        if (!typeFilter || typeFilter === 'out_of_stock') {
          alerts.push({
            id: item.id,
            medicationName: item.medicationName,
            medicationNameAr: item.medicationNameAr,
            alertType: 'OUT_OF_STOCK',
            severity: 'critical',
            currentStock: 0,
            minStock: item.minStock || 0,
            expiryDate: expDate || undefined,
            message: {
              ar: `${item.medicationNameAr || item.medicationName} - نفد المخزون`,
              en: `${item.medicationName} - Out of stock`,
            },
          });
        }
        continue;
      }

      if (item.currentStock > 0 && item.currentStock <= (item.minStock || 0)) {
        if (!typeFilter || typeFilter === 'low_stock') {
          alerts.push({
            id: item.id,
            medicationName: item.medicationName,
            medicationNameAr: item.medicationNameAr,
            alertType: 'LOW_STOCK',
            severity: 'warning',
            currentStock: item.currentStock,
            minStock: item.minStock || 0,
            expiryDate: expDate || undefined,
            message: {
              ar: `${item.medicationNameAr || item.medicationName} - المخزون منخفض (${item.currentStock} متبقي)`,
              en: `${item.medicationName} - Low stock (${item.currentStock} remaining)`,
            },
          });
        }
      }

      if (expDate && expDate < now) {
        if (!typeFilter || typeFilter === 'expired') {
          alerts.push({
            id: item.id,
            medicationName: item.medicationName,
            medicationNameAr: item.medicationNameAr,
            alertType: 'EXPIRED',
            severity: 'critical',
            currentStock: item.currentStock,
            minStock: item.minStock || 0,
            expiryDate: expDate,
            message: {
              ar: `${item.medicationNameAr || item.medicationName} - منتهي الصلاحية`,
              en: `${item.medicationName} - Expired`,
            },
          });
        }
      }

      if (expDate && expDate >= now && expDate <= ninetyDaysFromNow) {
        if (!typeFilter || typeFilter === 'expiring_soon') {
          const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          alerts.push({
            id: item.id,
            medicationName: item.medicationName,
            medicationNameAr: item.medicationNameAr,
            alertType: 'EXPIRING_SOON',
            severity: 'warning',
            currentStock: item.currentStock,
            minStock: item.minStock || 0,
            expiryDate: expDate,
            message: {
              ar: `${item.medicationNameAr || item.medicationName} - ينتهي خلال ${daysLeft} يوم`,
              en: `${item.medicationName} - Expires in ${daysLeft} days`,
            },
          });
        }
      }
    }

    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return NextResponse.json({
      alerts,
      summary: {
        total: alerts.length,
        critical: alerts.filter((a) => a.severity === 'critical').length,
        warning: alerts.filter((a) => a.severity === 'warning').length,
      },
    });
  }),
  { tenantScoped: true, permissionKey: 'pharmacy.inventory.view' }
);
