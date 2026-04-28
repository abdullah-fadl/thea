/**
 * Phase 7.5 — Imdad event schema tests
 *
 * One describe per registered event:
 *   1. purchase_order.created@v1
 *   2. goods_received@v1
 *   3. stock.threshold_breached@v1
 *
 * The schemas use Zod v4's default object semantics (unknown keys stripped).
 * Sensitivity discipline: monetary amounts (totalAmount, unitCost), free-text
 * fields (notes, deliveryAddress), actual / threshold KPI values, and the
 * full alert message MUST never appear in the parsed payload — only the
 * declared identifiers, scope, status, and timestamps.
 */

import { describe, it, expect } from 'vitest';
import '@/lib/events/schemas';
import { getSchema } from '@/lib/events/registry';

const TENANT_ID         = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const ORG_ID            = '550e8400-e29b-41d4-a716-446655440000';
const PO_ID             = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const VENDOR_ID         = '7d3a9c2e-1b8d-4c4f-9e7a-2f5e8a1d3c4b';
const GRN_ID            = '8e4b0d3f-2c9e-45a0-9f8b-3a6f9b2e4d5c';
const ALERT_INSTANCE_ID = '9f5c1e40-3dad-46b1-a09c-4b7a0c3f5e6d';
const ALERT_RULE_ID     = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NOW_ISO           = '2026-04-25T10:00:00.000Z';

describe('Imdad event schemas', () => {
  describe('purchase_order.created@v1', () => {
    const schema = getSchema('purchase_order.created', 1).payloadSchema;

    it('accepts a valid DRAFT payload with SAR currency', () => {
      const result = schema.safeParse({
        poId: PO_ID,
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        vendorId: VENDOR_ID,
        status: 'DRAFT',
        currency: 'SAR',
        createdAt: NOW_ISO,
      });
      expect(result.success).toBe(true);
    });

    it('rejects status outside the ImdadPOStatus enum', () => {
      const result = schema.safeParse({
        poId: PO_ID,
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        vendorId: VENDOR_ID,
        status: 'NEW',
        currency: 'SAR',
        createdAt: NOW_ISO,
      });
      expect(result.success).toBe(false);
    });

    it('strips monetary + free-text fields (totalAmount, taxAmount, deliveryAddress, notes)', () => {
      const result = schema.safeParse({
        poId: PO_ID,
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        vendorId: VENDOR_ID,
        status: 'DRAFT',
        currency: 'SAR',
        createdAt: NOW_ISO,
        totalAmount: 184_500,
        taxAmount: 24_065,
        deliveryAddress: 'Building 7, King Fahd Medical City, Riyadh',
        notes: 'Vendor confirmed batch lot 2026-A; expedite by Q2',
        invoiceNumber: 'INV-7711',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('totalAmount');
        expect(result.data).not.toHaveProperty('taxAmount');
        expect(result.data).not.toHaveProperty('deliveryAddress');
        expect(result.data).not.toHaveProperty('notes');
        expect(result.data).not.toHaveProperty('invoiceNumber');
      }
    });
  });

  describe('goods_received@v1', () => {
    const schema = getSchema('goods_received', 1).payloadSchema;

    it('accepts a valid payload with nullable vendorId', () => {
      const result = schema.safeParse({
        grnId: GRN_ID,
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        poId: PO_ID,
        vendorId: null,
        status: 'DRAFT',
        receivedAt: NOW_ISO,
      });
      expect(result.success).toBe(true);
    });

    it('rejects status outside the ImdadGRNStatus enum', () => {
      const result = schema.safeParse({
        grnId: GRN_ID,
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        poId: PO_ID,
        vendorId: VENDOR_ID,
        status: 'COMPLETED',
        receivedAt: NOW_ISO,
      });
      expect(result.success).toBe(false);
    });

    it('strips per-line + quality detail (lines, batchNumbers, qualityNotes, deliveryNoteNumber)', () => {
      const result = schema.safeParse({
        grnId: GRN_ID,
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        poId: PO_ID,
        vendorId: VENDOR_ID,
        status: 'PENDING_QC',
        receivedAt: NOW_ISO,
        lines: [{ itemId: 'i-1', orderedQty: 100, receivedQty: 95 }],
        batchNumbers: ['LOT-2026-A', 'LOT-2026-B'],
        qualityNotes: 'Two units rejected for damaged packaging',
        deliveryNoteNumber: 'DN-991122',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('lines');
        expect(result.data).not.toHaveProperty('batchNumbers');
        expect(result.data).not.toHaveProperty('qualityNotes');
        expect(result.data).not.toHaveProperty('deliveryNoteNumber');
      }
    });
  });

  describe('stock.threshold_breached@v1', () => {
    const schema = getSchema('stock.threshold_breached', 1).payloadSchema;

    it('accepts a valid CRITICAL payload', () => {
      const result = schema.safeParse({
        alertInstanceId: ALERT_INSTANCE_ID,
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        alertRuleId: ALERT_RULE_ID,
        kpiCode: 'STOCK_BELOW_REORDER',
        severity: 'CRITICAL',
        firedAt: NOW_ISO,
      });
      expect(result.success).toBe(true);
    });

    it('rejects severity outside the ImdadAlertSeverity enum', () => {
      const result = schema.safeParse({
        alertInstanceId: ALERT_INSTANCE_ID,
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        alertRuleId: ALERT_RULE_ID,
        kpiCode: 'STOCK_BELOW_REORDER',
        severity: 'EMERGENCY',
        firedAt: NOW_ISO,
      });
      expect(result.success).toBe(false);
    });

    it('strips threshold values + message body (actualValue, thresholdValue, message, dimensionLabel)', () => {
      const result = schema.safeParse({
        alertInstanceId: ALERT_INSTANCE_ID,
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        alertRuleId: ALERT_RULE_ID,
        kpiCode: 'STOCK_BELOW_REORDER',
        severity: 'WARNING',
        firedAt: NOW_ISO,
        actualValue: 4,
        thresholdValue: 50,
        message: 'Insulin glargine is below reorder point at OR-3 cabinet',
        messageAr: 'الأنسولين قاعدي تحت نقطة إعادة الطلب',
        dimensionLabel: 'OR-3 Pharmacy Cabinet',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('actualValue');
        expect(result.data).not.toHaveProperty('thresholdValue');
        expect(result.data).not.toHaveProperty('message');
        expect(result.data).not.toHaveProperty('messageAr');
        expect(result.data).not.toHaveProperty('dimensionLabel');
      }
    });
  });
});
