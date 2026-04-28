import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const caseId = String((params as Record<string, string>)?.caseId || '').trim();
  if (!caseId) {
    return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    morgueRoom: z.string().optional(),
    shelf: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const morgueRoom = String(body?.morgueRoom || '').trim();
  const shelf = String(body?.shelf || '').trim();

  const existing = await prisma.mortuaryCase.findFirst({
    where: { tenantId, id: caseId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Mortuary case not found' }, { status: 404 });
  }

  const nextLocation = { morgueRoom, shelf };
  const prevLocation = (existing.location as Record<string, string>) || {};
  const same =
    String(prevLocation.morgueRoom || '') === morgueRoom &&
    String(prevLocation.shelf || '') === shelf;

  if (same) {
    return NextResponse.json({ success: true, noOp: true, mortuaryCase: existing });
  }

  const now = new Date();
  const patch = { location: nextLocation as Prisma.InputJsonValue, updatedAt: now };
  await prisma.mortuaryCase.updateMany({
    where: { tenantId, id: caseId },
    data: patch,
  });
  await createAuditLog(
    'mortuary_case',
    caseId,
    'SET_LOCATION',
    userId || 'system',
    user?.email,
    { before: existing, after: { ...existing, ...patch } },
    tenantId
  );

  return NextResponse.json({ success: true, mortuaryCase: { ...existing, ...patch } });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'mortuary.view' });
