/**
 * Escalation Engine
 *
 * Monitors unacknowledged critical results and unstarted stat orders,
 * escalating notifications through a configurable chain of responsibility.
 *
 * Uses Prisma models: WorkflowEscalationRule, WorkflowEscalationLog,
 * LabResult, OrdersHub, Notification
 */

import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EscalationTrigger =
  | 'critical_lab_unread'
  | 'critical_lab_unacknowledged'
  | 'stat_order_not_started'
  | 'stat_radiology_not_started'
  | 'consult_not_responded'
  | 'vital_sign_alert'
  | 'custom';

export type NotificationChannel = 'in_app' | 'sms' | 'email' | 'push';

export interface EscalationLevel {
  level: number;
  delayMinutes: number;
  notifyRole: string;
  notifyRoleAr?: string;
  channels: NotificationChannel[];
  message: string;
  messageAr?: string;
}

export interface EscalationRule {
  id: string;
  tenantId: string;
  name: string;
  nameAr: string;
  trigger: EscalationTrigger;
  isActive: boolean;
  levels: EscalationLevel[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EscalationEvent {
  id: string;
  tenantId: string;
  ruleId: string;
  trigger: EscalationTrigger;
  resourceType: string;
  resourceId: string;
  patientId?: string;
  currentLevel: number;
  maxLevel: number;
  status: 'active' | 'acknowledged' | 'resolved' | 'expired';
  escalatedAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  notifications: Array<{
    level: number;
    channel: NotificationChannel;
    target: string;
    sentAt: Date;
    delivered: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Default Escalation Rules
// ---------------------------------------------------------------------------

export const DEFAULT_ESCALATION_RULES: Omit<EscalationRule, 'id' | 'tenantId' | 'createdBy' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Critical Lab Result Unread',
    nameAr: '\u0646\u062A\u064A\u062C\u0629 \u062A\u062D\u0644\u064A\u0644 \u062D\u0631\u062C\u0629 \u063A\u064A\u0631 \u0645\u0642\u0631\u0648\u0621\u0629',
    trigger: 'critical_lab_unread',
    isActive: true,
    levels: [
      { level: 1, delayMinutes: 15, notifyRole: 'charge_nurse', notifyRoleAr: '\u0631\u0626\u064A\u0633 \u0627\u0644\u062A\u0645\u0631\u064A\u0636', channels: ['in_app', 'sms'], message: 'Critical lab result unread for 15 minutes', messageAr: '\u0646\u062A\u064A\u062C\u0629 \u062A\u062D\u0644\u064A\u0644 \u062D\u0631\u062C\u0629 \u0644\u0645 \u062A\u064F\u0642\u0631\u0623 \u0645\u0646\u0630 15 \u062F\u0642\u064A\u0642\u0629' },
      { level: 2, delayMinutes: 30, notifyRole: 'department_head', notifyRoleAr: '\u0631\u0626\u064A\u0633 \u0627\u0644\u0642\u0633\u0645', channels: ['in_app', 'sms', 'email'], message: 'Critical lab result unread for 30 minutes \u2014 escalated', messageAr: '\u0646\u062A\u064A\u062C\u0629 \u062A\u062D\u0644\u064A\u0644 \u062D\u0631\u062C\u0629 \u0644\u0645 \u062A\u064F\u0642\u0631\u0623 \u0645\u0646\u0630 30 \u062F\u0642\u064A\u0642\u0629 \u2014 \u062A\u0645 \u0627\u0644\u062A\u0635\u0639\u064A\u062F' },
      { level: 3, delayMinutes: 60, notifyRole: 'medical_director', notifyRoleAr: '\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0637\u0628\u064A', channels: ['in_app', 'sms', 'email'], message: 'URGENT: Critical lab result unread for 60 minutes \u2014 maximum escalation', messageAr: '\u0639\u0627\u062C\u0644: \u0646\u062A\u064A\u062C\u0629 \u062D\u0631\u062C\u0629 \u0644\u0645 \u062A\u064F\u0642\u0631\u0623 \u0645\u0646\u0630 60 \u062F\u0642\u064A\u0642\u0629 \u2014 \u0623\u0639\u0644\u0649 \u062A\u0635\u0639\u064A\u062F' },
    ],
  },
  {
    name: 'STAT Radiology Not Started',
    nameAr: '\u0623\u0634\u0639\u0629 \u0637\u0627\u0631\u0626\u0629 \u0644\u0645 \u062A\u0628\u062F\u0623',
    trigger: 'stat_radiology_not_started',
    isActive: true,
    levels: [
      { level: 1, delayMinutes: 30, notifyRole: 'radiology_supervisor', channels: ['in_app', 'sms'], message: 'STAT radiology order not started after 30 minutes', messageAr: '\u0637\u0644\u0628 \u0623\u0634\u0639\u0629 \u0637\u0627\u0631\u0626 \u0644\u0645 \u064A\u0628\u062F\u0623 \u0645\u0646\u0630 30 \u062F\u0642\u064A\u0642\u0629' },
      { level: 2, delayMinutes: 60, notifyRole: 'department_head', channels: ['in_app', 'sms', 'email'], message: 'STAT radiology order not started after 60 minutes \u2014 escalated', messageAr: '\u0637\u0644\u0628 \u0623\u0634\u0639\u0629 \u0637\u0627\u0631\u0626 \u0644\u0645 \u064A\u0628\u062F\u0623 \u0645\u0646\u0630 60 \u062F\u0642\u064A\u0642\u0629 \u2014 \u062A\u0635\u0639\u064A\u062F' },
    ],
  },
  {
    name: 'Consult Not Responded',
    nameAr: '\u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u0628\u062F\u0648\u0646 \u0631\u062F',
    trigger: 'consult_not_responded',
    isActive: true,
    levels: [
      { level: 1, delayMinutes: 60, notifyRole: 'consultant_on_call', channels: ['in_app', 'sms'], message: 'Consult request not responded after 60 minutes', messageAr: '\u0637\u0644\u0628 \u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u0644\u0645 \u064A\u064F\u0631\u062F \u0639\u0644\u064A\u0647 \u0645\u0646\u0630 60 \u062F\u0642\u064A\u0642\u0629' },
      { level: 2, delayMinutes: 120, notifyRole: 'department_head', channels: ['in_app', 'sms', 'email'], message: 'Consult request not responded after 2 hours \u2014 escalated', messageAr: '\u0637\u0644\u0628 \u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u0644\u0645 \u064A\u064F\u0631\u062F \u0639\u0644\u064A\u0647 \u0645\u0646\u0630 \u0633\u0627\u0639\u062A\u064A\u0646 \u2014 \u062A\u0635\u0639\u064A\u062F' },
    ],
  },
];

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listEscalationRules(tenantId: string): Promise<EscalationRule[]> {
  const docs = await prisma.workflowEscalationRule.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
  });
  return docs.map((d) => ({
    id: d.id,
    tenantId: d.tenantId,
    name: d.name,
    nameAr: d.nameAr || '',
    trigger: (d.trigger || 'custom') as EscalationTrigger,
    isActive: d.isActive,
    levels: (d.levels as unknown as EscalationLevel[]) || [],
    createdBy: d.createdBy || '',
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}

export async function createEscalationRule(
  tenantId: string,
  userId: string,
  data: Omit<EscalationRule, 'id' | 'tenantId' | 'createdBy' | 'createdAt' | 'updatedAt'>,
): Promise<EscalationRule> {
  const doc = await prisma.workflowEscalationRule.create({
    data: {
      tenantId,
      name: data.name,
      nameAr: data.nameAr,
      trigger: data.trigger,
      isActive: data.isActive,
      levels: data.levels as unknown as Prisma.InputJsonValue,
      createdBy: userId,
    },
  });
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    name: doc.name,
    nameAr: doc.nameAr || '',
    trigger: (doc.trigger || 'custom') as EscalationTrigger,
    isActive: doc.isActive,
    levels: (doc.levels as unknown as EscalationLevel[]) || [],
    createdBy: doc.createdBy || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function updateEscalationRule(
  tenantId: string,
  id: string,
  updates: Partial<EscalationRule>,
): Promise<boolean> {
  const result = await prisma.workflowEscalationRule.updateMany({
    where: { tenantId, id },
    data: {
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.nameAr !== undefined ? { nameAr: updates.nameAr } : {}),
      ...(updates.trigger !== undefined ? { trigger: updates.trigger } : {}),
      ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
      ...(updates.levels !== undefined ? { levels: updates.levels as unknown as Prisma.InputJsonValue } : {}),
    },
  });
  return result.count > 0;
}

export async function seedDefaultEscalationRules(tenantId: string, userId: string): Promise<number> {
  const existing = await prisma.workflowEscalationRule.count({ where: { tenantId } });
  if (existing > 0) return 0;

  for (const rule of DEFAULT_ESCALATION_RULES) {
    await prisma.workflowEscalationRule.create({
      data: {
        tenantId,
        name: rule.name,
        nameAr: rule.nameAr,
        trigger: rule.trigger,
        isActive: rule.isActive,
        levels: rule.levels as unknown as Prisma.InputJsonValue,
        createdBy: userId,
      },
    });
  }
  return DEFAULT_ESCALATION_RULES.length;
}

// ---------------------------------------------------------------------------
// Escalation Checker — Run periodically
// ---------------------------------------------------------------------------

export async function runEscalationCheck(tenantId: string): Promise<EscalationEvent[]> {
  const rules = await prisma.workflowEscalationRule.findMany({
    where: { tenantId, isActive: true },
  });

  const newEvents: EscalationEvent[] = [];

  for (const rule of rules) {
    const ruleData: EscalationRule = {
      id: rule.id,
      tenantId: rule.tenantId,
      name: rule.name,
      nameAr: rule.nameAr || '',
      trigger: (rule.trigger || 'custom') as EscalationTrigger,
      isActive: rule.isActive,
      levels: (rule.levels as unknown as EscalationLevel[]) || [],
      createdBy: rule.createdBy || '',
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };

    const items = await findEscalationCandidates(tenantId, ruleData.trigger);

    for (const item of items) {
      const minutesElapsed = getMinutesElapsed(item.createdAt as Date);
      const applicableLevel = getApplicableLevel(ruleData.levels, minutesElapsed);

      if (!applicableLevel) continue;

      // Check if already escalated at this level
      const existingEvent = await prisma.workflowEscalationLog.findFirst({
        where: {
          tenantId,
          ruleId: ruleData.id,
          resourceId: item.id as string,
          currentLevel: { gte: applicableLevel.level },
          status: 'active',
        },
      });

      if (existingEvent) continue;

      // Create escalation event
      const event = await createEscalationEvent(tenantId, ruleData, item, applicableLevel);
      newEvents.push(event);
    }
  }

  if (newEvents.length > 0) {
    logger.info('Escalation check completed', {
      category: 'api',
      tenantId,
      escalationsCreated: newEvents.length,
    } as Record<string, unknown>);
  }

  return newEvents;
}

export async function acknowledgeEscalation(
  tenantId: string,
  eventId: string,
  userId: string,
): Promise<boolean> {
  const result = await prisma.workflowEscalationLog.updateMany({
    where: { tenantId, id: eventId, status: 'active' },
    data: {
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      acknowledgedBy: userId,
    },
  });
  return result.count > 0;
}

export async function getActiveEscalations(
  tenantId: string,
  options?: { trigger?: string; limit?: number },
): Promise<EscalationEvent[]> {
  const where: Record<string, unknown> = { tenantId, status: 'active' };
  if (options?.trigger) where.trigger = options.trigger;

  const docs = await prisma.workflowEscalationLog.findMany({
    where,
    orderBy: { escalatedAt: 'desc' },
    take: options?.limit || 50,
  });

  return docs.map((d) => ({
    id: d.id,
    tenantId: d.tenantId,
    ruleId: d.ruleId,
    trigger: (d.trigger || 'custom') as EscalationTrigger,
    resourceType: d.resourceType || '',
    resourceId: d.resourceId || '',
    patientId: d.patientId || undefined,
    currentLevel: d.currentLevel,
    maxLevel: d.maxLevel,
    status: d.status as EscalationEvent['status'],
    escalatedAt: d.escalatedAt,
    acknowledgedAt: d.acknowledgedAt || undefined,
    acknowledgedBy: d.acknowledgedBy || undefined,
    resolvedAt: d.resolvedAt || undefined,
    notifications: (d.notifications as unknown as EscalationEvent['notifications']) || [],
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function findEscalationCandidates(
  tenantId: string,
  trigger: EscalationTrigger,
): Promise<Record<string, unknown>[]> {
  switch (trigger) {
    case 'critical_lab_unread':
      // NOTE: LabResult model doesn't have 'flag' or 'isRead' columns.
      // Using status='VERIFIED' as a proxy for final critical results.
      // TODO: Add flag/isRead columns to LabResult model or use a different approach.
      return (await prisma.labResult.findMany({
        where: {
          tenantId,
          status: 'VERIFIED',
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })) as unknown as Record<string, unknown>[];

    case 'stat_radiology_not_started':
      return (await prisma.ordersHub.findMany({
        where: {
          tenantId,
          kind: 'RADIOLOGY',
          priority: 'STAT',
          status: 'ORDERED',
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })) as unknown as Record<string, unknown>[];

    case 'stat_order_not_started':
      return (await prisma.ordersHub.findMany({
        where: {
          tenantId,
          priority: 'STAT',
          status: 'ORDERED',
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })) as unknown as Record<string, unknown>[];

    case 'consult_not_responded':
      return (await prisma.ordersHub.findMany({
        where: {
          tenantId,
          kind: 'CONSULTATION',
          status: 'ORDERED',
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })) as unknown as Record<string, unknown>[];

    default:
      return [];
  }
}

function getMinutesElapsed(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 60000);
}

function getApplicableLevel(
  levels: EscalationLevel[],
  minutesElapsed: number,
): EscalationLevel | null {
  const sorted = [...levels].sort((a, b) => b.level - a.level);
  return sorted.find((l) => minutesElapsed >= l.delayMinutes) || null;
}

async function createEscalationEvent(
  tenantId: string,
  rule: EscalationRule,
  item: Record<string, unknown>,
  level: EscalationLevel,
): Promise<EscalationEvent> {
  const now = new Date();

  const notifications = [{
    level: level.level,
    channel: level.channels[0] || 'in_app',
    target: level.notifyRole,
    sentAt: now,
    delivered: true,
  }];

  const doc = await prisma.workflowEscalationLog.create({
    data: {
      tenantId,
      ruleId: rule.id,
      trigger: rule.trigger,
      resourceType: rule.trigger.includes('lab') ? 'lab_result' : 'order',
      resourceId: item.id as string,
      patientId: (item.patientId || item.patientMasterId) as string | undefined,
      currentLevel: level.level,
      maxLevel: Math.max(...rule.levels.map((l) => l.level)),
      status: 'active',
      escalatedAt: now,
      notifications: notifications as unknown as Prisma.InputJsonValue,
    },
  });

  // Create in-app notification
  await prisma.notification.create({
    data: {
      tenantId,
      type: 'in-app',
      kind: 'ALERT',
      scope: 'SYSTEM',
      recipientRole: level.notifyRole,
      recipientType: 'role',
      title: `Escalation Level ${level.level}`,
      message: level.message,
      status: 'OPEN',
      severity: level.level >= 3 ? 'CRITICAL' : level.level >= 2 ? 'WARNING' : 'INFO',
      metadata: {
        resourceType: rule.trigger.includes('lab') ? 'lab_result' : 'order',
        resourceId: item.id as string,
        escalationEventId: doc.id,
      },
    },
  });

  return {
    id: doc.id,
    tenantId: doc.tenantId,
    ruleId: doc.ruleId,
    trigger: (doc.trigger || 'custom') as EscalationTrigger,
    resourceType: doc.resourceType || '',
    resourceId: doc.resourceId || '',
    patientId: doc.patientId || undefined,
    currentLevel: doc.currentLevel,
    maxLevel: doc.maxLevel,
    status: doc.status as EscalationEvent['status'],
    escalatedAt: doc.escalatedAt,
    acknowledgedAt: doc.acknowledgedAt || undefined,
    acknowledgedBy: doc.acknowledgedBy || undefined,
    resolvedAt: doc.resolvedAt || undefined,
    notifications,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
