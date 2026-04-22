import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessBilling } from '@/lib/billing/access';
import { validateBody } from '@/lib/validation/helpers';
import { approveCreditNoteSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, role, user }, params) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const creditNoteId = String((params as Record<string, string>)?.id || '').trim();
  if (!creditNoteId) {
    return NextResponse.json({ error: 'Credit note id is required' }, { status: 400 });
  }

  const creditNote = await prisma.billingCreditNote.findFirst({
    where: { tenantId, id: creditNoteId },
  });
  if (!creditNote) {
    return NextResponse.json({ error: 'Credit note not found' }, { status: 404 });
  }

  return NextResponse.json({ creditNote });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const creditNoteId = String((params as Record<string, string>)?.id || '').trim();
  if (!creditNoteId) {
    return NextResponse.json({ error: 'Credit note id is required' }, { status: 400 });
  }

  let body: any = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, approveCreditNoteSchema);
  if ('error' in v) return v.error;

  const { action, cancelReason } = v.data;

  const creditNote = await prisma.billingCreditNote.findFirst({
    where: { tenantId, id: creditNoteId },
  });
  if (!creditNote) {
    return NextResponse.json({ error: 'Credit note not found' }, { status: 404 });
  }

  if (creditNote.status !== 'DRAFT') {
    return NextResponse.json(
      { error: `Credit note is ${creditNote.status} — cannot modify`, code: 'INVALID_STATE' },
      { status: 409 }
    );
  }

  const now = new Date();

  if (action === 'APPROVE') {
    const updated = await prisma.billingCreditNote.update({
      where: { id: creditNoteId },
      data: {
        status: 'APPROVED',
        approvedBy: userId || null,
        approvedAt: now,
      },
    });

    await createAuditLog(
      'billing_credit_note',
      creditNoteId,
      'APPROVE_CREDIT_NOTE',
      userId || 'system',
      user?.email,
      { before: creditNote, after: updated },
      tenantId
    );

    return NextResponse.json({ creditNote: updated });
  }

  if (action === 'CANCEL') {
    if (!cancelReason) {
      return NextResponse.json({ error: 'cancelReason is required for CANCEL' }, { status: 400 });
    }

    const updated = await prisma.billingCreditNote.update({
      where: { id: creditNoteId },
      data: {
        status: 'CANCELLED',
        cancelledBy: userId || null,
        cancelledAt: now,
        cancelReason,
      },
    });

    await createAuditLog(
      'billing_credit_note',
      creditNoteId,
      'CANCEL_CREDIT_NOTE',
      userId || 'system',
      user?.email,
      { before: creditNote, after: updated, cancelReason },
      tenantId
    );

    return NextResponse.json({ creditNote: updated });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);
