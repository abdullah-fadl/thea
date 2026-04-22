/**
 * ER Doctor Actor — Assessment, orders, disposition.
 */

import { BaseActor, type ActorOptions } from './base';

export class ErDoctor extends BaseActor {
  constructor(opts: Omit<ActorOptions, 'role' | 'label'>) {
    super({ ...opts, role: 'doctor', label: 'ER Doctor' });
  }

  /** Write doctor notes for ER encounter */
  async writeNotes(encounterId: string, notes: {
    assessment: string;
    plan: string;
  }): Promise<void> {
    const content = `Assessment: ${notes.assessment}\nPlan: ${notes.plan}`;
    const res = await this.post('/api/er/encounters/notes', {
      encounterId,
      content,
    });
    this.assertOk(res, 'Write ER doctor notes');
  }

  /** Create order for ER encounter via the central orders hub */
  async createOrder(encounterId: string, order: {
    kind: string;
    code: string;
    name: string;
    priority?: string;
  }): Promise<{ orderId: string }> {
    // Resolve patientId and encounterCoreId from the ER encounter
    const encounterRes = await this.get<Record<string, unknown>>(
      `/api/er/encounters/${encounterId}`,
    );
    const enc: any = encounterRes.data?.encounter || encounterRes.data || {};
    const patientId =
      enc.patientId || enc.patientMasterId || '';
    // The ER encounter has its own id, but orders hub uses encounterCoreId
    const encounterCoreId = enc.encounterCoreId || encounterId;

    // Normalize priority — API only accepts ROUTINE or STAT
    const priorityMap: Record<string, string> = { URGENT: 'STAT', EMERGENCY: 'STAT', NORMAL: 'ROUTINE' };
    const priority = priorityMap[order.priority || ''] || order.priority || 'STAT';

    const res = await this.post<{ order?: { id: string }; orderId?: string }>('/api/orders', {
      patientId,
      encounterCoreId,
      kind: order.kind,
      orderCode: order.code,
      orderName: order.name,
      priority,
      meta: { payment: { status: 'EXEMPTED' } },
      idempotencyKey: `er-order-${encounterId}-${order.code}-${Date.now()}`,
    });
    const data = this.assertOk(res, `Create ER ${order.kind} order`);
    return { orderId: data.order?.id || data.orderId || (data as Record<string, unknown>).id as string };
  }

  /** Set disposition */
  async setDisposition(encounterId: string, disposition: {
    type: 'DISCHARGE' | 'ADMIT' | 'TRANSFER' | 'DECEASED' | 'LEAVE_AMA';
    destination?: string;
    admitUnit?: string;
  }): Promise<void> {
    const res = await this.post(`/api/er/encounters/${encounterId}/disposition`, {
      type: disposition.type,
      destination: disposition.destination,
      admitUnit: disposition.admitUnit,
    });
    this.assertOk(res, `Set ER disposition → ${disposition.type}`);
  }

  /** Get results for encounter */
  async getResults(encounterId: string): Promise<{ results: unknown[] }> {
    const res = await this.get<{ results: unknown[] }>(`/api/er/encounters/${encounterId}/results`);
    return this.assertOk(res, 'Get ER results');
  }

  /** Get encounter timeline */
  async getTimeline(encounterId: string): Promise<{ events: unknown[] }> {
    const res = await this.get<{ events: unknown[] }>(`/api/er/encounters/${encounterId}/timeline`);
    return this.assertOk(res, 'Get ER timeline');
  }

  /** Acknowledge result */
  async ackResult(encounterId: string, resultId: string): Promise<void> {
    const res = await this.post(`/api/er/encounters/${encounterId}/results/ack`, { resultId });
    this.assertOk(res, 'Ack ER result');
  }
}
