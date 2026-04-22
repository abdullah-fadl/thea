import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Prisma delegate for models not yet in schema
const db = prisma as unknown as Record<string, {
  findMany: (args?: unknown) => Promise<any[]>;
  findFirst: (args?: unknown) => Promise<any | null>;
}>;

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

// ---------------------------------------------------------------------------
// GET  /api/billing/nphies/dashboard
// Aggregates NPHIES claim, eligibility, and prior-auth data
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
    if (!canAccessBilling({ email: user?.email, tenantId, role })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = req.nextUrl;
    const from = url.searchParams.get('from') || '';
    const to = url.searchParams.get('to') || '';
    const statusFilter = url.searchParams.get('status') || '';
    const payerFilter = url.searchParams.get('payer') || '';

    // Build date filter
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // ---- NPHIES Claims ----
    const claimWhere: any = { tenantId };
    if (hasDateFilter) claimWhere.createdAt = dateFilter;
    if (statusFilter) claimWhere.status = statusFilter;

    const claims = await db.nphiesClaim.findMany({
      where: claimWhere,
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    // Collect patient + insurance info for enrichment
    const patientIds = Array.from(new Set(claims.map((c) => c.patientId).filter(Boolean))) as string[];
    const insuranceIds = Array.from(new Set(claims.map((c) => c.insuranceId).filter(Boolean))) as string[];

    const patients = patientIds.length
      ? await db.patientMaster.findMany({
          where: { tenantId, id: { in: patientIds as string[] } },
          select: { id: true, fullName: true },
        })
      : [];
    const patientNameMap: Record<string, string> = {};
    for (const pt of patients) {
      patientNameMap[String(pt.id)] = String(pt.fullName || '');
    }

    const insurances = insuranceIds.length
      ? await db.patientInsurance.findMany({
          where: { tenantId, id: { in: insuranceIds as string[] } },
          select: { id: true, insurerName: true, insurerId: true },
        })
      : [];
    const insuranceMap: Record<string, { name: string; id: string }> = {};
    for (const ins of insurances) {
      insuranceMap[String(ins.id)] = { name: String(ins.insurerName || ''), id: String(ins.insurerId || '') };
    }

    // ---- Status Distribution ----
    const statusCounts: Record<string, number> = {
      QUEUED: 0,
      SUBMITTED: 0,
      ACCEPTED: 0,
      REJECTED: 0,
      PARTIAL: 0,
      COMPLETE: 0,
    };

    let totalSubmitted = 0;
    let totalApproved = 0;
    let totalRejected = 0;
    let totalPending = 0;
    let totalAdjudicated = 0;
    let responseTimeSumMs = 0;
    let responseTimeCount = 0;

    // Payer breakdown
    const payerBreakdown: Record<string, {
      name: string;
      submitted: number;
      approved: number;
      rejected: number;
      pending: number;
    }> = {};

    for (const claim of claims) {
      totalSubmitted++;
      const status = String(claim.status || 'QUEUED').toUpperCase();

      // Map claim statuses to our categories
      if (status.includes('QUEUE')) {
        statusCounts.QUEUED++;
        totalPending++;
      } else if (status.includes('SUBMIT') || status === 'PENDING') {
        statusCounts.SUBMITTED++;
        totalPending++;
      } else if (status.includes('ACCEPT') || status.includes('APPROVED') || status.includes('COMPLETE')) {
        if (claim.accepted) {
          statusCounts.ACCEPTED++;
          totalApproved++;
        } else {
          statusCounts.COMPLETE++;
          totalApproved++;
        }
      } else if (status.includes('REJECT') || status.includes('DENIED') || status.includes('ERROR')) {
        statusCounts.REJECTED++;
        totalRejected++;
      } else if (status.includes('PARTIAL')) {
        statusCounts.PARTIAL++;
        totalApproved++;
      } else {
        statusCounts.QUEUED++;
        totalPending++;
      }

      totalAdjudicated += Number(claim.adjudicatedAmount || 0);

      // Response time estimation (createdAt to last status check if response has date info)
      const response = claim.response as Record<string, unknown> | null;
      if (response?.processedAt || response?.timestamp) {
        const created = new Date(claim.createdAt as string | number).getTime();
        const processed = new Date((response.processedAt || response.timestamp) as string | number).getTime();
        if (processed > created) {
          responseTimeSumMs += processed - created;
          responseTimeCount++;
        }
      }

      // Payer tracking
      const claimInsId = String(claim.insuranceId || '');
      const insInfo = insuranceMap[claimInsId] || { name: 'Unknown', id: claimInsId };
      const payerKey = insInfo.id || claimInsId || 'unknown';
      if (!payerBreakdown[payerKey]) {
        payerBreakdown[payerKey] = { name: insInfo.name, submitted: 0, approved: 0, rejected: 0, pending: 0 };
      }
      payerBreakdown[payerKey].submitted++;
      if (claim.accepted) payerBreakdown[payerKey].approved++;
      if (status.includes('REJECT') || status.includes('DENIED')) payerBreakdown[payerKey].rejected++;
      if (status.includes('QUEUE') || status.includes('SUBMIT') || status === 'PENDING') payerBreakdown[payerKey].pending++;
    }

    // Filter payer if requested
    let payerTable = Object.entries(payerBreakdown).map(([id, data]) => ({
      payerId: id,
      payerName: data.name,
      submitted: data.submitted,
      approved: data.approved,
      rejected: data.rejected,
      pending: data.pending,
      approvalRate: data.submitted > 0 ? roundMoney((data.approved / data.submitted) * 100) : 0,
    }));
    if (payerFilter) {
      payerTable = payerTable.filter(
        (p) => p.payerId === payerFilter || p.payerName.toLowerCase().includes(payerFilter.toLowerCase()),
      );
    }
    payerTable.sort((a, b) => b.submitted - a.submitted);

    const avgResponseTimeHours =
      responseTimeCount > 0 ? roundMoney(responseTimeSumMs / responseTimeCount / (1000 * 60 * 60)) : 0;

    // ---- Eligibility Logs ----
    const eligibilityWhere: any = { tenantId };
    if (hasDateFilter) eligibilityWhere.createdAt = dateFilter;

    const eligibilityLogs = await db.nphiesEligibilityLog.findMany({
      where: eligibilityWhere,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const recentEligibility = eligibilityLogs.map((log) => ({
      id: log.id,
      patientId: log.patientId,
      patientName: patientNameMap[String(log.patientId)] || '-',
      status: log.status,
      eligible: log.eligible,
      createdAt: log.createdAt,
    }));

    // ---- Prior Authorizations ----
    const priorAuthWhere: any = { tenantId };
    if (hasDateFilter) priorAuthWhere.createdAt = dateFilter;

    const priorAuths = await db.nphiesPriorAuth.findMany({
      where: priorAuthWhere,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const recentPriorAuth = priorAuths.map((pa) => ({
      id: pa.id,
      patientId: pa.patientId,
      patientName: patientNameMap[String(pa.patientId)] || '-',
      status: pa.status,
      approved: pa.approved,
      authorizationNumber: pa.authorizationNumber || null,
      expiryDate: pa.expiryDate || null,
      denialReason: pa.denialReason || null,
      createdAt: pa.createdAt,
    }));

    // ---- Claims Table ----
    const claimsTable = claims.slice(0, 100).map((claim) => {
      const clmInsId = String(claim.insuranceId || '');
      const insInfo = insuranceMap[clmInsId] || { name: 'Unknown', id: '' };
      return {
        id: claim.id,
        claimReference: claim.nphiesClaimReference || claim.nphiesClaimId || '-',
        patientId: claim.patientId,
        patientName: patientNameMap[String(claim.patientId)] || '-',
        payerName: insInfo.name,
        amount: roundMoney(Number(claim.adjudicatedAmount || claim.payerAmount || 0)),
        submittedDate: claim.createdAt,
        status: claim.status,
        accepted: claim.accepted,
        denialReason: claim.denialReason || null,
        denialReasonAr: claim.denialReasonAr || null,
        isResubmission: claim.isResubmission,
        responseDate: (claim.response as Record<string, unknown> | null)?.processedAt || null,
      };
    });

    logger.info('NPHIES dashboard loaded', { category: 'billing', tenantId });

    return NextResponse.json({
      summary: {
        totalSubmitted,
        totalApproved,
        totalRejected,
        totalPending,
        avgResponseTimeHours,
        totalAdjudicated: roundMoney(totalAdjudicated),
      },
      statusDistribution: statusCounts,
      payerBreakdown: payerTable,
      recentEligibility,
      recentPriorAuth,
      claims: claimsTable,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' },
);
