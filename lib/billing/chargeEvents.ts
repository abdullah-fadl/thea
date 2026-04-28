import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/monitoring/logger';

const DEPARTMENT_KEYS: Record<string, string> = {
  registration: 'REGISTRATION',
  emergency: 'EMERGENCY',
  opd: 'OPD',
  laboratory: 'LAB',
  radiology: 'RADIOLOGY',
  'operating-room': 'OPERATING_ROOM',
  'cath-lab': 'CATH_LAB',
  ipd: 'IPD',
  icu: 'ICU',
};

export function normalizeChargeDepartmentKey(value?: string | null): string | null {
  const key = String(value || '').trim();
  if (!key) return null;
  const upper = key.toUpperCase();
  const allowed = new Set([
    'REGISTRATION',
    'EMERGENCY',
    'OPD',
    'LAB',
    'RADIOLOGY',
    'OPERATING_ROOM',
    'CATH_LAB',
    'IPD',
    'ICU',
    'OTHER',
  ]);
  if (allowed.has(upper)) return upper;
  const mapped = DEPARTMENT_KEYS[key.toLowerCase()];
  return mapped || null;
}

export async function tryCreateChargeFromOrder(args: {
  db?: any;
  tenantId: string;
  order: any;
  userId?: string | null;
  userEmail?: string | null;
}) {
  const order = args.order;
  if (!order || !order.orderCode) return { skipped: true };

  // Check billing lock (no Prisma model yet — use raw SQL)
  const lockRows: any[] = await prisma.$queryRawUnsafe(
    `SELECT * FROM "billing_lock"
     WHERE "tenantId" = $1 AND "encounterCoreId" = $2
     LIMIT 1`,
    args.tenantId,
    order.encounterCoreId
  );
  const lock = lockRows[0] || null;

  if (lock?.isLocked) {
    logger.warn('Charge event skipped - billing locked', {
      category: 'billing',
      tenantId: args.tenantId,
      encounterCoreId: order.encounterCoreId,
      orderId: order.id,
    });
    return { skipped: true, reason: 'LOCKED' };
  }

  // Check billing posting status (no Prisma model yet — use raw SQL)
  const postingRows: any[] = await prisma.$queryRawUnsafe(
    `SELECT * FROM "billing_posting"
     WHERE "tenantId" = $1 AND "encounterCoreId" = $2
     LIMIT 1`,
    args.tenantId,
    order.encounterCoreId
  );
  const posting = postingRows[0] || null;

  if (posting?.status === 'POSTED') {
    logger.warn('Charge event skipped - billing posted', {
      category: 'billing',
      tenantId: args.tenantId,
      encounterCoreId: order.encounterCoreId,
      orderId: order.id,
    }
    );
    return { skipped: true, reason: 'POSTED' };
  }

  // Look up charge catalog item (no Prisma model yet — use raw SQL)
  const catalogRows: any[] = await prisma.$queryRawUnsafe(
    `SELECT * FROM "charge_catalog"
     WHERE "tenantId" = $1 AND "code" = $2 AND "status" = 'ACTIVE'
     LIMIT 1`,
    args.tenantId,
    String(order.orderCode || '').toUpperCase()
  );
  const catalog = catalogRows[0] || null;

  if (!catalog) return { skipped: true };

  const departmentKey = normalizeChargeDepartmentKey(order.departmentKey) || 'OTHER';

  // Check for existing charge event to prevent duplicates (no Prisma model yet — use raw SQL)
  const existingRows: any[] = await prisma.$queryRawUnsafe(
    `SELECT * FROM "charge_events"
     WHERE "tenantId" = $1 AND "status" = 'ACTIVE'
       AND "source"->>'type' = 'ORDER'
       AND "source"->>'orderId' = $2
       AND ($3::text IS NULL AND "source"->>'orderItemId' IS NULL OR "source"->>'orderItemId' = $3)
       AND "chargeCatalogId" = $4
     LIMIT 1`,
    args.tenantId,
    String(order.id || ''),
    order.orderItemId ? String(order.orderItemId || '') : null,
    catalog.id
  );
  const existing = existingRows[0] || null;

  if (existing) {
    return { chargeEvent: existing, noOp: true };
  }

  const now = new Date();
  const quantity = Number(order.quantity || 1) || 1;
  const unitPrice = Number(catalog.basePrice || 0);
  if (unitPrice < 0) {
    logger.warn('Charge event skipped - negative catalog price', {
      category: 'billing',
      tenantId: args.tenantId,
      catalogCode: catalog.code,
      unitPrice,
    });
    return { skipped: true, reason: 'NEGATIVE_PRICE' };
  }
  const computedTotal = Number((quantity * unitPrice).toFixed(2));
  if (computedTotal > 999999) {
    logger.warn('Charge event skipped - total exceeds ceiling', {
      category: 'billing',
      tenantId: args.tenantId,
      catalogCode: catalog.code,
      computedTotal,
    });
    return { skipped: true, reason: 'TOTAL_EXCEEDS_CEILING' };
  }
  const chargeEvent = {
    id: uuidv4(),
    tenantId: args.tenantId,
    encounterCoreId: order.encounterCoreId,
    patientMasterId: order.patientMasterId || null,
    departmentKey,
    source: {
      type: 'ORDER',
      orderId: String(order.id || ''),
      orderItemId: order.orderItemId ? String(order.orderItemId || '') : null,
    },
    chargeCatalogId: catalog.id,
    code: catalog.code,
    name: catalog.name,
    unitType: catalog.unitType,
    quantity,
    unitPrice,
    totalPrice: Number((quantity * unitPrice).toFixed(2)),
    payerType: 'PENDING',
    status: 'ACTIVE',
    reason: null,
    createdAt: now,
    createdBy: args.userId || null,
  };

  try {
    await prisma.$queryRawUnsafe(
      `INSERT INTO "charge_events" (
        "id", "tenantId", "encounterCoreId", "patientMasterId", "departmentKey",
        "source", "chargeCatalogId", "code", "name", "unitType",
        "quantity", "unitPrice", "totalPrice", "payerType", "status",
        "reason", "createdAt", "createdBy"
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6::jsonb, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18
      )`,
      chargeEvent.id,
      chargeEvent.tenantId,
      chargeEvent.encounterCoreId,
      chargeEvent.patientMasterId,
      chargeEvent.departmentKey,
      JSON.stringify(chargeEvent.source),
      chargeEvent.chargeCatalogId,
      chargeEvent.code,
      chargeEvent.name,
      chargeEvent.unitType,
      chargeEvent.quantity,
      chargeEvent.unitPrice,
      chargeEvent.totalPrice,
      chargeEvent.payerType,
      chargeEvent.status,
      chargeEvent.reason,
      chargeEvent.createdAt,
      chargeEvent.createdBy
    );
  } catch (err: any) {
    // Handle unique constraint violation (duplicate key)
    if (err && (err.code === '23505' || err.code === 11000 || err.errorResponse?.code === 11000)) {
      const fallbackRows: any[] = await prisma.$queryRawUnsafe(
        `SELECT * FROM "charge_events"
         WHERE "tenantId" = $1 AND "status" = 'ACTIVE'
           AND "source"->>'type' = 'ORDER'
           AND "source"->>'orderId' = $2
           AND ($3::text IS NULL AND "source"->>'orderItemId' IS NULL OR "source"->>'orderItemId' = $3)
           AND "chargeCatalogId" = $4
         LIMIT 1`,
        args.tenantId,
        String(order.id || ''),
        order.orderItemId ? String(order.orderItemId || '') : null,
        catalog.id
      );
      const fallback = fallbackRows[0] || null;
      if (fallback) return { chargeEvent: fallback, noOp: true };
    }
    throw err;
  }

  await createAuditLog(
    'charge_event',
    chargeEvent.id,
    'CREATE_CHARGE_EVENT',
    args.userId || 'system',
    args.userEmail || undefined,
    {
      encounterCoreId: chargeEvent.encounterCoreId,
      patientMasterId: chargeEvent.patientMasterId,
      departmentKey: chargeEvent.departmentKey,
      source: chargeEvent.source,
      chargeCatalogId: chargeEvent.chargeCatalogId,
      totals: { quantity: chargeEvent.quantity, unitPrice: chargeEvent.unitPrice, totalPrice: chargeEvent.totalPrice },
    },
    args.tenantId
  );

  return { chargeEvent };
}
