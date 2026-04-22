import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TERMINAL_STATUSES = ['RELEASED_TO_FAMILY', 'TRANSFERRED_OUT'] as const;
type TerminalStatus = typeof TERMINAL_STATUSES[number];

function isTerminalStatus(value: string): value is TerminalStatus {
  return (TERMINAL_STATUSES as readonly string[]).includes(value);
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const caseId = String((params as any)?.caseId || '').trim();
  if (!caseId) {
    return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
  }

  let body: any | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    status: z.string().min(1),
    releaseDetails: z.unknown().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const status = String(body?.status || '').trim().toUpperCase();
  const releaseDetails = (body?.releaseDetails || null) as Record<string, unknown> | null;

  if (!status) {
    return NextResponse.json({ error: 'Validation failed', missing: ['status'], invalid: [] }, { status: 400 });
  }

  if (!isTerminalStatus(status)) {
    return NextResponse.json({ error: 'Invalid status', invalid: ['status'] }, { status: 400 });
  }

  if (status === 'RELEASED_TO_FAMILY') {
    const missing: string[] = [];
    if (!releaseDetails?.releasedAt) missing.push('releaseDetails.releasedAt');
    if (!releaseDetails?.releasedTo) missing.push('releaseDetails.releasedTo');
    if (!releaseDetails?.idNumber) missing.push('releaseDetails.idNumber');
    if (!releaseDetails?.reason) missing.push('releaseDetails.reason');
    if (missing.length) {
      return NextResponse.json({ error: 'Validation failed', missing, invalid: [] }, { status: 400 });
    }
  }

  const existing = await prisma.mortuaryCase.findFirst({
    where: { tenantId, id: caseId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Mortuary case not found' }, { status: 404 });
  }

  if (existing.status === status) {
    return NextResponse.json({ success: true, noOp: true, mortuaryCase: existing });
  }

  if (existing.status !== 'OPEN') {
    return NextResponse.json({ error: 'Mortuary case already closed' }, { status: 409 });
  }

  const existingReleaseDetails = existing.releaseDetails as Record<string, unknown> | null;
  const patch = {
    status,
    releaseDetails: status === 'RELEASED_TO_FAMILY' ? releaseDetails : existingReleaseDetails || null,
    updatedAt: new Date(),
  };
  await prisma.mortuaryCase.updateMany({
    where: { tenantId, id: caseId },
    data: patch as any,
  });
  await createAuditLog(
    'mortuary_case',
    caseId,
    'SET_STATUS',
    userId || 'system',
    user?.email,
    { before: existing, after: { ...existing, ...patch } },
    tenantId
  );

  return NextResponse.json({ success: true, mortuaryCase: { ...existing, ...patch } });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'mortuary.view' });
