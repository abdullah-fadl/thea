/**
 * SCM Print API — Document Print Templates
 *
 * GET /api/imdad/print/[type]?id=<uuid>&lang=ar|en
 *
 * Types: purchase-order, grn, invoice, asset-tag, inspection-report
 * Returns: text/html ready for printing
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import {
  generatePrintHtml,
  type PrintTemplateType,
  type PrintDocumentData,
  type PrintLineItem,
} from '@/lib/imdad/print';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Type mapping from URL slug to template type
// ---------------------------------------------------------------------------

const TYPE_MAP: Record<string, PrintTemplateType> = {
  'purchase-order': 'purchase_order',
  'grn': 'grn',
  'invoice': 'invoice',
  'asset-tag': 'asset_tag',
  'inspection-report': 'inspection_report',
};

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

async function fetchPurchaseOrder(id: string, tenantId: string): Promise<PrintDocumentData> {
  const po = await prisma.imdadPurchaseOrder.findFirst({
    where: { id, tenantId, isDeleted: false },
    include: {
      lines: { where: { isDeleted: false }, orderBy: { lineNumber: 'asc' } },
      vendor: { select: { id: true, name: true, nameAr: true, code: true, address: true, vatNumber: true } },
    } as any,
  });

  if (!po) throw new Error('NOT_FOUND');

  const lines: PrintLineItem[] = (po as any).lines.map((l) => ({
    lineNumber: l.lineNumber,
    itemCode: undefined,
    description: `Item ${l.lineNumber}`,
    quantity: l.quantity,
    unitPrice: Number(l.unitCost),
    totalPrice: Number(l.totalCost),
  }));

  return {
    documentNumber: po.poNumber,
    date: po.orderDate?.toISOString() || po.createdAt.toISOString(),
    status: po.status,
    vendorName: (po as any).vendor?.name || po.vendorName || undefined,
    vendorNameAr: (po as any).vendor?.nameAr || undefined,
    vendorCode: (po as any).vendor?.code || undefined,
    vendorAddress: (po as any).vendor?.address || undefined,
    vendorVat: (po as any).vendor?.vatNumber || undefined,
    currency: po.currency,
    lines,
    subtotal: Number(po.subtotal),
    taxAmount: Number(po.taxAmount),
    totalAmount: Number(po.totalAmount),
    paymentTerms: po.paymentTerms || undefined,
    deliveryDate: po.expectedDeliveryDate?.toISOString() || po.deliveryDate?.toISOString(),
    deliveryAddress: po.deliveryAddress || undefined,
    notes: po.notes || undefined,
    preparedBy: undefined,
    approvedBy: undefined,
  };
}

async function fetchGRN(id: string, tenantId: string): Promise<PrintDocumentData> {
  const grn = await prisma.imdadGoodsReceivingNote.findFirst({
    where: { id, tenantId, isDeleted: false },
    include: {
      lines: { where: { isDeleted: false }, orderBy: { lineNumber: 'asc' } },
      purchaseOrder: { select: { poNumber: true, vendorName: true, vendor: { select: { name: true, nameAr: true, code: true, address: true, vatNumber: true } } } },
    } as any,
  });

  if (!grn) throw new Error('NOT_FOUND');

  const lines: PrintLineItem[] = (grn as any).lines.map((l) => ({
    lineNumber: l.lineNumber,
    itemCode: undefined,
    description: `Item ${l.lineNumber}`,
    quantity: l.receivedQty,
    unitPrice: 0,
    totalPrice: 0,
    batchNumber: l.batchNumber || undefined,
    expiryDate: l.expiryDate?.toISOString(),
    notes: l.notes || undefined,
  }));

  return {
    documentNumber: grn.grnNumber,
    date: grn.receivedAt.toISOString(),
    status: grn.status,
    vendorName: (grn as any).purchaseOrder?.vendor?.name || (grn as any).purchaseOrder?.vendorName || undefined,
    vendorNameAr: (grn as any).purchaseOrder?.vendor?.nameAr || undefined,
    vendorCode: (grn as any).purchaseOrder?.vendor?.code || undefined,
    vendorAddress: (grn as any).purchaseOrder?.vendor?.address || undefined,
    vendorVat: (grn as any).purchaseOrder?.vendor?.vatNumber || undefined,
    currency: 'SAR',
    lines,
    subtotal: 0,
    taxAmount: 0,
    totalAmount: 0,
    poNumber: (grn as any).purchaseOrder?.poNumber || undefined,
    deliveryDate: grn.deliveryDate?.toISOString(),
    notes: grn.notes || undefined,
    receivedBy: undefined,
    verifiedBy: undefined,
  };
}

async function fetchInvoice(id: string, tenantId: string): Promise<PrintDocumentData> {
  const inv = await prisma.imdadInvoice.findFirst({
    where: { id, tenantId, isDeleted: false },
    include: {
      lines: { where: { isDeleted: false }, orderBy: { lineNumber: 'asc' } },
    } as any,
  });

  if (!inv) throw new Error('NOT_FOUND');

  const lines: PrintLineItem[] = (inv as any).lines.map((l) => ({
    lineNumber: l.lineNumber,
    description: l.description || `Item ${l.lineNumber}`,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
    totalPrice: Number(l.lineTotal),
  }));

  return {
    documentNumber: inv.invoiceNumber,
    date: inv.invoiceDate.toISOString(),
    status: inv.status,
    vendorName: inv.vendorName || undefined,
    currency: inv.currency,
    lines,
    subtotal: Number(inv.subtotal),
    taxRate: Number(inv.taxRate),
    taxAmount: Number(inv.taxAmount),
    discountAmount: Number(inv.discountAmount),
    totalAmount: Number(inv.totalAmount),
    paidAmount: Number(inv.paidAmount),
    balanceDue: Number(inv.balanceDue),
    paymentTerms: inv.paymentTerms || undefined,
    poNumber: inv.purchaseOrderNumber || undefined,
    grnNumber: inv.grnNumber || undefined,
    notes: undefined,
    preparedBy: undefined,
    approvedBy: undefined,
  };
}

async function fetchAssetTag(id: string, tenantId: string): Promise<PrintDocumentData> {
  const asset = await prisma.imdadAsset.findFirst({
    where: { id, tenantId, isDeleted: false },
  });

  if (!asset) throw new Error('NOT_FOUND');

  return {
    documentNumber: asset.assetTag,
    date: asset.createdAt.toISOString(),
    status: asset.status,
    currency: 'SAR',
    lines: [],
    subtotal: 0,
    taxAmount: 0,
    totalAmount: 0,
    assetTag: asset.assetTag,
    assetName: asset.assetName,
    assetNameAr: asset.assetNameAr || undefined,
    assetCategory: asset.assetCategory,
    serialNumber: asset.serialNumber || undefined,
    modelNumber: asset.modelNumber || undefined,
    manufacturer: asset.manufacturer || undefined,
    location: asset.roomNumber || undefined,
    department: undefined,
  };
}

async function fetchInspectionReport(id: string, tenantId: string): Promise<PrintDocumentData> {
  const insp = await prisma.imdadQualityInspection.findFirst({
    where: { id, tenantId, isDeleted: false },
  });

  if (!insp) throw new Error('NOT_FOUND');

  return {
    documentNumber: insp.inspectionNumber,
    date: insp.scheduledDate?.toISOString() || insp.createdAt.toISOString(),
    status: insp.status,
    currency: 'SAR',
    lines: [],
    subtotal: 0,
    taxAmount: 0,
    totalAmount: 0,
    inspectionNumber: insp.inspectionNumber,
    inspectionType: insp.inspectionType,
    referenceType: insp.referenceType,
    referenceNumber: insp.referenceNumber || undefined,
    sampleSize: insp.sampleSize || undefined,
    totalQuantity: insp.totalQuantity != null ? Number(insp.totalQuantity) : undefined,
    result: undefined,
    inspectorName: undefined,
    notes: undefined,
  };
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = new URL(req.url);
      const segments = url.pathname.split('/');
      const typeSlug = segments[segments.length - 1] || '';
      const id = url.searchParams.get('id');
      const lang = url.searchParams.get('lang') || 'en';

      const templateType = TYPE_MAP[typeSlug];
      if (!templateType) {
        return NextResponse.json(
          { error: 'Invalid document type. Valid types: purchase-order, grn, invoice, asset-tag, inspection-report' },
          { status: 400 },
        );
      }

      if (!id) {
        return NextResponse.json({ error: 'Missing required query parameter: id' }, { status: 400 });
      }

      let data: PrintDocumentData;

      switch (templateType) {
        case 'purchase_order':
          data = await fetchPurchaseOrder(id, tenantId);
          break;
        case 'grn':
          data = await fetchGRN(id, tenantId);
          break;
        case 'invoice':
          data = await fetchInvoice(id, tenantId);
          break;
        case 'asset_tag':
          data = await fetchAssetTag(id, tenantId);
          break;
        case 'inspection_report':
          data = await fetchInspectionReport(id, tenantId);
          break;
        default:
          return NextResponse.json({ error: 'Unsupported template type' }, { status: 400 });
      }

      const html = generatePrintHtml(templateType, data, lang);

      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    } catch (err: any) {
      if (err?.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }
      console.error('[SCM Print] Error generating print template:', err);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  {
    platformKey: 'imdad',
    permissionKeys: [
      'imdad.admin.manage',
      'imdad.procurement.view',
      'imdad.financial.view',
      'imdad.assets.view',
      'imdad.quality.view',
    ],
  },
);
