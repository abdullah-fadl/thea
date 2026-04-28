import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String((resolvedParams as Record<string, string>)?.id || '');

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const record = await prisma.infectionSurveillance.findFirst({ where: { id, tenantId } });
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ record });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'infection_control.view' }
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String((resolvedParams as Record<string, string>)?.id || '');

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const existing = await prisma.infectionSurveillance.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const updated = await prisma.infectionSurveillance.update({
      where: { id },
      data: ({
        ...(body.outcome !== undefined && { outcome: String(body.outcome) }),
        ...(body.treatment !== undefined && { treatment: body.treatment ? String(body.treatment) : null }),
        // treatmentStarted is Boolean in the schema, not a Date
        ...(body.treatmentStarted !== undefined && { treatmentStarted: Boolean(body.treatmentStarted) }),
        ...(body.isolationPrecautions !== undefined && {
          isolationPrecautions: Array.isArray(body.isolationPrecautions) ? body.isolationPrecautions : [],
        }),
        ...(body.organism !== undefined && { organism: body.organism ? String(body.organism) : null }),
        ...(body.sensitivityProfile !== undefined && { sensitivityProfile: body.sensitivityProfile ?? null }),
        ...(body.notifiable !== undefined && { notifiable: Boolean(body.notifiable) }),
        ...(body.notes !== undefined && { notes: body.notes ? String(body.notes) : null }),
      }) as any,
    });

    return NextResponse.json({ success: true, record: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'infection_control.view' }
);
