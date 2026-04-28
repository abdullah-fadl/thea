import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/sam/risks/matrix — Risk matrix data (5x5 grid)
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const risks = await prisma.riskAssessment.findMany({
        where: { tenantId, status: { not: 'CLOSED' } },
        select: { id: true, title: true, likelihood: true, impact: true, riskScore: true, riskLevel: true, status: true },
        take: 200,
      });

      // Build 5x5 matrix
      const matrix: Record<string, { count: number; risks: Array<{ id: string; title: string; status: string }> }> = {};
      for (let l = 1; l <= 5; l++) {
        for (let i = 1; i <= 5; i++) {
          matrix[`${l}-${i}`] = { count: 0, risks: [] };
        }
      }

      risks.forEach((r) => {
        const key = `${r.likelihood}-${r.impact}`;
        if (matrix[key]) {
          matrix[key].count++;
          matrix[key].risks.push({ id: r.id, title: r.title, status: r.status });
        }
      });

      // Summary stats
      const summary = {
        total: risks.length,
        critical: risks.filter((r) => r.riskLevel === 'CRITICAL').length,
        high: risks.filter((r) => r.riskLevel === 'HIGH').length,
        medium: risks.filter((r) => r.riskLevel === 'MEDIUM').length,
        low: risks.filter((r) => r.riskLevel === 'LOW').length,
        averageScore: risks.length > 0 ? Math.round(risks.reduce((s, r) => s + r.riskScore, 0) / risks.length * 10) / 10 : 0,
      };

      return NextResponse.json({ matrix, summary });
    } catch (error: unknown) {
      logger.error('Risk matrix error:', { error });
      return NextResponse.json({ error: 'Failed to load risk matrix' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.risk.read' }
);
