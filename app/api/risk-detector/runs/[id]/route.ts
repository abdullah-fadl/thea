import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get risk run
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return withAuthTenant(async (req, { user, tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const runId = resolvedParams.id;

      const riskRun = await prisma.riskRun.findFirst({
        where: { tenantId, id: runId },
      });

    if (!riskRun) {
      return NextResponse.json(
        { error: 'Risk run not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      riskRun,
    });
  } catch (error) {
    logger.error('Get risk run error:', { error: error });
    // [SEC-10]
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    }
  }, { tenantScoped: true, permissionKey: 'risk-detector.runs.read' })(request);
}
