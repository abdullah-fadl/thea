import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Event Dispatcher — event-driven integration layer
 * dispatches events to registered handlers across all systems.
 */

export type EventType =
  | 'employee.created' | 'employee.updated' | 'employee.terminated' | 'employee.resigned'
  | 'leave.requested' | 'leave.approved' | 'leave.rejected'
  | 'loan.requested' | 'loan.approved' | 'loan.rejected'
  | 'contract.created' | 'contract.expiring' | 'contract.expired'
  | 'training.enrolled' | 'training.completed'
  | 'performance.review_submitted' | 'performance.cycle_closed'
  | 'letter.requested' | 'letter.generated'
  | 'travel.requested' | 'travel.approved'
  | 'workflow.step_completed' | 'workflow.approved' | 'workflow.rejected'
  | 'approval.pending' | 'expiry.alert';

export interface EventPayload {
  tenantId: string;
  eventType: EventType;
  resourceType: string;
  resourceId: string;
  data: any;
  triggeredBy: string;
  timestamp: Date;
}

type EventHandler = (payload: EventPayload) => Promise<void>;

const handlers: Partial<Record<EventType, EventHandler[]>> = {};

export function registerHandler(eventType: EventType, handler: EventHandler) {
  if (!handlers[eventType]) handlers[eventType] = [];
  handlers[eventType]!.push(handler);
}

export async function dispatchEvent(payload: EventPayload): Promise<void> {
  const eventHandlers = handlers[payload.eventType] || [];
  for (const handler of eventHandlers) {
    try {
      await handler(payload);
    } catch (err) {
      logger.error(`[CVision Event] Handler failed for ${payload.eventType}:`, err);
    }
  }
}

export function createEvent(tenantId: string, eventType: EventType, resourceType: string, resourceId: string, data: any, triggeredBy: string): EventPayload {
  return { tenantId, eventType, resourceType, resourceId, data, triggeredBy, timestamp: new Date() };
}
