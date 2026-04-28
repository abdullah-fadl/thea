import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_STATUSES = ['ACTIVE', 'CONTAINED', 'RESOLVED', 'MONITORING'];
const INFECTION_TYPES = ['SSI', 'CLABSI', 'CAUTI', 'VAP', 'GI', 'RESPIRATORY', 'SKIN', 'OTHER'];

/**
 * GET /api/infection-control/outbreaks
 * List outbreaks with filters: status, infectionType
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const infectionType = url.searchParams.get('infectionType');
    const limit = Math.min(200, parseInt(url.searchParams.get('limit') || '100'));

    const where: Record<string, unknown> = { tenantId };
    if (status && VALID_STATUSES.includes(status)) where.status = status;
    if (infectionType && INFECTION_TYPES.includes(infectionType)) where.infectionType = infectionType;

    const items = await prisma.outbreakEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }).catch(() => []) || [];

    // Summary counts
    const allOutbreaks = await prisma.outbreakEvent.findMany({
      where: { tenantId },
      select: { status: true, totalCases: true, activeCases: true, notifiedAuthorities: true },
      take: 500,
    }).catch(() => []) || [];

    const summary = {
      total: allOutbreaks.length,
      active: allOutbreaks.filter((o: Record<string, unknown>) => o.status === 'ACTIVE').length,
      contained: allOutbreaks.filter((o: Record<string, unknown>) => o.status === 'CONTAINED').length,
      resolved: allOutbreaks.filter((o: Record<string, unknown>) => o.status === 'RESOLVED').length,
      monitoring: allOutbreaks.filter((o: Record<string, unknown>) => o.status === 'MONITORING').length,
      totalCases: allOutbreaks.reduce((sum: number, o: Record<string, unknown>) => sum + (Number(o.totalCases) || 0), 0),
      notified: allOutbreaks.filter((o: Record<string, unknown>) => o.notifiedAuthorities).length,
    };

    return NextResponse.json({ items, summary });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'infection_control.view' }
);

/**
 * POST /api/infection-control/outbreaks
 * Declare a new outbreak
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json();

    const { name, organism, infectionType, department, startDate, notes } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const record = await prisma.outbreakEvent.create({
      data: {
        tenantId,
        name: name.trim(),
        organism: organism || null,
        infectionType: infectionType && INFECTION_TYPES.includes(infectionType) ? infectionType : null,
        department: department || null,
        startDate: startDate ? new Date(startDate + 'T00:00:00Z') : new Date(),
        declaredByUserId: userId,
        declaredByName: ((user as unknown as Record<string, unknown>)?.name as string) || user?.email || null,
        cases: [],
        totalCases: 0,
        activeCases: 0,
        recoveredCases: 0,
        controlMeasures: [],
        staffCommunication: [],
        environmentalActions: [],
        status: 'ACTIVE',
        notes: notes || null,
      },
    });

    logger.info('Outbreak declared', {
      category: 'clinical',
      tenantId,
      userId,
      outbreakId: record.id,
      name,
    });

    return NextResponse.json({ success: true, id: record.id, outbreak: record });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'infection_control.manage' }
);
