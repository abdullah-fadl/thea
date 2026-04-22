import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { createAuditLog } from '@/lib/utils/audit';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getLatestEvent(tenantId: string, claimId: string) {
  return prisma.billingClaimEvent.findFirst({
    where: { tenantId, claimId },
    orderBy: [{ createdAt: 'desc' }],
  });
}

async function getResubmissionCount(tenantId: string, claimId: string) {
  return prisma.billingClaimEvent.count({
    where: { tenantId, claimId, status: 'RESUBMITTED' },
  });
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role, userId }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const claimId = String(req.nextUrl.pathname.split('/').slice(-2)[0] || '').trim();
  if (!claimId) {
    return NextResponse.json({ error: 'claimId is required' }, { status: 400 });
  }

  const claim = await prisma.billingClaim.findFirst({
    where: { tenantId, id: claimId },
  });
  if (!claim) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
  }

  const latest = await getLatestEvent(tenantId, claimId);
  const status = String(latest?.status || 'DRAFT').toUpperCase();
  if (status !== 'REJECTED') {
    return NextResponse.json({ error: 'Invalid transition', status }, { status: 409 });
  }

  // Parse optional correction notes from body
  let correctionNotes: string | null = null;
  try {
    const body = await req.json();
    correctionNotes = body?.correctionNotes ? String(body.correctionNotes).trim() : null;
  } catch {
    // Body is optional for resubmit — proceed without notes
  }

  const resubmissionCount = await getResubmissionCount(tenantId, claimId);
  const nextVersion = Math.max(1, resubmissionCount + 1);

  const now = new Date();
  const event = {
    id: uuidv4(),
    tenantId,
    claimId,
    status: 'RESUBMITTED',
    version: nextVersion,
    rejectionReason: correctionNotes, // Store correction notes in rejectionReason field
    createdAt: now,
    createdByUserId: userId || null,
  };

  await prisma.billingClaimEvent.create({ data: event });
  await createAuditLog(
    'claim_event',
    event.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: event },
    tenantId
  );

  return NextResponse.json({ success: true, version: nextVersion });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);
