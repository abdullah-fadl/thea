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
    if (!id) return NextResponse.json({ error: 'Missing case id' }, { status: 400 });

    const tc = await prisma.transplantCase.findFirst({ where: { id, tenantId } });
    if (!tc) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    const rejections = await prisma.transplantRejection.findMany({
      where: { caseId: id, tenantId },
      orderBy: { onsetDate: 'desc' },
    });

    return NextResponse.json({ rejections });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'transplant.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String((resolvedParams as Record<string, string>)?.id || '');
    if (!id) return NextResponse.json({ error: 'Missing case id' }, { status: 400 });

    const tc = await prisma.transplantCase.findFirst({ where: { id, tenantId } });
    if (!tc) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      onsetDate,
      type,
      banffGrade,
      treatment,
      response,
      graftLoss,
    } = body;

    if (!onsetDate || !type || !treatment) {
      return NextResponse.json(
        { error: 'onsetDate, type, and treatment are required' },
        { status: 400 }
      );
    }

    const rejection = await prisma.transplantRejection.create({
      data: {
        tenantId,
        caseId: id,
        onsetDate: new Date(onsetDate as string),
        type: String(type),
        banffGrade: banffGrade ? String(banffGrade) : null,
        treatment: String(treatment),
        response: response ? String(response) : null,
        graftLoss: Boolean(graftLoss),
      },
    });

    return NextResponse.json({ success: true, id: rejection.id, rejection }, { status: 201 });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'transplant.manage' }
);
