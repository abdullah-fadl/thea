import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessBilling } from '@/lib/billing/access';
import { validateBody } from '@/lib/validation/helpers';
import { payerContextSetSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MODES = new Set(['CASH', 'INSURANCE']);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, payerContextSetSchema);
  if ('error' in v) return v.error;

  const encounterCoreId = String(v.data.encounterCoreId || '').trim();
  const mode = String(v.data.mode || '').trim().toUpperCase();
  const insuranceCompanyId = v.data.insuranceCompanyId ? String(v.data.insuranceCompanyId || '').trim() : null;
  const insuranceCompanyName = v.data.insuranceCompanyName ? String(v.data.insuranceCompanyName || '').trim() : null;
  const memberOrPolicyRef = v.data.memberOrPolicyRef ? String(v.data.memberOrPolicyRef || '').trim() : null;
  const notes = v.data.notes ? String(v.data.notes || '').trim() : null;
  const idempotencyKey = String(v.data.idempotencyKey || '').trim();

  const lock = await prisma.billingLock.findUnique({
    where: { tenantId_encounterCoreId: { tenantId, encounterCoreId } },
  });
  if (lock?.isLocked) {
    return NextResponse.json({ error: 'Billing is locked' }, { status: 409 });
  }
  const posting = await prisma.billingPosting.findUnique({
    where: { tenantId_encounterCoreId: { tenantId, encounterCoreId } },
  });
  if (posting?.status === 'POSTED') {
    return NextResponse.json({ error: 'Billing is posted', code: 'BILLING_POSTED' }, { status: 409 });
  }

  const existingByKey = await prisma.billingPayerContext.findFirst({
    where: { tenantId, idempotencyKey },
  });
  if (existingByKey) {
    return NextResponse.json({ payerContext: existingByKey, noOp: true });
  }

  const existing = await prisma.billingPayerContext.findUnique({
    where: { tenantId_encounterCoreId: { tenantId, encounterCoreId } },
  });

  const now = new Date();
  const recordId = existing?.id || uuidv4();

  const record = await prisma.billingPayerContext.upsert({
    where: { tenantId_encounterCoreId: { tenantId, encounterCoreId } },
    create: {
      id: recordId,
      tenantId,
      encounterCoreId,
      mode,
      insuranceCompanyId: mode === 'INSURANCE' ? insuranceCompanyId : null,
      insuranceCompanyName: mode === 'INSURANCE' ? insuranceCompanyName : null,
      memberOrPolicyRef: mode === 'INSURANCE' ? memberOrPolicyRef : null,
      notes: notes || null,
      status: 'ACTIVE',
      createdBy: userId || null,
      updatedBy: userId || null,
      idempotencyKey,
    },
    update: {
      mode,
      insuranceCompanyId: mode === 'INSURANCE' ? insuranceCompanyId : null,
      insuranceCompanyName: mode === 'INSURANCE' ? insuranceCompanyName : null,
      memberOrPolicyRef: mode === 'INSURANCE' ? memberOrPolicyRef : null,
      notes: notes || null,
      status: 'ACTIVE',
      updatedBy: userId || null,
      idempotencyKey,
    },
  });

  await createAuditLog(
    'payer_context',
    record.id,
    'PAYER_CONTEXT_SET',
    userId || 'system',
    user?.email,
    { before: existing || null, after: record, encounterCoreId, mode, insuranceCompanyId, memberOrPolicyRef },
    tenantId
  );

  return NextResponse.json({ payerContext: record });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);
