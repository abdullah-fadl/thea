import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

// ---------------------------------------------------------------------------
// GET  /api/billing/revenue-cycle
// Aggregates billing data for the Revenue Cycle Dashboard
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
    if (!canAccessBilling({ email: user?.email, tenantId, role })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = req.nextUrl;
    const from = url.searchParams.get('from') || '';
    const to = url.searchParams.get('to') || '';

    // Build date filters
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // ---- Charge Events (all active) ----
    const chargeWhere: any = { tenantId, status: 'ACTIVE' };
    if (hasDateFilter) chargeWhere.createdAt = dateFilter;

    const chargeEvents = await prisma.billingChargeEvent.findMany({
      where: chargeWhere,
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    let totalCharges = 0;
    const payerTypeTotals: Record<string, number> = { CASH: 0, INSURANCE: 0, GOVERNMENT: 0, PENDING: 0 };
    const departmentTotals: Record<string, number> = {};

    for (const event of chargeEvents) {
      const amount = Number(event.totalPrice || 0);
      totalCharges += amount;

      const payer = String(event.payerType || 'CASH').toUpperCase();
      if (payer === 'GOVERNMENT' || payer === 'GOV') {
        payerTypeTotals.GOVERNMENT += amount;
      } else if (payer === 'INSURANCE') {
        payerTypeTotals.INSURANCE += amount;
      } else {
        payerTypeTotals.CASH += amount;
      }

      const dept = String(event.departmentKey || 'OTHER');
      departmentTotals[dept] = (departmentTotals[dept] || 0) + amount;
    }

    // ---- Payments ----
    const paymentWhere: any = { tenantId, status: 'RECORDED' };
    if (hasDateFilter) paymentWhere.createdAt = dateFilter;

    const payments = await prisma.billingPayment.findMany({
      where: paymentWhere,
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    let totalPayments = 0;
    const paymentMethodTotals: Record<string, number> = {};
    const recentPayments: any[] = [];

    for (const p of payments) {
      const amount = Number(p.amount || 0);
      totalPayments += amount;
      const method = String(p.method || 'CASH');
      paymentMethodTotals[method] = (paymentMethodTotals[method] || 0) + amount;
    }

    // Get recent payments with patient info (last 20)
    const recentPaymentSlice = payments.slice(0, 20);
    const patientIds = Array.from(new Set(
      recentPaymentSlice
        .map((p) => p.encounterCoreId)
        .filter(Boolean)
    ));

    const encounters = patientIds.length
      ? await prisma.encounterCore.findMany({
          where: { tenantId, id: { in: patientIds as string[] } },
          select: { id: true, patientId: true },
        })
      : [];
    const encounterPatientMap: Record<string, string> = {};
    for (const enc of encounters) {
      encounterPatientMap[enc.id] = enc.patientId || '';
    }

    const masterIds = Array.from(new Set(Object.values(encounterPatientMap).filter(Boolean)));
    const patients = masterIds.length
      ? await prisma.patientMaster.findMany({
          where: { tenantId, id: { in: masterIds as string[] } },
          select: { id: true, fullName: true },
        })
      : [];
    const patientNameMap: Record<string, string> = {};
    for (const pt of patients) {
      patientNameMap[pt.id] = pt.fullName || '';
    }

    for (const p of recentPaymentSlice) {
      const patientMasterId = encounterPatientMap[p.encounterCoreId] || '';
      recentPayments.push({
        id: p.id,
        date: p.createdAt,
        patientName: patientNameMap[patientMasterId] || '-',
        amount: Number(p.amount || 0),
        method: p.method,
        status: p.status,
        reference: p.reference || null,
      });
    }

    // ---- Claims Pipeline (BillingClaimEvent statuses) ----
    const claimEventWhere: any = { tenantId };
    if (hasDateFilter) claimEventWhere.createdAt = dateFilter;

    const claimEvents = await prisma.billingClaimEvent.findMany({
      where: claimEventWhere,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Group by claimId, keep only latest status per claim
    const latestByClaimId: Record<string, any> = {};
    for (const ce of claimEvents) {
      const cid = String(ce.claimId || '');
      if (!latestByClaimId[cid] || new Date(ce.createdAt) > new Date(latestByClaimId[cid].createdAt)) {
        latestByClaimId[cid] = ce;
      }
    }

    const claimStatusCounts: Record<string, number> = {
      DRAFT: 0,
      SUBMITTED: 0,
      REJECTED: 0,
      RESUBMITTED: 0,
      PAID: 0,
    };

    let claimsPending = 0;
    let claimsDenied = 0;
    let totalRemitted = 0;
    let paidClaimsCount = 0;
    const denialReasons: Record<string, { count: number; amount: number }> = {};

    for (const ce of Object.values(latestByClaimId)) {
      const status = String(ce.status || 'DRAFT');
      claimStatusCounts[status] = (claimStatusCounts[status] || 0) + 1;

      if (status === 'SUBMITTED' || status === 'DRAFT' || status === 'RESUBMITTED') {
        claimsPending++;
      }
      if (status === 'REJECTED') {
        claimsDenied++;
        const reason = String(ce.rejectionReason || 'Unknown');
        if (!denialReasons[reason]) denialReasons[reason] = { count: 0, amount: 0 };
        denialReasons[reason].count += 1;
        denialReasons[reason].amount += Number(ce.remittanceAmount || 0);
      }
      if (status === 'PAID') {
        totalRemitted += Number(ce.remittanceAmount || 0);
        paidClaimsCount++;
      }
    }

    const totalClaims = Object.values(latestByClaimId).length;

    // ---- Aging Buckets (charges by age) ----
    const now = new Date();
    const agingBuckets = {
      '0_30': { count: 0, amount: 0 },
      '31_60': { count: 0, amount: 0 },
      '61_90': { count: 0, amount: 0 },
      '90_plus': { count: 0, amount: 0 },
    };

    for (const event of chargeEvents) {
      const created = new Date(event.createdAt);
      const daysDiff = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      const amount = Number(event.totalPrice || 0);

      if (daysDiff <= 30) {
        agingBuckets['0_30'].count++;
        agingBuckets['0_30'].amount += amount;
      } else if (daysDiff <= 60) {
        agingBuckets['31_60'].count++;
        agingBuckets['31_60'].amount += amount;
      } else if (daysDiff <= 90) {
        agingBuckets['61_90'].count++;
        agingBuckets['61_90'].amount += amount;
      } else {
        agingBuckets['90_plus'].count++;
        agingBuckets['90_plus'].amount += amount;
      }
    }

    // ---- Compute summary metrics ----
    const totalOutstanding = roundMoney(totalCharges - totalPayments);
    const collectionRate = totalCharges > 0 ? roundMoney((totalPayments / totalCharges) * 100) : 0;
    const denialRate = totalClaims > 0 ? roundMoney((claimsDenied / totalClaims) * 100) : 0;

    // Avg days to payment - estimate from paid claim events
    let avgDaysToPayment = 0;
    if (paidClaimsCount > 0) {
      // Estimate based on claim events age difference
      let totalDays = 0;
      for (const ce of Object.values(latestByClaimId)) {
        if (String(ce.status) === 'PAID' && ce.remittedAt) {
          const created = new Date(ce.createdAt as string);
          const remitted = new Date(ce.remittedAt as string);
          totalDays += Math.max(0, Math.floor((remitted.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
        }
      }
      avgDaysToPayment = roundMoney(totalDays / paidClaimsCount);
    }

    // Denial reasons table
    const denialReasonsTable = Object.entries(denialReasons)
      .map(([reason, data]) => ({
        reason,
        count: data.count,
        amount: roundMoney(data.amount),
        percentOfTotal: claimsDenied > 0 ? roundMoney((data.count / claimsDenied) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    logger.info('Revenue cycle dashboard loaded', { category: 'billing', tenantId });

    return NextResponse.json({
      summary: {
        totalCharges: roundMoney(totalCharges),
        totalPayments: roundMoney(totalPayments),
        totalOutstanding,
        claimsPending,
        claimsDenied,
        avgDaysToPayment,
        collectionRate,
        denialRate,
      },
      revenueBreakdown: {
        cash: roundMoney(payerTypeTotals.CASH),
        insurance: roundMoney(payerTypeTotals.INSURANCE),
        government: roundMoney(payerTypeTotals.GOVERNMENT),
      },
      agingBuckets: {
        '0_30': { count: agingBuckets['0_30'].count, amount: roundMoney(agingBuckets['0_30'].amount) },
        '31_60': { count: agingBuckets['31_60'].count, amount: roundMoney(agingBuckets['31_60'].amount) },
        '61_90': { count: agingBuckets['61_90'].count, amount: roundMoney(agingBuckets['61_90'].amount) },
        '90_plus': { count: agingBuckets['90_plus'].count, amount: roundMoney(agingBuckets['90_plus'].amount) },
      },
      claimsPipeline: claimStatusCounts,
      denialReasons: denialReasonsTable,
      recentPayments,
      departmentTotals: Object.entries(departmentTotals)
        .map(([dept, total]) => ({ department: dept, total: roundMoney(total as number) }))
        .sort((a, b) => b.total - a.total),
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' },
);
