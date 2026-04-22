/**
 * SCM BC1 Inventory — Inventory Alerts (Low Stock & Expiry)
 *
 * GET  /api/imdad/inventory/alerts — Get active inventory alerts
 * POST /api/imdad/inventory/alerts — Trigger alert scan (compute low-stock & expiry alerts)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List active inventory alerts
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  organizationId: z.string().uuid().optional(),
  alertType: z.enum(['LOW_STOCK', 'EXPIRY_WARNING', 'EXPIRED', 'OVERSTOCK']).optional(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  status: z.enum(['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED']).optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, organizationId, alertType, severity, status } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (alertType) where.alertType = alertType;
      if (severity) where.severity = severity;
      if (status) where.status = status || 'ACTIVE';

      const [data, total] = await Promise.all([
        (prisma as any).imdadInventoryAlert.findMany({
          where,
          orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        (prisma as any).imdadInventoryAlert.count({ where }),
      ]);

      return NextResponse.json({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.view' }
);

// ---------------------------------------------------------------------------
// POST — Trigger inventory alert scan
// Scans all items and generates alerts for:
// 1. LOW_STOCK: quantityOnHand <= reorderPoint
// 2. EXPIRY_WARNING: items expiring within configurable days (default 90)
// 3. EXPIRED: items past expiry date
// 4. OVERSTOCK: quantityOnHand > maxStockLevel (if defined)
// ---------------------------------------------------------------------------

const scanSchema = z.object({
  organizationId: z.string().uuid(),
  expiryWarningDays: z.number().int().min(1).max(365).default(90),
  lowStockThresholdPct: z.number().min(0).max(100).default(0),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = scanSchema.parse(body);
      const { organizationId, expiryWarningDays, lowStockThresholdPct } = parsed;

      const now = new Date();
      const expiryThreshold = new Date(now.getTime() + expiryWarningDays * 24 * 60 * 60 * 1000);

      const alerts: {
        alertType: string;
        severity: string;
        itemId: string;
        itemCode: string;
        itemName: string;
        locationId?: string;
        message: string;
        messageAr: string;
        currentValue: number;
        thresholdValue: number;
      }[] = [];

      // 1. Scan stock levels for low-stock and overstock
      const stockLevels = await (prisma as any).imdadStockLevel.findMany({
        where: {
          tenantId,
          organizationId,
          isDeleted: false,
        },
        include: {
          item: { select: { id: true, code: true, nameEn: true, nameAr: true, reorderPoint: true, maxStockLevel: true } },
        },
        take: 1000,
      });

      for (const sl of stockLevels) {
        const item = sl.item as any;
        if (!item) continue;

        const qty = Number(sl.quantityOnHand ?? 0);
        const reorderPoint = Number(item.reorderPoint ?? 0);
        const maxStock = Number(item.maxStockLevel ?? 0);

        // Low stock check
        if (reorderPoint > 0 && qty <= reorderPoint) {
          const severity = qty === 0 ? 'CRITICAL' : qty <= reorderPoint * 0.5 ? 'HIGH' : 'MEDIUM';
          alerts.push({
            alertType: 'LOW_STOCK',
            severity,
            itemId: item.id,
            itemCode: item.code || '',
            itemName: item.nameEn || '',
            locationId: sl.locationId,
            message: `Low stock: ${item.nameEn || item.code} — ${qty} on hand (reorder at ${reorderPoint})`,
            messageAr: `مخزون منخفض: ${item.nameAr || item.code} — ${qty} متوفر (إعادة الطلب عند ${reorderPoint})`,
            currentValue: qty,
            thresholdValue: reorderPoint,
          });
        }

        // Overstock check
        if (maxStock > 0 && qty > maxStock) {
          alerts.push({
            alertType: 'OVERSTOCK',
            severity: 'LOW',
            itemId: item.id,
            itemCode: item.code || '',
            itemName: item.nameEn || '',
            locationId: sl.locationId,
            message: `Overstock: ${item.nameEn || item.code} — ${qty} on hand (max ${maxStock})`,
            messageAr: `فائض المخزون: ${item.nameAr || item.code} — ${qty} متوفر (الحد الأقصى ${maxStock})`,
            currentValue: qty,
            thresholdValue: maxStock,
          });
        }
      }

      // 2. Scan batch/lots for expiry
      const batchLots = await prisma.imdadBatchLot.findMany({
        where: {
          tenantId,
          isDeleted: false,
          expiryDate: { lte: expiryThreshold },
          status: { not: 'EXPIRED' },
        },
        include: {
          item: { select: { id: true, code: true, nameEn: true, nameAr: true } },
        } as any,
        take: 1000,
      });

      for (const batch of batchLots) {
        const item = batch.item as any;
        if (!item) continue;

        const expiryDate = batch.expiryDate ? new Date(batch.expiryDate) : null;
        if (!expiryDate) continue;

        const isExpired = expiryDate <= now;
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        alerts.push({
          alertType: isExpired ? 'EXPIRED' : 'EXPIRY_WARNING',
          severity: isExpired ? 'CRITICAL' : daysUntilExpiry <= 30 ? 'HIGH' : 'MEDIUM',
          itemId: item.id,
          itemCode: item.code || '',
          itemName: item.nameEn || '',
          message: isExpired
            ? `Expired: ${item.nameEn || item.code} batch ${batch.batchNumber} expired on ${expiryDate.toISOString().split('T')[0]}`
            : `Expiry warning: ${item.nameEn || item.code} batch ${batch.batchNumber} expires in ${daysUntilExpiry} days`,
          messageAr: isExpired
            ? `منتهي الصلاحية: ${item.nameAr || item.code} دفعة ${batch.batchNumber} انتهت في ${expiryDate.toISOString().split('T')[0]}`
            : `تحذير انتهاء الصلاحية: ${item.nameAr || item.code} دفعة ${batch.batchNumber} تنتهي خلال ${daysUntilExpiry} يوم`,
          currentValue: daysUntilExpiry,
          thresholdValue: expiryWarningDays,
        });
      }

      // 3. Persist alerts (upsert to avoid duplicates)
      let created = 0;
      for (const alert of alerts) {
        try {
          await (prisma as any).imdadInventoryAlert.create({
            data: {
              tenantId,
              organizationId,
              alertType: alert.alertType,
              severity: alert.severity,
              status: 'ACTIVE',
              itemId: alert.itemId,
              itemCode: alert.itemCode,
              itemName: alert.itemName,
              locationId: alert.locationId,
              message: alert.message,
              messageAr: alert.messageAr,
              currentValue: alert.currentValue,
              thresholdValue: alert.thresholdValue,
              firedAt: now,
              createdBy: userId,
            } as any,
          });
          created++;
        } catch {
          // Duplicate or constraint error — skip
        }
      }

      await imdadAudit.log({
        tenantId,
        organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'SCAN',
        resourceType: 'INVENTORY_ALERT',
        resourceId: 'batch-scan',
        boundedContext: 'BC1_INVENTORY',
        newData: { totalAlerts: alerts.length, created, scannedAt: now.toISOString() },
        request: req,
      });

      return NextResponse.json({
        summary: {
          totalAlerts: alerts.length,
          created,
          lowStock: alerts.filter(a => a.alertType === 'LOW_STOCK').length,
          expiryWarning: alerts.filter(a => a.alertType === 'EXPIRY_WARNING').length,
          expired: alerts.filter(a => a.alertType === 'EXPIRED').length,
          overstock: alerts.filter(a => a.alertType === 'OVERSTOCK').length,
        },
        scannedAt: now.toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.alerts.manage' }
);
