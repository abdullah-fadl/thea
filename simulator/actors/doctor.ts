/**
 * Doctor Actor — SOAP notes, orders, diagnosis, disposition.
 */

import { BaseActor, type ActorOptions } from './base';
import type { Diagnosis } from '../data/diagnoses';

export class Doctor extends BaseActor {
  constructor(opts: Omit<ActorOptions, 'role' | 'label'>) {
    super({ ...opts, role: 'doctor', label: 'Doctor' });
  }

  /** Write visit notes (SOAP) */
  async writeVisitNotes(encounterCoreId: string, notes: {
    chiefComplaint: string;
    hpiText: string;
    assessment: string;
    plan: string;
    diagnoses?: Diagnosis[];
  }): Promise<void> {
    const res = await this.post(`/api/opd/encounters/${encounterCoreId}/visit-notes`, {
      chiefComplaint: notes.chiefComplaint,
      historyOfPresentIllness: notes.hpiText,
      assessment: notes.assessment,
      plan: notes.plan,
      diagnoses: notes.diagnoses?.map((d, i) => ({
        code: d.code,
        description: d.en,
        descriptionAr: d.ar,
        diagnosisType: i === 0 ? 'PRIMARY' : 'SECONDARY',
        isPrimary: i === 0,
      })),
    });
    this.assertOk(res, 'Write visit notes');
  }

  /** Create an order (lab, radiology, medication, procedure) */
  async createOrder(order: {
    patientId: string;
    encounterCoreId: string;
    kind: 'LAB' | 'RADIOLOGY' | 'MEDICATION' | 'PROCEDURE' | 'NURSING' | 'DIET' | 'CONSULT';
    code: string;
    name: string;
    priority?: string;
    details?: Record<string, unknown>;
  }): Promise<{ orderId: string }> {
    // Normalize priority — API only accepts ROUTINE or STAT
    const priorityMap: Record<string, string> = { URGENT: 'STAT', EMERGENCY: 'STAT', NORMAL: 'ROUTINE' };
    const priority = priorityMap[order.priority || ''] || order.priority || 'ROUTINE';

    // Build meta — medication orders need specific required fields
    let meta: Record<string, unknown> = {
      ...(order.details || {}),
      payment: { status: 'EXEMPTED' },
    };

    if (order.kind === 'MEDICATION') {
      const d = order.details as Record<string, unknown> | undefined;
      meta = {
        medicationCatalogId: order.code,
        dose: (d?.dosage as string) || (d?.dose as string) || '1 tablet',
        frequency: (d?.frequency as string) || 'BID',
        route: (d?.route as string) || 'PO',
        duration: (d?.duration as string) || '5 days',
        quantity: (d?.quantity as string) || '10',
        instructions: (d?.instructions as string) || '',
        payment: { status: 'EXEMPTED' },
      };
    }

    const res = await this.post<{ order: { id: string } }>('/api/orders', {
      patientId: order.patientId,
      encounterCoreId: order.encounterCoreId,
      kind: order.kind,
      orderCode: order.code,
      orderName: order.name,
      priority,
      meta,
      idempotencyKey: `order-${order.encounterCoreId}-${order.code}-${Date.now()}`,
    });
    const raw = this.assertOk(res, `Create ${order.kind} order`);
    return { orderId: raw.order?.id || (raw as Record<string, unknown>).orderId as string || (raw as Record<string, unknown>).id as string };
  }

  /** Set disposition (discharge, admit, referral, etc.) */
  async setDisposition(encounterCoreId: string, disposition: {
    type: 'DISCHARGE' | 'ADMIT' | 'TRANSFER' | 'LEAVE_AMA' | 'DECEASED' | 'OPD_REFERRAL' | 'ER_REFERRAL' | 'ADMISSION';
    instructions?: string;
  }): Promise<void> {
    if (disposition.type === 'DISCHARGE') {
      // Discharge is done by transitioning flow state to COMPLETED
      const res = await this.post(`/api/opd/encounters/${encounterCoreId}/flow-state`, {
        opdFlowState: 'COMPLETED',
        completionReason: 'NORMAL',
        acknowledgeOpenOrders: true,
      });
      this.assertOk(res, 'Discharge patient');
    } else {
      // Referral or admission uses the disposition endpoint
      const typeMap: Record<string, string> = {
        ADMIT: 'ADMISSION',
        TRANSFER: 'OPD_REFERRAL',
      };
      const res = await this.post(`/api/opd/encounters/${encounterCoreId}/disposition`, {
        type: typeMap[disposition.type] || disposition.type,
        note: disposition.instructions || '',
      });
      this.assertOk(res, `Set disposition → ${disposition.type}`);
    }
  }

  /** Get encounter details */
  async getEncounter(encounterCoreId: string): Promise<Record<string, unknown>> {
    const res = await this.get<Record<string, unknown>>(`/api/opd/encounters/${encounterCoreId}`);
    return this.assertOk(res, 'Get encounter');
  }

  /** Get patient orders */
  async getOrders(encounterCoreId: string): Promise<{ orders: Array<{ id: string; status: string }> }> {
    const res = await this.get<{ orders: Array<{ id: string; status: string }> }>(
      `/api/opd/encounters/${encounterCoreId}/orders`,
    );
    return this.assertOk(res, 'Get orders');
  }

  /** Acknowledge result */
  async ackResult(orderResultId: string): Promise<void> {
    const res = await this.post(`/api/results/${orderResultId}/ack`, {});
    this.assertOk(res, 'Acknowledge result');
  }
}
