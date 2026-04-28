import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { withErrorHandler } from '@/lib/core/errors';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10', 10);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const payments = await prisma.billingPayment.findMany({
    where: { tenantId, createdAt: { gte: today } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const encounterIds = Array.from(
    new Set(payments.map((p: any) => String(p.encounterCoreId || '')).filter(Boolean))
  );

  const encounters = encounterIds.length
    ? await prisma.encounterCore.findMany({
        where: { tenantId, id: { in: encounterIds } },
      })
    : [];
  const encounterMap = new Map(encounters.map((e: any) => [String(e.id || ''), e]));

  const patientIds = Array.from(
    new Set(encounters.map((e: any) => String(e.patientId || '')).filter(Boolean))
  );
  const patients = patientIds.length
    ? await prisma.patientMaster.findMany({
        where: { tenantId, id: { in: patientIds } },
      })
    : [];
  const patientMap = new Map(patients.map((p: any) => [String(p.id || ''), p]));

  const items = payments.map((payment: any) => {
    const encounter = encounterMap.get(String(payment.encounterCoreId || ''));
    const patient = encounter ? patientMap.get(String(encounter.patientId || '')) : null;
    return {
      id: payment.id || payment.invoiceId,
      patientName: patient?.fullName || 'Unknown',
      invoiceNumber: payment.invoiceId || payment.reference || payment.id,
      total: payment.amount || 0,
      createdAt: payment.createdAt,
    };
  });

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
