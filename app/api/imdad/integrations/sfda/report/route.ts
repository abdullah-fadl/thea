/**
 * SCM — SFDA Movement Report Submission
 *
 * POST /api/imdad/integrations/sfda/report
 *
 * Submits a supply chain movement report to SFDA Rassd.
 * Supports four report types: dispense, receipt, return, recall.
 */

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { createSfdaClient, SfdaError } from '@/lib/imdad/integrations/sfda';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Zod schemas for each report type
// ---------------------------------------------------------------------------

const dispenseSchema = z.object({
  reportType: z.literal('dispense'),
  gtin: z.string().min(1).max(14),
  serialNumber: z.string().min(1).max(50),
  batchNumber: z.string().min(1).max(50),
  expiryDate: z.string().min(1),
  patientReference: z.string().min(1).max(50),
  prescriberLicense: z.string().min(1).max(50),
  pharmacistLicense: z.string().min(1).max(50),
  facilityLicense: z.string().min(1).max(50),
  quantity: z.number().int().positive(),
  unitOfMeasure: z.string().min(1).max(20),
  dispensedAt: z.string().min(1),
  prescriptionNumber: z.string().max(50).optional(),
});

const receiptSchema = z.object({
  reportType: z.literal('receipt'),
  gtin: z.string().min(1).max(14),
  serialNumbers: z.array(z.string().min(1).max(50)).min(1),
  batchNumber: z.string().min(1).max(50),
  expiryDate: z.string().min(1),
  supplierGln: z.string().min(1).max(20),
  facilityLicense: z.string().min(1).max(50),
  purchaseOrderNumber: z.string().min(1).max(50),
  grnNumber: z.string().min(1).max(50),
  quantity: z.number().int().positive(),
  unitOfMeasure: z.string().min(1).max(20),
  receivedAt: z.string().min(1),
});

const returnSchema = z.object({
  reportType: z.literal('return'),
  gtin: z.string().min(1).max(14),
  serialNumber: z.string().min(1).max(50),
  batchNumber: z.string().min(1).max(50),
  returnReason: z.enum([
    'PATIENT_REQUEST',
    'ADVERSE_REACTION',
    'PRODUCT_DEFECT',
    'EXPIRED',
    'RECALL',
    'OTHER',
  ]),
  returnDetails: z.string().max(500).optional(),
  patientReference: z.string().max(50).optional(),
  facilityLicense: z.string().min(1).max(50),
  quantity: z.number().int().positive(),
  unitOfMeasure: z.string().min(1).max(20),
  returnedAt: z.string().min(1),
});

const recallSchema = z.object({
  reportType: z.literal('recall'),
  gtin: z.string().min(1).max(14),
  affectedBatches: z.array(z.string().min(1).max(50)).min(1),
  affectedSerialNumbers: z.array(z.string().min(1).max(50)).optional(),
  recallClass: z.enum(['CLASS_I', 'CLASS_II', 'CLASS_III']),
  reason: z.string().min(1).max(1000),
  reasonAr: z.string().min(1).max(1000),
  facilityLicense: z.string().min(1).max(50),
  instructions: z.string().min(1).max(2000),
  instructionsAr: z.string().min(1).max(2000),
  recallInitiatedAt: z.string().min(1),
  quantityAffected: z.number().int().positive(),
  unitOfMeasure: z.string().min(1).max(20),
});

const reportSchema = z.discriminatedUnion('reportType', [
  dispenseSchema,
  receiptSchema,
  returnSchema,
  recallSchema,
]);

export const POST = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const body = await req.json();
      const parsed = reportSchema.parse(body);

      const client = createSfdaClient(tenantId);

      let result;

      switch (parsed.reportType) {
        case 'dispense': {
          const { reportType: _, ...data } = parsed;
          result = await (client as any).reportDispense(data, tenantId);
          break;
        }
        case 'receipt': {
          const { reportType: _, ...data } = parsed;
          result = await (client as any).reportReceipt(data, tenantId);
          break;
        }
        case 'return': {
          const { reportType: _, ...data } = parsed;
          result = await (client as any).reportReturn(data, tenantId);
          break;
        }
        case 'recall': {
          const { reportType: _, ...data } = parsed;
          result = await (client as any).reportRecall(data, tenantId);
          break;
        }
      }

      return NextResponse.json({ data: result }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) },
          { status: 400 },
        );
      }
      if (error instanceof SfdaError) {
        return NextResponse.json(
          { error: error.message, errorCode: error.code },
          { status: error.statusCode ?? 502 },
        );
      }
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 },
      );
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.integrations.sfda.manage' },
);
