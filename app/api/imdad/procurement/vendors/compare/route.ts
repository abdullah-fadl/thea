/**
 * SCM BC3 Procurement — Vendor Comparison Tool
 *
 * POST /api/imdad/procurement/vendors/compare — Compare vendors side by side
 * Compares pricing, delivery performance, quality scores, and contract terms.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST — Compare selected vendors side by side
// ---------------------------------------------------------------------------

const compareSchema = z.object({
  vendorIds: z.array(z.string().uuid()).min(2, 'At least 2 vendors required').max(5, 'Maximum 5 vendors'),
  organizationId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  dateRangeStart: z.string().optional(),
  dateRangeEnd: z.string().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const body = await req.json();
      const parsed = compareSchema.parse(body);
      const { vendorIds, organizationId, itemId, dateRangeStart, dateRangeEnd } = parsed;

      // 1. Fetch vendor profiles
      const vendors = await prisma.imdadVendor.findMany({
        where: {
          tenantId,
          id: { in: vendorIds },
          isDeleted: false,
        },
        select: {
          id: true,
          code: true,
          name: true,
          nameAr: true,
          status: true,
          tier: true,
          rating: true,
          country: true,
          category: true,
          paymentTerms: true,
          leadTimeDays: true,
          createdAt: true,
        } as any,
      });

      if (vendors.length < 2) {
        return NextResponse.json(
          { error: 'At least 2 valid vendors are required for comparison' },
          { status: 400 }
        );
      }

      // 2. Build date range filter
      const dateFilter: any = {};
      if (dateRangeStart) dateFilter.gte = new Date(dateRangeStart);
      if (dateRangeEnd) dateFilter.lte = new Date(dateRangeEnd);

      // 3. Fetch PO performance per vendor
      const poFilter: any = {
        tenantId,
        vendorId: { in: vendorIds },
        isDeleted: false,
      };
      if (organizationId) poFilter.organizationId = organizationId;
      if (Object.keys(dateFilter).length > 0) poFilter.createdAt = dateFilter;

      const purchaseOrders = await prisma.imdadPurchaseOrder.findMany({
        where: poFilter,
        select: {
          vendorId: true,
          totalAmount: true,
          status: true,
          createdAt: true,
        },
      });

      // 4. Fetch GRN performance (delivery accuracy)
      const grns = await prisma.imdadGoodsReceivingNote.findMany({
        where: {
          tenantId,
          isDeleted: false,
          purchaseOrder: { vendorId: { in: vendorIds } },
          ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        } as any,
        select: {
          status: true,
          purchaseOrder: { select: { vendorId: true } as any },
        } as any,
      });

      // 5. Fetch quality inspection results
      const inspections = await prisma.imdadQualityInspection.findMany({
        where: {
          tenantId,
          isDeleted: false,
          referenceType: { in: ['GRN', 'goods_receiving_note'] },
          ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        },
        select: {
          status: true,
          result: true,
          referenceId: true,
        } as any,
      });

      // 6. Fetch vendor audit scores
      const audits = await prisma.imdadVendorAudit.findMany({
        where: {
          tenantId,
          vendorId: { in: vendorIds },
          isDeleted: false,
        },
        select: {
          vendorId: true,
          overallScore: true,
          status: true,
        } as any,
      });

      // 7. Fetch active contracts
      const contracts = await prisma.imdadContract.findMany({
        where: {
          tenantId,
          vendorId: { in: vendorIds },
          isDeleted: false,
          status: { in: ['ACTIVE', 'EXPIRING_SOON'] },
        },
        select: {
          vendorId: true,
          value: true,
          startDate: true,
          endDate: true,
          autoRenew: true,
        },
      });

      // 8. Aggregate per vendor
      const vendorComparisons = vendors.map((vendor: any) => {
        // PO metrics
        const vendorPOs = purchaseOrders.filter((po: any) => po.vendorId === vendor.id);
        const totalPOs = vendorPOs.length;
        const totalSpend = vendorPOs.reduce((sum: number, po: any) => sum + Number(po.totalAmount ?? 0), 0);
        const completedPOs = vendorPOs.filter((po: any) => ['COMPLETED', 'RECEIVED', 'SENT'].includes(po.status)).length;
        const poCompletionRate = totalPOs > 0 ? Math.round((completedPOs / totalPOs) * 100) : 0;

        // GRN metrics
        const vendorGRNs = grns.filter((g: any) => g.purchaseOrder?.vendorId === vendor.id);
        const totalGRNs = vendorGRNs.length;
        const completedGRNs = vendorGRNs.filter((g: any) => g.status === 'COMPLETED').length;
        const deliveryAccuracy = totalGRNs > 0 ? Math.round((completedGRNs / totalGRNs) * 100) : 0;

        // Audit scores
        const vendorAudits = audits.filter((a: any) => a.vendorId === vendor.id);
        const avgAuditScore = vendorAudits.length > 0
          ? Math.round(vendorAudits.reduce((sum: number, a: any) => sum + Number(a.overallScore ?? 0), 0) / vendorAudits.length * 10) / 10
          : null;

        // Contract info
        const vendorContracts = contracts.filter((c: any) => c.vendorId === vendor.id);
        const activeContractValue = vendorContracts.reduce((sum: number, c: any) => sum + Number(c.value ?? 0), 0);

        return {
          vendor: {
            id: vendor.id,
            code: vendor.code,
            name: vendor.name,
            nameAr: vendor.nameAr,
            status: vendor.status,
            tier: vendor.tier,
            rating: vendor.rating,
            country: vendor.country,
            category: vendor.category,
            paymentTerms: vendor.paymentTerms,
            leadTimeDays: vendor.leadTimeDays,
          },
          performance: {
            totalPOs,
            totalSpend: Math.round(totalSpend * 100) / 100,
            poCompletionRate,
            deliveryAccuracy,
            totalGRNs,
          },
          quality: {
            avgAuditScore,
            totalAudits: vendorAudits.length,
          },
          contracts: {
            activeContracts: vendorContracts.length,
            activeContractValue: Math.round(activeContractValue * 100) / 100,
            autoRenewing: vendorContracts.filter((c: any) => c.autoRenew).length,
          },
        };
      });

      // 9. Compute rankings
      const rankings = {
        byRating: [...vendorComparisons].sort((a, b) => Number(b.vendor.rating ?? 0) - Number(a.vendor.rating ?? 0)).map(v => v.vendor.id),
        byDeliveryAccuracy: [...vendorComparisons].sort((a, b) => b.performance.deliveryAccuracy - a.performance.deliveryAccuracy).map(v => v.vendor.id),
        byTotalSpend: [...vendorComparisons].sort((a, b) => b.performance.totalSpend - a.performance.totalSpend).map(v => v.vendor.id),
        byAuditScore: [...vendorComparisons].sort((a, b) => Number(b.quality.avgAuditScore ?? 0) - Number(a.quality.avgAuditScore ?? 0)).map(v => v.vendor.id),
      };

      return NextResponse.json({
        data: vendorComparisons,
        rankings,
        comparedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.view' }
);
