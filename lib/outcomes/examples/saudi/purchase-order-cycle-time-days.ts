import { registerOutcome } from '../../registry';
import type { OutcomeDefinition } from '../../types';

// =============================================================================
// Saudi outcome — Purchase-order cycle time (Phase 8.4)
//
// Median elapsed time from `purchase_order.created@v1` to the first
// matching `goods_received@v1` event. Saudi MoH supply-chain efficiency
// guidance for non-emergency consumables targets ≤ 7 days median; > 14
// days flags supplier-lead-time drift or PO-approval bottlenecks.
//
// Unit note: `duration_between_events` returns 'hours' / 'minutes' /
// 'seconds' (not days). We compute in hours (target 168 = 7 × 24); the
// dashboard divides by 24 for the "days" reading (same convention as
// revenue-cycle-days.ts).
//
// Source events (BOTH already emitted as of Phase 7.5):
//   - purchase_order.created@v1   (start, grouped by poId)
//   - goods_received@v1           (end — payload carries poId, the natural pair)
//
// groupBy caveat: `aggregateId` on the events table maps to the row's
// primary key (poId for purchase_order, grnId for GRN). Because the GRN
// aggregateId is its own grnId — NOT the parent poId — the default
// `aggregateId` grouping does not pair these two natively. computeOutcome
// will therefore return sampleSize=0 until a future change either:
//   (a) emits goods_received@v1 with aggregateId = poId so the existing
//       pairing logic finds matches, OR
//   (b) extends the formula schema with a `pairBy: 'payload.poId'` option.
// Documented as emit-pairing-deferred. Outcome registers cleanly today.
// =============================================================================

export const purchaseOrderCycleTimeDaysDefinition: OutcomeDefinition = {
  key: 'saudi.imdad.po_cycle_time_days',
  name: 'Purchase-Order Cycle Time',
  description:
    'Median elapsed time from PO creation to first goods-received note (formula returns hours; dashboard divides by 24 for days). Saudi MoH consumables target ≤ 7 days; > 14 days flags supplier-lead-time drift.',
  unit: 'days',
  direction: 'lower_is_better',
  target: 7,
  targetTolerance: 2,
  formula: {
    kind: 'duration_between_events',
    startEvent: 'purchase_order.created@v1',
    endEvent: 'goods_received@v1',
    groupBy: 'aggregateId',
    aggregation: 'median',
    unit: 'hours',
  },
  tags: ['saudi', 'moh', 'imdad', 'procurement', 'po-cycle-time', 'pairing-deferred'],
  status: 'active',
};

export function registerPurchaseOrderCycleTimeDays(): void {
  registerOutcome(purchaseOrderCycleTimeDaysDefinition);
}
