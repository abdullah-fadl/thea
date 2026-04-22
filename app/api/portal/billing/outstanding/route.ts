import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requirePortalSession } from '@/lib/portal/auth';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET /api/portal/billing/outstanding — outstanding bills for the logged-in patient
// ---------------------------------------------------------------------------
export const GET = withErrorHandler(async (request: NextRequest) => {
  const payload = await requirePortalSession(request);
  if (payload instanceof NextResponse) return payload;

  // Resolve portal user to get patientMasterId
  const portalUser = await prisma.patientPortalUser.findFirst({
    where: { tenantId: payload.tenantId, id: payload.portalUserId },
  });
  if (!portalUser) {
    return NextResponse.json({ error: 'Portal user not found' }, { status: 404 });
  }

  const patientMasterId = portalUser.patientMasterId;
  if (!patientMasterId) {
    return NextResponse.json({ items: [], totalOutstanding: 0 });
  }

  // Resolve tenant UUID
  const tenant = await prisma.tenant.findFirst({ where: { tenantId: payload.tenantId } });
  const tenantId = tenant?.id || payload.tenantId;

  // Fetch issued invoices for this patient that are not fully paid
  const invoices = await prisma.billingInvoice.findMany({
    where: {
      tenantId,
      patientMasterId,
      status: { in: ['ISSUED', 'DRAFT'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Fetch payments for these invoices to compute remaining balances
  const invoiceIds = invoices.map((inv: any) => inv.id);
  const payments = invoiceIds.length
    ? await prisma.billingPayment.findMany({
        where: {
          tenantId,
          invoiceId: { in: invoiceIds },
          status: 'RECORDED',
        },
      })
    : [];

  const paidByInvoice = payments.reduce<Record<string, number>>((acc: Record<string, number>, p: any) => {
    const key = p.invoiceId || '';
    acc[key] = (acc[key] || 0) + Number(p.amount || 0);
    return acc;
  }, {});

  const items = invoices
    .map((inv: any) => {
      const total = Number(inv.total || 0);
      const paid = paidByInvoice[inv.id] || 0;
      const remaining = Math.max(total - paid, 0);
      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        total,
        paid,
        remaining,
        status: inv.status,
        issuedAt: inv.issuedAt || inv.createdAt,
        description: inv.metadata?.description || inv.invoiceNumber,
      };
    })
    .filter((inv: any) => inv.remaining > 0);

  const totalOutstanding = items.reduce((sum: number, inv) => sum + inv.remaining, 0);

  // Fetch recent payment history
  const encounterIds = invoices.map((inv: any) => inv.encounterCoreId).filter(Boolean);
  const paymentHistory = encounterIds.length
    ? await prisma.billingPayment.findMany({
        where: {
          tenantId,
          encounterCoreId: { in: encounterIds },
          status: 'RECORDED',
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
    : [];

  const historyItems = paymentHistory.map((p: any) => ({
    paymentId: p.id,
    amount: Number(p.amount || 0),
    method: p.method,
    reference: p.reference || null,
    status: p.status,
    createdAt: p.createdAt,
    invoiceId: p.invoiceId || null,
  }));

  logger.info('Portal billing outstanding fetched', {
    category: 'portal',
    tenantId,
    portalUserId: payload.portalUserId,
    outstandingCount: items.length,
  });

  return NextResponse.json({ items, totalOutstanding, paymentHistory: historyItems });
});
