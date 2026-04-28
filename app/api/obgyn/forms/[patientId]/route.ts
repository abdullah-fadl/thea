import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const patientId = String((params as Record<string, string>)?.patientId || '').trim();
  const type = String(req.nextUrl.searchParams.get('type') || '').trim();
  if (!patientId || !type) {
    return NextResponse.json({ error: 'patientId and type are required' }, { status: 400 });
  }

  const items = await prisma.obgynForm.findMany({
    where: { tenantId, patientId, type },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ items });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'obgyn.forms.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
  const patientId = String((params as Record<string, string>)?.patientId || '').trim();
  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const bodySchema = z.object({
    type: z.string().min(1),
    data: z.unknown(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const type = String(body?.type || '').trim();
  const data = body?.data || null;
  if (!type || !data) {
    return NextResponse.json({ error: 'type and data are required' }, { status: 400 });
  }

  const now = new Date();
  const form = await prisma.obgynForm.create({
    data: {
      tenantId,
      patientId,
      type,
      data: data as Record<string, unknown>,
      createdAt: now,
      createdBy: userId || null,
    } as Parameters<typeof prisma.obgynForm.create>[0]['data'],
  });

  return NextResponse.json({ success: true, form });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'obgyn.forms.edit' }
);
