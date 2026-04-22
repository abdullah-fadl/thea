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

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const record = await prisma.patientEducationRecord.findFirst({
      where: { id, tenantId },
    });

    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ record });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'patient_education.view' }
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String((resolvedParams as Record<string, string>)?.id || '');

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const existing = await prisma.patientEducationRecord.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const updated = await prisma.patientEducationRecord.update({
      where: { id },
      data: {
        ...(body.topics !== undefined && { topics: body.topics as any }),
        ...(body.method !== undefined && {
          method: Array.isArray(body.method) ? body.method : (body.method ? [String(body.method)] : []),
        }),
        ...(body.barriers !== undefined && {
          barriers: Array.isArray(body.barriers) ? body.barriers : (body.barriers ? [String(body.barriers)] : []),
        }),
        // interpreter is Boolean in schema
        ...(body.interpreter !== undefined && { interpreter: Boolean(body.interpreter) }),
        ...(body.comprehension !== undefined && { comprehension: body.comprehension ? String(body.comprehension) : 'VERBALIZED_UNDERSTANDING' }),
        ...(body.followUpNeeded !== undefined && { followUpNeeded: Boolean(body.followUpNeeded) }),
        ...(body.notes !== undefined && { notes: body.notes ? String(body.notes) : null }),
      },
    });

    return NextResponse.json({ success: true, record: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'patient_education.manage' }
);
