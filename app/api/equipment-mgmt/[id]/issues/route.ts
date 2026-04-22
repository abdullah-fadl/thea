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
    const id = String(resolvedParams?.id || '');

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const issues = await prisma.equipmentIssue.findMany({
      where: { equipmentId: id, tenantId },
      orderBy: { reportedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ issues });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'equipment.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String(resolvedParams?.id || '');

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const equipment = await prisma.equipment.findFirst({ where: { id, tenantId } });
    if (!equipment) return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { severity, description } = body;

    if (!severity || !description) {
      return NextResponse.json({ error: 'severity and description are required' }, { status: 400 });
    }

    const VALID_SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
    if (!VALID_SEVERITIES.has(String(severity).toUpperCase())) {
      return NextResponse.json({ error: 'Invalid severity' }, { status: 400 });
    }

    const issue = await prisma.equipmentIssue.create({
      data: {
        tenantId,
        equipmentId: id,
        reportedBy: userId,
        reportedAt: new Date(),
        severity: String(severity).toUpperCase(),
        description: String(description),
        status: 'OPEN',
      },
    });

    // Update equipment status if critical or high severity
    const sev = String(severity).toUpperCase();
    if (sev === 'CRITICAL' || sev === 'HIGH') {
      await prisma.equipment.update({
        where: { id },
        data: { status: 'UNDER_MAINTENANCE' },
      });
    }

    return NextResponse.json({ success: true, id: issue.id, issue });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'equipment.manage' }
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const equipmentId = String(resolvedParams?.id || '');

    if (!equipmentId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { issueId, resolution } = body;

    if (!issueId) return NextResponse.json({ error: 'issueId is required' }, { status: 400 });

    const issue = await prisma.equipmentIssue.findFirst({
      where: { id: String(issueId), equipmentId, tenantId },
    });
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });

    const updated = await prisma.equipmentIssue.update({
      where: { id: String(issueId) },
      data: {
        status: 'RESOLVED',
        resolvedBy: userId,
        resolvedAt: new Date(),
        resolution: resolution ? String(resolution) : null,
      },
    });

    return NextResponse.json({ success: true, issue: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'equipment.manage' }
);
