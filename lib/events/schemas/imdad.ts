/**
 * Phase 7.5 — Imdad (supply-chain / procurement) domain event schemas
 *
 * Three high-value procurement / inventory events. Importing this module
 * triggers registerEventType() side-effects at module-load time, so the
 * boot-time barrel at `lib/events/schemas/index.ts` must be imported once
 * at app boot before any route attempts to emit.
 *
 * Sensitivity discipline: payloads carry only IDs (UUIDs), tenant scope,
 * organization scope, status enums, severity enums, and timestamps. We
 * deliberately exclude monetary amounts (totalAmount, unitCost), free-text
 * fields (notes, deliveryAddress), and the actual / threshold KPI values
 * — those are all financially or operationally sensitive and must remain
 * inside the audit trail rather than the cross-platform event bus.
 * Subscribers re-read the PO / GRN / alert by ID through tenant-scoped
 * Prisma queries to access full detail.
 */

import { z } from 'zod';
import { registerEventType } from '../registry';

// ─── 1. purchase_order.created@v1 ───────────────────────────────────────────
// Fired after a new ImdadPurchaseOrder row is inserted via POST
// /api/imdad/procurement/purchase-orders. The PO is created in the DRAFT
// status; subsequent PENDING_APPROVAL / APPROVED / SENT transitions are
// distinct lifecycle events and out of scope for v1.
registerEventType({
  eventName: 'purchase_order.created',
  version: 1,
  aggregate: 'purchase_order',
  description:
    'A new Imdad purchase order was created (typically in DRAFT pending approval).',
  payloadSchema: z.object({
    poId: z.string().uuid(),
    tenantId: z.string().uuid(),
    organizationId: z.string().uuid(),
    vendorId: z.string().uuid(),
    status: z.enum([
      'DRAFT',
      'PENDING_APPROVAL',
      'APPROVED',
      'SENT',
      'ACKNOWLEDGED',
      'PARTIALLY_RECEIVED',
      'RECEIVED',
      'INVOICED',
      'CLOSED',
      'CANCELLED',
    ]),
    currency: z.string().min(3).max(3),
    createdAt: z.string().datetime(),
  }),
});

// ─── 2. goods_received@v1 ───────────────────────────────────────────────────
// Fired after a new ImdadGoodsReceivingNote row is inserted via POST
// /api/imdad/procurement/grn. GRN creation reflects physical delivery into
// the receiving area — quantity-accepted / quality-checked transitions
// follow as separate lifecycle steps and are not part of this v1.
registerEventType({
  eventName: 'goods_received',
  version: 1,
  aggregate: 'goods_receiving_note',
  description:
    'A goods receiving note was created against a purchase order on physical delivery.',
  payloadSchema: z.object({
    grnId: z.string().uuid(),
    tenantId: z.string().uuid(),
    organizationId: z.string().uuid(),
    poId: z.string().uuid(),
    vendorId: z.string().uuid().nullable(),
    status: z.enum([
      'DRAFT',
      'PENDING_QC',
      'ACCEPTED',
      'PARTIALLY_ACCEPTED',
      'REJECTED',
      'CANCELLED',
    ]),
    receivedAt: z.string().datetime(),
  }),
});

// ─── 3. stock.threshold_breached@v1 ─────────────────────────────────────────
// Fired when an ImdadAlertInstance is created with a stock-related kpiCode
// (the route is generic, but we narrow the event to STOCK_/INVENTORY_*
// alerts inside the route's emit guard so unrelated KPI alerts — financial,
// operational — do not pollute this signal). actualValue / thresholdValue
// are intentionally not in the payload — those can carry stock counts that
// are operationally sensitive across platforms; subscribers re-read the
// alert by ID via prisma.imdadAlertInstance.findFirst().
registerEventType({
  eventName: 'stock.threshold_breached',
  version: 1,
  aggregate: 'alert_instance',
  description:
    'A stock-level threshold alert fired (Imdad alert instance with a stock-related KPI code).',
  payloadSchema: z.object({
    alertInstanceId: z.string().uuid(),
    tenantId: z.string().uuid(),
    organizationId: z.string().uuid(),
    alertRuleId: z.string().uuid(),
    kpiCode: z.string().min(1),
    severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
    firedAt: z.string().datetime(),
  }),
});
