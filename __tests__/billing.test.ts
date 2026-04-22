import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  createChargeEventSchema,
  createClaimSchema,
  rejectClaimSchema,
  remitClaimSchema,
  createPaymentSchema,
  recordPaymentSchema,
  createCreditNoteSchema,
  creditNoteTypeEnum,
  billingLockSchema,
  postingSchema,
  unpostSchema,
  createChargeCatalogSchema,
  chargeItemTypeEnum,
  unitTypeEnum,
  createPlanSchema,
  createPayerSchema,
  payerContextSetSchema,
  payerModeEnum,
  validatePromoCodeSchema,
  invoiceItemSchema,
  createInvoiceDraftSchema,
  claimRejectionCodeEnum,
} from '@/lib/validation/billing.schema';
import { getChargeCodePrefix } from '@/lib/billing/chargeCatalogCode';
import { canAccessBilling } from '@/lib/billing/access';

function readRoute(...segments: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: Charge Events (B-01 .. B-04)
// ─────────────────────────────────────────────────────────────────────────────
describe('Billing — Charge Events', () => {
  // B-01: createChargeEventSchema validation
  it('B-01: createChargeEventSchema accepts a valid charge event', () => {
    const valid = {
      encounterCoreId: 'enc-001',
      departmentKey: 'EMERGENCY',
      source: { type: 'MANUAL' },
      chargeCatalogId: 'cat-001',
      quantity: 3,
    };
    const result = createChargeEventSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(3);
      expect(result.data.source.type).toBe('MANUAL');
    }

    // Missing required fields should fail
    const missing = { departmentKey: 'OPD' };
    const fail = createChargeEventSchema.safeParse(missing);
    expect(fail.success).toBe(false);
  });

  // B-02: charge-events route checks billing lock before creating
  it('B-02: charge-events route guards against billing lock', () => {
    const src = readRoute('app', 'api', 'billing', 'charge-events', 'route.ts');
    // Route must check billingLock.isLocked and return 409 if locked
    expect(src).toContain('billingLock');
    expect(src).toContain('isLocked');
    expect(src).toContain('Billing is locked');
    // Also verifies posting status guard
    expect(src).toContain('BILLING_POSTED');
  });

  // B-03: zero-charge prevention [B-01 guard]
  it('B-03: charge-events route prevents zero-amount manual charges [B-01]', () => {
    const src = readRoute('app', 'api', 'billing', 'charge-events', 'route.ts');
    expect(src).toContain('ZERO_CHARGE');
    expect(src).toContain('Cannot create a zero-amount manual charge');
  });

  // B-04: pre-auth enforcement [B-02 guard]
  it('B-04: charge-events route enforces pre-auth for insurance procedures [B-02]', () => {
    const src = readRoute('app', 'api', 'billing', 'charge-events', 'route.ts');
    expect(src).toContain('PREAUTH_REQUIRED');
    expect(src).toContain('Pre-authorization is required for procedure charges under insurance');
    // Verifies PROCEDURE item type triggers the check
    expect(src).toContain("catalogItemType === 'PROCEDURE'");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: Claims (B-05 .. B-08)
// ─────────────────────────────────────────────────────────────────────────────
describe('Billing — Claims', () => {
  // B-05: createClaimSchema validation
  it('B-05: createClaimSchema requires encounterCoreId', () => {
    const valid = { encounterCoreId: 'enc-100' };
    const result = createClaimSchema.safeParse(valid);
    expect(result.success).toBe(true);

    const empty = {};
    const fail = createClaimSchema.safeParse(empty);
    expect(fail.success).toBe(false);

    // Empty string should also fail (min 1)
    const blank = { encounterCoreId: '' };
    const failBlank = createClaimSchema.safeParse(blank);
    expect(failBlank.success).toBe(false);
  });

  // B-06: rejectClaimSchema requires both reasonCode and reasonText
  it('B-06: rejectClaimSchema requires rejection code from enum and reasonText', () => {
    const valid = { reasonCode: 'CODING_ERROR', reasonText: 'Wrong ICD-10 mapping' };
    const result = rejectClaimSchema.safeParse(valid);
    expect(result.success).toBe(true);

    // Missing reasonText
    const noText = { reasonCode: 'DUPLICATE' };
    expect(rejectClaimSchema.safeParse(noText).success).toBe(false);

    // Invalid rejection code
    const badCode = { reasonCode: 'INVALID_CODE', reasonText: 'test' };
    expect(rejectClaimSchema.safeParse(badCode).success).toBe(false);

    // Verify all valid rejection codes
    const validCodes = ['MISSING_INFO', 'CODING_ERROR', 'ELIGIBILITY', 'DUPLICATE', 'OTHER'];
    validCodes.forEach((code) => {
      const r = claimRejectionCodeEnum.safeParse(code);
      expect(r.success).toBe(true);
    });
  });

  // B-07: claim submit route checks DRAFT status before submitting
  it('B-07: claim submit route validates DRAFT status before transition', () => {
    const src = readRoute('app', 'api', 'billing', 'claims', '[claimId]', 'submit', 'route.ts');
    expect(src).toContain("status !== 'DRAFT'");
    expect(src).toContain('Invalid transition');
    // Verify it sets status to SUBMITTED
    expect(src).toContain("status: 'SUBMITTED'");
  });

  // B-08: claims POST route requires billing locked + posted before claim creation
  it('B-08: claims route requires billing locked and posted before creating a claim', () => {
    const src = readRoute('app', 'api', 'billing', 'claims', 'route.ts');
    expect(src).toContain('Billing must be locked before creating a claim');
    expect(src).toContain('Billing must be posted before creating a claim');
    expect(src).toContain("billingPosting?.status !== 'POSTED'");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: Payments (B-09 .. B-11)
// ─────────────────────────────────────────────────────────────────────────────
describe('Billing — Payments', () => {
  // B-09: createPaymentSchema validation
  it('B-09: createPaymentSchema validates amount and method', () => {
    const valid = {
      amount: 250.00,
      method: 'CASH',
    };
    const result = createPaymentSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('COMPLETED'); // default
    }

    // Negative amount should fail (positive required)
    const negative = { amount: -10, method: 'CASH' };
    expect(createPaymentSchema.safeParse(negative).success).toBe(false);

    // Zero amount should fail (positive required)
    const zero = { amount: 0, method: 'CARD' };
    expect(createPaymentSchema.safeParse(zero).success).toBe(false);

    // Exceeds max
    const tooLarge = { amount: 10_000_000, method: 'CASH' };
    expect(createPaymentSchema.safeParse(tooLarge).success).toBe(false);

    // Invalid method
    const badMethod = { amount: 100, method: 'CRYPTO' };
    expect(createPaymentSchema.safeParse(badMethod).success).toBe(false);
  });

  // B-10: recordPaymentSchema validation
  it('B-10: recordPaymentSchema requires encounterCoreId, method, amount, currency, and idempotencyKey', () => {
    const valid = {
      encounterCoreId: 'enc-200',
      method: 'CARD',
      amount: 500,
      currency: 'SAR',
      idempotencyKey: 'idem-001',
    };
    const result = recordPaymentSchema.safeParse(valid);
    expect(result.success).toBe(true);

    // Missing idempotencyKey
    const noKey = { encounterCoreId: 'enc-200', method: 'CASH', amount: 100, currency: 'SAR' };
    expect(recordPaymentSchema.safeParse(noKey).success).toBe(false);

    // Invalid currency
    const badCurrency = {
      encounterCoreId: 'enc-200',
      method: 'CASH',
      amount: 100,
      currency: 'BTC',
      idempotencyKey: 'k1',
    };
    expect(recordPaymentSchema.safeParse(badCurrency).success).toBe(false);
  });

  // B-11: payments route uses createPaymentSchema and marks invoice PAID
  it('B-11: payments route wires createPaymentSchema and marks invoice as PAID on completion', () => {
    const src = readRoute('app', 'api', 'billing', 'payments', 'route.ts');
    expect(src).toContain("from '@/lib/validation/billing.schema'");
    expect(src).toContain('createPaymentSchema');
    expect(src).toContain("status: 'PAID'");
    // Should use canAccessBilling guard
    expect(src).toContain('canAccessBilling');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: Catalog (B-12 .. B-14)
// ─────────────────────────────────────────────────────────────────────────────
describe('Billing — Charge Catalog', () => {
  // B-12: createChargeCatalogSchema validates itemType enum
  it('B-12: createChargeCatalogSchema validates itemType from chargeItemTypeEnum', () => {
    const validTypes = ['VISIT', 'LAB_TEST', 'IMAGING', 'PROCEDURE', 'MEDICATION', 'BED', 'SUPPLY', 'SERVICE'];
    validTypes.forEach((t) => {
      expect(chargeItemTypeEnum.safeParse(t).success).toBe(true);
    });
    expect(chargeItemTypeEnum.safeParse('UNKNOWN').success).toBe(false);

    const valid = {
      name: 'CBC Test',
      itemType: 'LAB_TEST',
      unitType: 'PER_TEST',
      basePrice: 150,
      allowedForCash: true,
      allowedForInsurance: true,
    };
    const result = createChargeCatalogSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      // applicability defaults to ['ER'] when not provided
      expect(result.data.applicability).toEqual(['ER']);
      expect(result.data.status).toBe('ACTIVE');
    }
  });

  // B-13: charge catalog route handles unique code constraint (P2002)
  it('B-13: charge-catalog route handles unique code constraint violation', () => {
    const src = readRoute('app', 'api', 'billing', 'charge-catalog', 'route.ts');
    expect(src).toContain('P2002');
    expect(src).toContain('Charge code already exists');
    // Uses allocateChargeCatalogCode for auto-generated codes
    expect(src).toContain('allocateChargeCatalogCode');
  });

  // B-14: charge catalog code prefixes match each item type
  it('B-14: getChargeCodePrefix returns correct prefix for each item type', () => {
    const expected: Record<string, string> = {
      VISIT: 'VIS',
      LAB_TEST: 'LAB',
      IMAGING: 'IMG',
      PROCEDURE: 'PRC',
      MEDICATION: 'MED',
      BED: 'BED',
      SUPPLY: 'SUP',
      SERVICE: 'SRV',
    };

    Object.entries(expected).forEach(([itemType, prefix]) => {
      const config = getChargeCodePrefix(itemType);
      expect(config).toBeDefined();
      expect(config!.prefix).toBe(prefix);
      expect(config!.pad).toBe(4);
    });

    // Unknown type should return undefined
    expect(getChargeCodePrefix('UNKNOWN')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 5: Pricing & Access (B-15 .. B-17)
// ─────────────────────────────────────────────────────────────────────────────
describe('Billing — Pricing & Access', () => {
  // B-15: getConsultationPrice is exported from pricing lib
  it('B-15: getConsultationPrice is available from pricing lib', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'lib', 'billing', 'pricing.ts'), 'utf-8');
    expect(src).toContain('getConsultationPrice');
  });

  // B-16: visit-pricing route uses determineVisitPricing from visitPricing lib
  it('B-16: visit-pricing route imports and calls determineVisitPricing', () => {
    const src = readRoute('app', 'api', 'billing', 'visit-pricing', 'route.ts');
    expect(src).toContain("from '@/lib/billing/visitPricing'");
    expect(src).toContain('determineVisitPricing');
    // Required params: patientId, doctorId
    expect(src).toContain('patientId');
    expect(src).toContain('doctorId');
    // Returns 400 if missing
    expect(src).toContain('Missing parameters');
  });

  // B-17: canAccessBilling grants access to expected roles
  it('B-17: canAccessBilling grants access to admin, finance, reception, and charge operators', () => {
    const allowed = ['admin', 'finance', 'finance_manager', 'billing', 'billing_manager',
      'reception', 'receptionist', 'front_desk',
      'opd-reception', 'opd-admin', 'opd-charge-nurse',
      'reception-staff', 'reception-supervisor', 'reception-admin',
      'staff', 'billing-staff',
    ];
    allowed.forEach((role) => {
      expect(canAccessBilling({ email: 'test@test.com', tenantId: 't1', role })).toBe(true);
    });

    // Unrelated roles should be denied
    const denied = ['patient', 'lab_tech', 'porter'];
    denied.forEach((role) => {
      expect(canAccessBilling({ email: 'test@test.com', tenantId: 't1', role })).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 6: Invoice, Credit & Payer Context (B-18 .. B-20)
// ─────────────────────────────────────────────────────────────────────────────
describe('Billing — Invoice, Credit Notes & Payer Context', () => {
  // B-18: createInvoiceDraftSchema with items and invoiceItemSchema transform
  it('B-18: createInvoiceDraftSchema validates items via invoiceItemSchema with transform', () => {
    const validDraft = {
      patientId: 'pat-001',
      items: [
        { unitPrice: 200, quantity: 2, description: 'Lab CBC' },
        { unitPrice: 50, quantity: 1 },
      ],
    };
    const result = createInvoiceDraftSchema.safeParse(validDraft);
    expect(result.success).toBe(true);
    if (result.success) {
      // First item: amount = unitPrice * quantity = 400
      expect(result.data.items![0].amount).toBe(400);
      expect(result.data.items![0].description).toBe('Lab CBC');
      // Second item: no description provided, falls back to 'Item'
      expect(result.data.items![1].description).toBe('Item');
      expect(result.data.items![1].amount).toBe(50);
    }

    // Missing patientId should fail
    const noPat = { items: [{ unitPrice: 10, quantity: 1 }] };
    expect(createInvoiceDraftSchema.safeParse(noPat).success).toBe(false);

    // invoiceItemSchema transform: totalPrice takes precedence when amount is missing
    const itemWithTotal = { unitPrice: 100, quantity: 2, totalPrice: 180 };
    const itemResult = invoiceItemSchema.safeParse(itemWithTotal);
    expect(itemResult.success).toBe(true);
    if (itemResult.success) {
      // amount should be totalPrice (180) since amount is not explicitly given
      expect(itemResult.data.amount).toBe(180);
    }
  });

  // B-19: createCreditNoteSchema validates type enum and required fields
  it('B-19: createCreditNoteSchema validates creditNoteTypeEnum and required fields', () => {
    const validTypes = ['VOID_REFUND', 'ADJUSTMENT', 'PATIENT_REFUND', 'INSURANCE_ADJUSTMENT'];
    validTypes.forEach((t) => {
      expect(creditNoteTypeEnum.safeParse(t).success).toBe(true);
    });
    expect(creditNoteTypeEnum.safeParse('RANDOM_TYPE').success).toBe(false);

    const valid = {
      encounterCoreId: 'enc-300',
      type: 'PATIENT_REFUND',
      amount: 75,
      reason: 'Overcharged lab test',
    };
    const result = createCreditNoteSchema.safeParse(valid);
    expect(result.success).toBe(true);

    // Missing reason
    const noReason = { encounterCoreId: 'enc-300', type: 'ADJUSTMENT', amount: 50 };
    expect(createCreditNoteSchema.safeParse(noReason).success).toBe(false);

    // Amount must be positive
    const negativeAmt = { encounterCoreId: 'enc-300', type: 'VOID_REFUND', amount: -10, reason: 'test' };
    expect(createCreditNoteSchema.safeParse(negativeAmt).success).toBe(false);

    // Zero amount should fail (positive required)
    const zeroAmt = { encounterCoreId: 'enc-300', type: 'VOID_REFUND', amount: 0, reason: 'test' };
    expect(createCreditNoteSchema.safeParse(zeroAmt).success).toBe(false);
  });

  // B-20: payerContextSetSchema validates mode enum and required fields
  it('B-20: payerContextSetSchema validates payer mode enum (CASH/INSURANCE)', () => {
    const validModes = ['CASH', 'INSURANCE'];
    validModes.forEach((m) => {
      expect(payerModeEnum.safeParse(m).success).toBe(true);
    });
    expect(payerModeEnum.safeParse('CREDIT').success).toBe(false);

    const valid = {
      encounterCoreId: 'enc-400',
      mode: 'INSURANCE',
      insuranceCompanyId: 'ins-001',
      insuranceCompanyName: 'Bupa Arabia',
      idempotencyKey: 'idem-payer-001',
    };
    const result = payerContextSetSchema.safeParse(valid);
    expect(result.success).toBe(true);

    // Missing encounterCoreId should fail
    const noEnc = { mode: 'CASH', idempotencyKey: 'k1' };
    expect(payerContextSetSchema.safeParse(noEnc).success).toBe(false);

    // Missing idempotencyKey should fail
    const noKey = { encounterCoreId: 'enc-400', mode: 'CASH' };
    expect(payerContextSetSchema.safeParse(noKey).success).toBe(false);

    // Invalid mode should fail
    const badMode = { encounterCoreId: 'enc-400', mode: 'BARTER', idempotencyKey: 'k2' };
    expect(payerContextSetSchema.safeParse(badMode).success).toBe(false);
  });
});
