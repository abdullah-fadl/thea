import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  createOrderSchema,
  assignOrderSchema,
  cancelOrderSchema,
  linkOrderContextSchema,
  createOrderSetSchema,
  applyOrderSetSchema,
  executeOrderSetSchema,
  createOrderSetItemSchema,
  orderKindEnum,
  orderPriorityEnum,
  orderSetScopeEnum,
} from '@/lib/validation/orders.schema';
import { medicationOrderMetaSchema } from '@/lib/orders/medicationOrderValidation';
import { canTransition } from '@/lib/orders/ordersHub';

/** Read a route file relative to the project root. */
function readRoute(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════════════════
// 1. Order Creation (scenarios 1-4)
// ═══════════════════════════════════════════════════════════════════════
describe('Order Creation', () => {
  // Scenario 1: createOrderSchema requires encounterCoreId, kind, orderCode, orderName
  it('1 — createOrderSchema requires encounterCoreId + kind + orderCode + orderName', () => {
    const result = createOrderSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain('encounterCoreId');
      expect(fields).toContain('kind');
      expect(fields).toContain('orderCode');
      expect(fields).toContain('orderName');
    }

    // Valid payload passes
    const valid = createOrderSchema.safeParse({
      encounterCoreId: 'enc-1',
      kind: 'LAB',
      orderCode: 'CBC',
      orderName: 'Complete Blood Count',
    });
    expect(valid.success).toBe(true);
  });

  // Scenario 2: orderKindEnum validates LAB / RADIOLOGY / PROCEDURE / MEDICATION
  it('2 — orderKindEnum accepts LAB, RADIOLOGY, PROCEDURE, MEDICATION and rejects others', () => {
    expect(orderKindEnum.safeParse('LAB').success).toBe(true);
    expect(orderKindEnum.safeParse('RADIOLOGY').success).toBe(true);
    expect(orderKindEnum.safeParse('PROCEDURE').success).toBe(true);
    expect(orderKindEnum.safeParse('MEDICATION').success).toBe(true);
    expect(orderKindEnum.safeParse('NURSING').success).toBe(false);
    expect(orderKindEnum.safeParse('').success).toBe(false);
  });

  // Scenario 3: orderPriorityEnum validates ROUTINE / STAT
  it('3 — orderPriorityEnum accepts ROUTINE and STAT only', () => {
    expect(orderPriorityEnum.safeParse('ROUTINE').success).toBe(true);
    expect(orderPriorityEnum.safeParse('STAT').success).toBe(true);
    expect(orderPriorityEnum.safeParse('URGENT').success).toBe(false);
    expect(orderPriorityEnum.safeParse('ASAP').success).toBe(false);
  });

  // Scenario 4: medicationOrderMetaSchema requires dose, frequency, route, duration
  it('4 — medicationOrderMetaSchema requires dose + frequency + route + duration + quantity + prescribedById + prescribedAt', () => {
    const result = medicationOrderMetaSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain('dose');
      expect(fields).toContain('frequency');
      expect(fields).toContain('route');
      expect(fields).toContain('duration');
    }

    const valid = medicationOrderMetaSchema.safeParse({
      medicationCatalogId: 'med-1',
      dose: '500mg',
      frequency: 'BID',
      route: 'PO',
      duration: '7 days',
      quantity: '14',
      prescribedById: 'doc-1',
      prescribedAt: '2026-01-15T10:00:00.000Z',
    });
    expect(valid.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. State Machine (scenarios 5-9)
// ═══════════════════════════════════════════════════════════════════════
describe('State Machine — canTransition', () => {
  // Scenario 5: PLACED -> ACCEPTED is allowed
  it('5 — PLACED -> ACCEPTED is allowed', () => {
    expect(canTransition('PLACED', 'ACCEPTED')).toBe(true);
  });

  // Scenario 6: ACCEPTED -> IN_PROGRESS is allowed
  it('6 — ACCEPTED -> IN_PROGRESS is allowed', () => {
    expect(canTransition('ACCEPTED', 'IN_PROGRESS')).toBe(true);
  });

  // Scenario 7: COMPLETED is terminal — cannot transition to any status
  it('7 — COMPLETED is terminal and cannot transition to any other status', () => {
    expect(canTransition('COMPLETED', 'PLACED')).toBe(false);
    expect(canTransition('COMPLETED', 'ACCEPTED')).toBe(false);
    expect(canTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
    expect(canTransition('COMPLETED', 'RESULT_READY')).toBe(false);
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
  });

  // Scenario 8: CANCELLED from any non-terminal state is allowed
  it('8 — CANCELLED is reachable from every non-terminal state', () => {
    expect(canTransition('PLACED', 'CANCELLED')).toBe(true);
    expect(canTransition('ACCEPTED', 'CANCELLED')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'CANCELLED')).toBe(true);
    expect(canTransition('RESULT_READY', 'CANCELLED')).toBe(true);
    // Cannot cancel from already-cancelled
    expect(canTransition('CANCELLED', 'CANCELLED')).toBe(false);
  });

  // Scenario 9: Invalid skip transition PLACED -> COMPLETED fails
  it('9 — skipping states is not allowed (PLACED -> COMPLETED fails)', () => {
    expect(canTransition('PLACED', 'COMPLETED')).toBe(false);
    expect(canTransition('PLACED', 'IN_PROGRESS')).toBe(false);
    expect(canTransition('PLACED', 'RESULT_READY')).toBe(false);
    expect(canTransition('ACCEPTED', 'COMPLETED')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. Assignment (scenarios 10-11)
// ═══════════════════════════════════════════════════════════════════════
describe('Assignment', () => {
  // Scenario 10: assignOrderSchema requires userId inside assignedTo
  it('10 — assignOrderSchema requires assignedTo.userId (min 1 char)', () => {
    const empty = assignOrderSchema.safeParse({});
    expect(empty.success).toBe(false);

    const missingUserId = assignOrderSchema.safeParse({ assignedTo: {} });
    expect(missingUserId.success).toBe(false);

    const emptyUserId = assignOrderSchema.safeParse({ assignedTo: { userId: '' } });
    expect(emptyUserId.success).toBe(false);

    const valid = assignOrderSchema.safeParse({ assignedTo: { userId: 'user-1' } });
    expect(valid.success).toBe(true);
  });

  // Scenario 11: order assign route uses withAuthTenant
  it('11 — order assign route is wrapped in withAuthTenant', () => {
    const src = readRoute('app/api/orders/[orderId]/assign/route.ts');
    expect(src).toContain('withAuthTenant');
    expect(src).toContain('assignOrder');
    expect(src).toContain('assignOrderSchema');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. Cancellation (scenarios 12-13)
// ═══════════════════════════════════════════════════════════════════════
describe('Cancellation', () => {
  // Scenario 12: cancelOrderSchema requires cancelReason non-empty
  it('12 — cancelOrderSchema requires non-empty cancelReason', () => {
    const missing = cancelOrderSchema.safeParse({});
    expect(missing.success).toBe(false);

    const empty = cancelOrderSchema.safeParse({ cancelReason: '' });
    expect(empty.success).toBe(false);

    const valid = cancelOrderSchema.safeParse({ cancelReason: 'Patient refused' });
    expect(valid.success).toBe(true);
  });

  // Scenario 13: cancel route calls transitionOrderStatus with CANCELLED and rejects already-completed
  it('13 — cancel route uses transitionOrderStatus with nextStatus CANCELLED and validates cancelReason', () => {
    const src = readRoute('app/api/orders/[orderId]/cancel/route.ts');
    expect(src).toContain('transitionOrderStatus');
    expect(src).toContain("nextStatus: 'CANCELLED'");
    expect(src).toContain('cancelOrderSchema');
    expect(src).toContain('cancelReason');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. Results (scenarios 14-15)
// ═══════════════════════════════════════════════════════════════════════
describe('Results', () => {
  // Scenario 14: Results route exists and uses withAuthTenant
  it('14 — results route exists and is protected by withAuthTenant', () => {
    const src = readRoute('app/api/orders/[orderId]/results/route.ts');
    expect(src).toContain('withAuthTenant');
    expect(src).toContain('withErrorHandler');
    // Supports both GET (fetch results) and POST (submit result)
    expect(src).toContain('export const GET');
    expect(src).toContain('export const POST');
  });

  // Scenario 15: result ack route enforces unique constraint (user can only ack once)
  it('15 — result ack route checks for existing ack to enforce unique user constraint', () => {
    const src = readRoute('app/api/results/[orderResultId]/ack/route.ts');
    expect(src).toContain('withAuthTenant');
    // The route checks if the user already acked before creating a new ack
    expect(src).toContain('resultAck.findFirst');
    expect(src).toContain('noOp: true');
    // Returns existing ack if found (idempotent)
    expect(src).toContain('orderResultId');
    expect(src).toContain('userId');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Order Sets (scenarios 16-18)
// ═══════════════════════════════════════════════════════════════════════
describe('Order Sets', () => {
  // Scenario 16: createOrderSetSchema requires name + scope
  it('16 — createOrderSetSchema requires name and scope', () => {
    const empty = createOrderSetSchema.safeParse({});
    expect(empty.success).toBe(false);
    if (!empty.success) {
      const fields = empty.error.issues.map((i) => i.path[0]);
      expect(fields).toContain('name');
      expect(fields).toContain('scope');
    }

    const valid = createOrderSetSchema.safeParse({
      name: 'ER Initial Workup',
      scope: 'ER',
    });
    expect(valid.success).toBe(true);
  });

  // Scenario 17: applyOrderSetSchema requires encounterType + encounterId
  it('17 — applyOrderSetSchema requires encounterType and encounterId', () => {
    const empty = applyOrderSetSchema.safeParse({});
    expect(empty.success).toBe(false);
    if (!empty.success) {
      const fields = empty.error.issues.map((i) => i.path[0]);
      expect(fields).toContain('encounterType');
      expect(fields).toContain('encounterId');
    }

    const valid = applyOrderSetSchema.safeParse({
      encounterType: 'ER',
      encounterId: 'enc-42',
    });
    expect(valid.success).toBe(true);
  });

  // Scenario 18: orderSetScopeEnum validates ER / OPD / IPD / GLOBAL
  it('18 — orderSetScopeEnum accepts ER, OPD, IPD, GLOBAL and rejects others', () => {
    expect(orderSetScopeEnum.safeParse('ER').success).toBe(true);
    expect(orderSetScopeEnum.safeParse('OPD').success).toBe(true);
    expect(orderSetScopeEnum.safeParse('IPD').success).toBe(true);
    expect(orderSetScopeEnum.safeParse('GLOBAL').success).toBe(true);
    expect(orderSetScopeEnum.safeParse('ICU').success).toBe(false);
    expect(orderSetScopeEnum.safeParse('').success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. Route Wiring (scenarios 19-20)
// ═══════════════════════════════════════════════════════════════════════
describe('Route Wiring', () => {
  // Scenario 19: All order routes use withErrorHandler
  it('19 — all core order routes are wrapped in withErrorHandler', () => {
    const routes = [
      'app/api/orders/route.ts',
      'app/api/orders/[orderId]/accept/route.ts',
      'app/api/orders/[orderId]/cancel/route.ts',
      'app/api/orders/[orderId]/results/route.ts',
      'app/api/orders/[orderId]/assign/route.ts',
      'app/api/orders/queue/route.ts',
      'app/api/order-sets/route.ts',
    ];

    for (const route of routes) {
      const src = readRoute(route);
      expect(src, `${route} should use withErrorHandler`).toContain('withErrorHandler');
    }
  });

  // Scenario 20: order queue route filters by departmentKey
  it('20 — order queue route requires departmentKey filter', () => {
    const src = readRoute('app/api/orders/queue/route.ts');
    expect(src).toContain('departmentKey');
    expect(src).toContain('normalizeDepartmentKey');
    // Returns 400 if no departmentKey supplied
    expect(src).toContain("'departmentKey is required'");
  });
});
