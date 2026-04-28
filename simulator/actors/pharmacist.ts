/**
 * Pharmacist Actor — Dispensing, inventory management.
 */

import { BaseActor, type ActorOptions } from './base';

export class Pharmacist extends BaseActor {
  constructor(opts: Omit<ActorOptions, 'role' | 'label'>) {
    super({ ...opts, role: 'staff', label: 'Pharmacist' });
  }

  /** Dispense medication (or verify/pickup/cancel) */
  async dispense(prescriptionId: string, data?: {
    action?: 'verify' | 'dispense' | 'pickup' | 'cancel';
    notes?: string;
    cancellationReason?: string;
  }): Promise<void> {
    const res = await this.post('/api/pharmacy/dispense', {
      prescriptionId,
      action: data?.action || 'dispense',
      notes: data?.notes,
      cancellationReason: data?.cancellationReason,
    });
    this.assertOk(res, 'Dispense medication');
  }

  /** Get prescriptions queue */
  async getPrescriptions(): Promise<{ prescriptions: unknown[] }> {
    const res = await this.get<{ prescriptions: unknown[] }>('/api/pharmacy/prescriptions');
    return this.assertOk(res, 'Get prescriptions');
  }

  /** Check drug interactions */
  async checkInteractions(medications: string[]): Promise<{ interactions: unknown[] }> {
    const res = await this.post<{ interactions: unknown[] }>('/api/pharmacy/drug-interactions', {
      medications,
    });
    return this.assertOk(res, 'Check drug interactions');
  }

  /** Get inventory */
  async getInventory(): Promise<{ items: unknown[] }> {
    const res = await this.get<{ items: unknown[] }>('/api/pharmacy/inventory');
    return this.assertOk(res, 'Get inventory');
  }

  /** Adjust inventory */
  async adjustInventory(itemId: string, adjustment: {
    quantity: number;
    reason: string;
    type: 'ADD' | 'REMOVE' | 'ADJUST';
  }): Promise<void> {
    const res = await this.post('/api/pharmacy/inventory/adjust', {
      itemId,
      ...adjustment,
    });
    this.assertOk(res, 'Adjust inventory');
  }

  /** Verify medication order */
  async verifyOrder(orderId: string): Promise<void> {
    const res = await this.post(`/api/ipd/med-orders/${orderId}/verify`, {});
    this.assertOk(res, 'Verify med order');
  }
}
