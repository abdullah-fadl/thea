/**
 * Notifications — Verify notifications sent for critical events.
 */

import { BaseActor } from '../actors/base';

export interface NotificationCheckResult {
  check: string;
  passed: boolean;
  details?: string;
}

export class NotificationValidator {
  private actor: BaseActor;

  constructor(actor: BaseActor) {
    this.actor = actor;
  }

  /** Check that notifications inbox has entries */
  async checkInboxNotEmpty(): Promise<NotificationCheckResult> {
    const res = await this.actor.get<{ notifications: unknown[] }>('/api/notifications/inbox');
    if (!res.ok) {
      return { check: 'Notification inbox accessible', passed: false, details: `Status: ${res.status}` };
    }
    const data = res.data as { notifications: unknown[] };
    return {
      check: 'Notification inbox has entries',
      passed: (data.notifications?.length || 0) > 0,
      details: `Count: ${data.notifications?.length || 0}`,
    };
  }

  /** Check for critical lab notification */
  async checkCriticalLabNotification(patientId?: string): Promise<NotificationCheckResult> {
    const res = await this.actor.get<{ notifications: Array<Record<string, unknown>> }>('/api/notifications/inbox');
    if (!res.ok) {
      return { check: 'Critical lab notification exists', passed: false, details: `Status: ${res.status}` };
    }
    const data = res.data as { notifications: Array<Record<string, unknown>> };
    const criticalNotif = data.notifications?.find((n) => {
      const type = String(n.type || n.category || '').toLowerCase();
      return type.includes('critical') || type.includes('lab');
    });

    return {
      check: 'Critical lab notification exists',
      passed: !!criticalNotif,
      details: criticalNotif ? 'Found' : 'Not found (may need event system)',
    };
  }

  /** Check for critical radiology notification */
  async checkCriticalRadiologyNotification(): Promise<NotificationCheckResult> {
    const res = await this.actor.get<{ notifications: Array<Record<string, unknown>> }>('/api/notifications/inbox');
    if (!res.ok) {
      return { check: 'Critical radiology notification exists', passed: false, details: `Status: ${res.status}` };
    }
    const data = res.data as { notifications: Array<Record<string, unknown>> };
    const criticalNotif = data.notifications?.find((n) => {
      const type = String(n.type || n.category || '').toLowerCase();
      return type.includes('critical') || type.includes('radiology');
    });

    return {
      check: 'Critical radiology notification exists',
      passed: !!criticalNotif,
      details: criticalNotif ? 'Found' : 'Not found (may need event system)',
    };
  }
}
