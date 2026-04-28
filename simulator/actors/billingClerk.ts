/**
 * Billing Clerk Actor — Charges, payments, claims, invoices.
 */

import { BaseActor, type ActorOptions } from './base';

export class BillingClerk extends BaseActor {
  constructor(opts: Omit<ActorOptions, 'role' | 'label'>) {
    super({ ...opts, role: 'staff', label: 'Billing Clerk' });
  }

  /** Record charge event */
  async recordCharge(data: {
    patientId: string;
    encounterCoreId: string;
    code: string;
    description: string;
    amount: number;
    quantity?: number;
    departmentKey?: string;
    chargeCatalogId?: string;
  }): Promise<{ chargeEventId: string }> {
    // Look up or create a charge catalog item to get a valid chargeCatalogId
    let catalogId = data.chargeCatalogId;
    if (!catalogId) {
      // Try to find an existing catalog item matching the code
      const catalogRes = await this.get<{ items: Array<{ id: string; code?: string }> }>('/api/billing/charge-catalog', {
        search: data.code,
        limit: '1',
      });
      if (catalogRes.ok && catalogRes.data?.items && catalogRes.data.items.length > 0) {
        catalogId = catalogRes.data.items[0].id;
      } else {
        // Create a new catalog item
        const createRes = await this.post<{ charge?: { id: string }; item?: { id: string }; id?: string }>('/api/billing/charge-catalog', {
          name: data.description,
          itemType: 'PROCEDURE',
          unitType: 'PER_PROCEDURE',
          basePrice: data.amount,
          allowedForCash: true,
          allowedForInsurance: true,
          applicability: ['ER', 'OPD', 'IPD'],
        });
        if (createRes.ok) {
          catalogId = createRes.data?.charge?.id || createRes.data?.item?.id || createRes.data?.id;
        }
      }
    }

    if (!catalogId) {
      throw new Error('Failed to resolve chargeCatalogId for billing charge event');
    }

    const res = await this.post<{ chargeEventId: string }>('/api/billing/charge-events', {
      encounterCoreId: data.encounterCoreId,
      patientMasterId: data.patientId,
      departmentKey: data.departmentKey || 'er',
      source: { type: 'MANUAL' },
      chargeCatalogId: catalogId,
      quantity: data.quantity || 1,
      payerType: 'CASH',
      reason: data.description,
    });
    return this.assertOk(res, 'Record charge');
  }

  /** Set payer context (CASH / INSURANCE) — must be called before locking */
  async setPayerContext(data: {
    encounterCoreId: string;
    mode: 'CASH' | 'INSURANCE';
    insuranceCompanyId?: string;
    insuranceCompanyName?: string;
    memberOrPolicyRef?: string;
  }): Promise<Record<string, unknown>> {
    const res = await this.post<Record<string, unknown>>('/api/billing/payer-context/set', {
      encounterCoreId: data.encounterCoreId,
      mode: data.mode,
      insuranceCompanyId: data.insuranceCompanyId,
      insuranceCompanyName: data.insuranceCompanyName,
      memberOrPolicyRef: data.memberOrPolicyRef,
      idempotencyKey: `sim-payer-${data.encounterCoreId}-${Date.now()}`,
    });
    return this.assertOk(res, 'Set payer context');
  }

  /** Lock billing — must be called before posting */
  async lockBilling(encounterCoreId: string): Promise<Record<string, unknown>> {
    const res = await this.post<Record<string, unknown>>('/api/billing/lock/lock', {
      encounterCoreId,
      reason: 'Finalized for payment',
      idempotencyKey: `sim-lock-${encounterCoreId}-${Date.now()}`,
    });
    return this.assertOk(res, 'Lock billing');
  }

  /** Post billing — must be called after locking, before payment */
  async postBilling(encounterCoreId: string): Promise<Record<string, unknown>> {
    const res = await this.post<Record<string, unknown>>('/api/billing/posting/post', {
      encounterCoreId,
      idempotencyKey: `sim-post-${encounterCoreId}-${Date.now()}`,
    });
    return this.assertOk(res, 'Post billing');
  }

  /** Record payment */
  async recordPayment(data: {
    patientId: string;
    encounterCoreId?: string;
    amount: number;
    method: 'CASH' | 'CARD' | 'INSURANCE_COPAY' | 'BANK_TRANSFER' | 'ONLINE';
    currency?: 'SAR' | 'USD' | 'EUR' | 'AED' | 'KWD' | 'BHD' | 'QAR' | 'OMR' | 'EGP' | 'JOD';
  }): Promise<{ paymentId: string }> {
    const res = await this.post<{ paymentId: string }>('/api/billing/payments/record', {
      encounterCoreId: data.encounterCoreId,
      method: data.method,
      amount: data.amount,
      currency: data.currency || 'SAR',
      idempotencyKey: `sim-pay-${data.encounterCoreId || data.patientId}-${Date.now()}`,
    });
    return this.assertOk(res, 'Record payment');
  }

  /** Get charge summary */
  async getChargeSummary(params?: Record<string, string>): Promise<Record<string, unknown>> {
    const res = await this.get<Record<string, unknown>>('/api/billing/charge-summary', params);
    return this.assertOk(res, 'Get charge summary');
  }

  /** Create claim */
  async createClaim(data: {
    patientId: string;
    encounterCoreId: string;
    payerId: string;
    totalAmount: number;
  }): Promise<{ claimId: string }> {
    const res = await this.post<{ claimId: string }>('/api/billing/claims', {
      patientId: data.patientId,
      encounterCoreId: data.encounterCoreId,
      payerId: data.payerId,
      totalAmount: data.totalAmount,
    });
    return this.assertOk(res, 'Create claim');
  }

  /** Submit claim */
  async submitClaim(claimId: string): Promise<void> {
    const res = await this.post(`/api/billing/claims/${claimId}/submit`, {});
    this.assertOk(res, 'Submit claim');
  }

  /** Check insurance eligibility */
  async checkEligibility(data: {
    patientId: string;
    payerId: string;
    memberId: string;
  }): Promise<Record<string, unknown>> {
    const res = await this.post<Record<string, unknown>>('/api/billing/eligibility', data);
    return this.assertOk(res, 'Check eligibility');
  }

  /** Get invoice draft */
  async getInvoiceDraft(encounterCoreId: string): Promise<Record<string, unknown>> {
    const res = await this.get<Record<string, unknown>>('/api/billing/invoice-draft', {
      encounterCoreId,
    });
    return this.assertOk(res, 'Get invoice draft');
  }

  /** Get payments list */
  async getPayments(params?: Record<string, string>): Promise<{ payments: unknown[] }> {
    const res = await this.get<{ payments: unknown[] }>('/api/billing/payments', params);
    return this.assertOk(res, 'Get payments');
  }

  /** Get balance */
  async getBalance(encounterCoreId: string): Promise<Record<string, unknown>> {
    const res = await this.get<Record<string, unknown>>('/api/billing/balance', { encounterCoreId });
    return this.assertOk(res, 'Get balance');
  }
}
