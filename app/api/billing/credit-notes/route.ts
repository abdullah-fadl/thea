import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessBilling } from '@/lib/billing/access';
import { validateBody } from '@/lib/validation/helpers';
import { createCreditNoteSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, role, user }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const encounterCoreId = req.nextUrl.searchParams.get('encounterCoreId') || '';
  const status = req.nextUrl.searchParams.get('status') || '';

  const where: any = { tenantId };
  if (encounterCoreId) where.encounterCoreId = encounterCoreId;
  if (status) where.status = status;

  const items = await prisma.billingCreditNote.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);

async function getNextCreditNoteNumber(tenantId: string): Promise<string> {
  const lastNote = await prisma.billingCreditNote.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: { creditNoteNumber: true },
  });
  const lastNum = lastNote?.creditNoteNumber
    ? parseInt(lastNote.creditNoteNumber.replace('CN-', ''), 10) || 0
    : 0;
  return `CN-${String(lastNum + 1).padStart(6, '0')}`;
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, createCreditNoteSchema);
  if ('error' in v) return v.error;

  const { encounterCoreId, chargeEventId, invoiceId, type, amount, reason, metadata } = v.data;

  // Validate encounter exists
  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  // If linked to a charge event, validate it
  if (chargeEventId) {
    const charge = await prisma.billingChargeEvent.findFirst({
      where: { tenantId, id: chargeEventId },
    });
    if (!charge) {
      return NextResponse.json({ error: 'Charge event not found' }, { status: 404 });
    }
    // Credit note amount cannot exceed charge total
    if (amount > Number(charge.totalPrice || 0)) {
      return NextResponse.json(
        { error: 'Credit note amount exceeds charge total', code: 'AMOUNT_EXCEEDS_CHARGE' },
        { status: 400 }
      );
    }
  }

  // If linked to an invoice, validate it
  if (invoiceId) {
    const invoice = await prisma.billingInvoice.findFirst({
      where: { tenantId, id: invoiceId },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
  }

  const creditNoteNumber = await getNextCreditNoteNumber(tenantId);
  const now = new Date();

  const creditNote = await prisma.billingCreditNote.create({
    data: {
      id: uuidv4(),
      tenantId,
      encounterCoreId,
      patientMasterId: encounter.patientId || null,
      chargeEventId: chargeEventId || null,
      invoiceId: invoiceId || null,
      creditNoteNumber,
      type,
      amount,
      reason,
      status: 'DRAFT',
      metadata: (metadata as any) || null,
      createdAt: now,
      createdBy: userId || null,
    },
  });

  await createAuditLog(
    'billing_credit_note',
    creditNote.id,
    'CREATE_CREDIT_NOTE',
    userId || 'system',
    user?.email,
    { creditNote },
    tenantId
  );

  return NextResponse.json({ creditNote });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);
