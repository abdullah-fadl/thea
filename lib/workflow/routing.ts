/**
 * Auto-Routing Rules Engine
 *
 * Automatically routes orders to the correct department/modality/specialist
 * based on configurable condition -> action rules.
 *
 * Rules are stored in `workflow_routing_rules` table via Prisma.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoutingCondition {
  field: 'kind' | 'orderCode' | 'priority' | 'department' | 'category';
  operator: 'equals' | 'contains' | 'in' | 'not_equals';
  value: string | string[];
}

export interface RoutingAction {
  type: 'assign_department' | 'assign_room' | 'notify_user' | 'notify_role' | 'set_priority' | 'add_note';
  target: string;
  message?: string;
}

export interface RoutingRule {
  id: string;
  tenantId: string;
  name: string;
  nameAr: string;
  description?: string;
  isActive: boolean;
  priority: number;
  conditions: RoutingCondition[];
  conditionLogic: 'AND' | 'OR';
  actions: RoutingAction[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutingResult {
  ruleId: string;
  ruleName: string;
  actions: RoutingAction[];
  applied: boolean;
}

// ---------------------------------------------------------------------------
// Default Rules
// ---------------------------------------------------------------------------

export const DEFAULT_ROUTING_RULES: Omit<RoutingRule, 'id' | 'tenantId' | 'createdBy' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Lab \u2192 Hematology',
    nameAr: '\u0645\u062E\u062A\u0628\u0631 \u2192 \u0623\u0645\u0631\u0627\u0636 \u0627\u0644\u062F\u0645',
    description: 'Route CBC, ESR, coagulation tests to Hematology lab',
    isActive: true,
    priority: 10,
    conditions: [
      { field: 'kind', operator: 'equals', value: 'LAB' },
      { field: 'orderCode', operator: 'in', value: ['CBC', 'ESR', 'PT', 'PTT', 'DDIR', 'FIB'] },
    ],
    conditionLogic: 'AND',
    actions: [
      { type: 'assign_department', target: 'HEMATOLOGY' },
    ],
  },
  {
    name: 'Lab \u2192 Chemistry',
    nameAr: '\u0645\u062E\u062A\u0628\u0631 \u2192 \u0627\u0644\u0643\u064A\u0645\u064A\u0627\u0621',
    description: 'Route metabolic panels, liver, kidney to Chemistry lab',
    isActive: true,
    priority: 10,
    conditions: [
      { field: 'kind', operator: 'equals', value: 'LAB' },
      { field: 'orderCode', operator: 'in', value: ['BMP', 'CMP', 'LFT', 'RFT', 'LACT', 'GLU', 'HBA1C', 'LIPID', 'ELEC'] },
    ],
    conditionLogic: 'AND',
    actions: [
      { type: 'assign_department', target: 'CHEMISTRY' },
    ],
  },
  {
    name: 'Lab \u2192 Microbiology',
    nameAr: '\u0645\u062E\u062A\u0628\u0631 \u2192 \u0627\u0644\u0623\u062D\u064A\u0627\u0621 \u0627\u0644\u062F\u0642\u064A\u0642\u0629',
    description: 'Route cultures and sensitivity tests to Microbiology',
    isActive: true,
    priority: 10,
    conditions: [
      { field: 'kind', operator: 'equals', value: 'LAB' },
      { field: 'orderCode', operator: 'in', value: ['BC', 'UC', 'SC', 'WC', 'CS', 'AFB'] },
    ],
    conditionLogic: 'AND',
    actions: [
      { type: 'assign_department', target: 'MICROBIOLOGY' },
    ],
  },
  {
    name: 'Radiology CT \u2192 CT Room',
    nameAr: '\u0623\u0634\u0639\u0629 \u0645\u0642\u0637\u0639\u064A\u0629 \u2192 \u063A\u0631\u0641\u0629 \u0627\u0644\u0623\u0634\u0639\u0629 \u0627\u0644\u0645\u0642\u0637\u0639\u064A\u0629',
    isActive: true,
    priority: 10,
    conditions: [
      { field: 'kind', operator: 'equals', value: 'RADIOLOGY' },
      { field: 'orderCode', operator: 'in', value: ['CTH', 'CTA', 'CTC', 'CTP', 'CTAB'] },
    ],
    conditionLogic: 'AND',
    actions: [
      { type: 'assign_room', target: 'CT_ROOM_1' },
    ],
  },
  {
    name: 'Radiology X-Ray \u2192 X-Ray Room',
    nameAr: '\u0623\u0634\u0639\u0629 \u0633\u064A\u0646\u064A\u0629 \u2192 \u063A\u0631\u0641\u0629 \u0627\u0644\u0623\u0634\u0639\u0629',
    isActive: true,
    priority: 10,
    conditions: [
      { field: 'kind', operator: 'equals', value: 'RADIOLOGY' },
      { field: 'orderCode', operator: 'in', value: ['CXR', 'AXR', 'KUB', 'XR'] },
    ],
    conditionLogic: 'AND',
    actions: [
      { type: 'assign_room', target: 'XRAY_ROOM_1' },
    ],
  },
  {
    name: 'STAT Radiology \u2192 Alert Tech',
    nameAr: '\u0623\u0634\u0639\u0629 \u0637\u0627\u0631\u0626\u0629 \u2192 \u062A\u0646\u0628\u064A\u0647 \u0627\u0644\u0641\u0646\u064A',
    isActive: true,
    priority: 5,
    conditions: [
      { field: 'kind', operator: 'equals', value: 'RADIOLOGY' },
      { field: 'priority', operator: 'equals', value: 'STAT' },
    ],
    conditionLogic: 'AND',
    actions: [
      { type: 'notify_role', target: 'radiology_tech', message: 'STAT radiology order requires immediate attention' },
    ],
  },
  {
    name: 'Consult \u2192 Notify Specialist',
    nameAr: '\u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u2192 \u062A\u0646\u0628\u064A\u0647 \u0627\u0644\u0623\u062E\u0635\u0627\u0626\u064A',
    isActive: true,
    priority: 5,
    conditions: [
      { field: 'kind', operator: 'equals', value: 'CONSULT' },
    ],
    conditionLogic: 'AND',
    actions: [
      { type: 'notify_role', target: 'consultant', message: 'New consultation request received' },
    ],
  },
];

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listRoutingRules(
  tenantId: string,
): Promise<RoutingRule[]> {
  const rows = await prisma.workflowRoutingRule.findMany({
    where: { tenantId },
    orderBy: [{ priority: 'asc' }, { name: 'asc' }],
  });

  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    name: r.name,
    nameAr: r.nameAr || '',
    description: r.description || undefined,
    isActive: r.isActive,
    priority: r.priority,
    conditions: (r.conditions as unknown as RoutingCondition[]) || [],
    conditionLogic: (r.conditionLogic as 'AND' | 'OR') || 'AND',
    actions: (r.actions as unknown as RoutingAction[]) || [],
    createdBy: r.createdBy || '',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function createRoutingRule(
  tenantId: string,
  userId: string,
  data: Omit<RoutingRule, 'id' | 'tenantId' | 'createdBy' | 'createdAt' | 'updatedAt'>,
): Promise<RoutingRule> {
  const row = await prisma.workflowRoutingRule.create({
    data: {
      tenantId,
      name: data.name,
      nameAr: data.nameAr,
      description: data.description,
      isActive: data.isActive,
      priority: data.priority,
      conditions: data.conditions as unknown as Prisma.InputJsonValue,
      conditionLogic: data.conditionLogic,
      actions: data.actions as unknown as Prisma.InputJsonValue,
      createdBy: userId,
    },
  });

  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    nameAr: row.nameAr || '',
    description: row.description || undefined,
    isActive: row.isActive,
    priority: row.priority,
    conditions: (row.conditions as unknown as RoutingCondition[]) || [],
    conditionLogic: (row.conditionLogic as 'AND' | 'OR') || 'AND',
    actions: (row.actions as unknown as RoutingAction[]) || [],
    createdBy: row.createdBy || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function updateRoutingRule(
  tenantId: string,
  id: string,
  updates: Partial<RoutingRule>,
): Promise<boolean> {
  const result = await prisma.workflowRoutingRule.updateMany({
    where: { tenantId, id },
    data: {
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.nameAr !== undefined ? { nameAr: updates.nameAr } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
      ...(updates.priority !== undefined ? { priority: updates.priority } : {}),
      ...(updates.conditions !== undefined
        ? { conditions: updates.conditions as unknown as Prisma.InputJsonValue }
        : {}),
      ...(updates.conditionLogic !== undefined ? { conditionLogic: updates.conditionLogic } : {}),
      ...(updates.actions !== undefined
        ? { actions: updates.actions as unknown as Prisma.InputJsonValue }
        : {}),
    },
  });
  return result.count > 0;
}

export async function deleteRoutingRule(
  tenantId: string,
  id: string,
): Promise<boolean> {
  const result = await prisma.workflowRoutingRule.updateMany({
    where: { tenantId, id },
    data: { isActive: false },
  });
  return result.count > 0;
}

export async function seedDefaultRoutingRules(
  tenantId: string,
  userId: string,
): Promise<number> {
  const existing = await prisma.workflowRoutingRule.count({ where: { tenantId } });
  if (existing > 0) return 0;

  for (const rule of DEFAULT_ROUTING_RULES) {
    await prisma.workflowRoutingRule.create({
      data: {
        tenantId,
        name: rule.name,
        nameAr: rule.nameAr,
        description: rule.description,
        isActive: rule.isActive,
        priority: rule.priority,
        conditions: rule.conditions as unknown as Prisma.InputJsonValue,
        conditionLogic: rule.conditionLogic,
        actions: rule.actions as unknown as Prisma.InputJsonValue,
        createdBy: userId,
      },
    });
  }
  return DEFAULT_ROUTING_RULES.length;
}

// ---------------------------------------------------------------------------
// Rule Evaluation Engine
// ---------------------------------------------------------------------------

/**
 * Evaluate all routing rules for a given order.
 * Returns matching rules and their actions.
 */
export async function evaluateRoutingRules(
  tenantId: string,
  order: Record<string, unknown>,
): Promise<RoutingResult[]> {
  const rows = await prisma.workflowRoutingRule.findMany({
    where: { tenantId, isActive: true },
    orderBy: { priority: 'asc' },
  });

  const results: RoutingResult[] = [];

  for (const row of rows) {
    const conditions = (row.conditions as unknown as RoutingCondition[]) || [];
    const conditionLogic = (row.conditionLogic as 'AND' | 'OR') || 'AND';
    const actions = (row.actions as unknown as RoutingAction[]) || [];

    const matches = evaluateConditions(conditions, conditionLogic, order);

    if (matches) {
      results.push({
        ruleId: row.id,
        ruleName: row.name,
        actions,
        applied: true,
      });
    }
  }

  if (results.length > 0) {
    logger.info('Routing rules matched', {
      category: 'api',
      tenantId,
      orderKind: order.kind,
      matchCount: results.length,
    } as Record<string, unknown>);
  }

  return results;
}

/**
 * Apply routing rules to an order -- update the order in DB.
 */
export async function applyRoutingRules(
  tenantId: string,
  orderId: string,
  order: Record<string, unknown>,
): Promise<RoutingResult[]> {
  const results = await evaluateRoutingRules(tenantId, order);

  const updates: Record<string, unknown> = {};
  const notifications: Array<{ target: string; message: string; type: string }> = [];

  for (const result of results) {
    for (const action of result.actions) {
      switch (action.type) {
        case 'assign_department':
          updates.routedDepartment = action.target;
          break;
        case 'assign_room':
          updates.assignedRoom = action.target;
          break;
        case 'set_priority':
          updates.priority = action.target;
          break;
        case 'add_note':
          updates.routingNote = action.message || action.target;
          break;
        case 'notify_user':
        case 'notify_role':
          notifications.push({
            target: action.target,
            message: action.message || `Order ${order.orderName} requires attention`,
            type: action.type,
          });
          break;
      }
    }
  }

  // Apply DB updates to the order via meta JSON field
  if (Object.keys(updates).length > 0) {
    // OrdersHub stores extra routing data in the meta JSON field
    // Also update assignedToDept and priority if applicable
    const orderUpdate: Record<string, unknown> = {};
    if (updates.routedDepartment) orderUpdate.assignedToDept = updates.routedDepartment as string;
    if (updates.priority) orderUpdate.priority = updates.priority as string;
    // Store routing-specific data (assignedRoom, routingNote) in meta
    const metaUpdates: Record<string, unknown> = {};
    if (updates.assignedRoom) metaUpdates.assignedRoom = updates.assignedRoom;
    if (updates.routingNote) metaUpdates.routingNote = updates.routingNote;
    if (updates.routedDepartment) metaUpdates.routedDepartment = updates.routedDepartment;

    if (Object.keys(metaUpdates).length > 0) {
      orderUpdate.meta = metaUpdates;
    }

    await prisma.ordersHub.updateMany({
      where: { tenantId, id: orderId },
      data: orderUpdate,
    });
  }

  // Create in-app notifications
  for (const notif of notifications) {
    await prisma.notification.create({
      data: {
        tenantId,
        kind: 'ALERT',
        type: 'in-app',
        recipientRole: notif.target,
        recipientType: notif.type === 'notify_role' ? 'role' : 'user',
        message: notif.message,
        metadata: { orderId } as unknown as Prisma.InputJsonValue,
        status: 'OPEN',
      },
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Condition Evaluator
// ---------------------------------------------------------------------------

function evaluateConditions(
  conditions: RoutingCondition[],
  logic: 'AND' | 'OR',
  order: Record<string, unknown>,
): boolean {
  if (conditions.length === 0) return false;

  const results = conditions.map((c) => evaluateCondition(c, order));

  return logic === 'AND'
    ? results.every(Boolean)
    : results.some(Boolean);
}

function evaluateCondition(
  condition: RoutingCondition,
  order: Record<string, unknown>,
): boolean {
  const fieldValue = String(order[condition.field] || '');

  switch (condition.operator) {
    case 'equals':
      return fieldValue === String(condition.value);
    case 'not_equals':
      return fieldValue !== String(condition.value);
    case 'contains':
      return fieldValue.includes(String(condition.value));
    case 'in':
      return Array.isArray(condition.value)
        ? condition.value.includes(fieldValue)
        : String(condition.value).split(',').includes(fieldValue);
    default:
      return false;
  }
}
