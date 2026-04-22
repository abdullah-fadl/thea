import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── GET /api/icu/incoming-transfers ─────────────────────────────────────────
// Returns escalation transfer requests targeted at ICU/CCU units
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = req.nextUrl;
      const status = url.searchParams.get('status') || 'REQUESTED';

      const where: any = {
        tenantId,
        transferType: 'ESCALATION',
        targetUnitType: { in: ['ICU', 'CCU'] },
      };
      if (status && status !== 'ALL') {
        where.status = status;
      }

      const items = await prisma.wardTransferRequest.findMany({
        where,
        orderBy: [
          { urgency: 'desc' },     // EMERGENCY first
          { requestedAt: 'desc' }, // newest first
        ],
        take: 50,
      });

      const total = await prisma.wardTransferRequest.count({ where });

      // Also get counts by status for badges
      const [pendingCount, approvedCount, completedCount, rejectedCount] = await Promise.all([
        prisma.wardTransferRequest.count({
          where: { tenantId, transferType: 'ESCALATION', targetUnitType: { in: ['ICU', 'CCU'] }, status: 'REQUESTED' },
        }),
        prisma.wardTransferRequest.count({
          where: { tenantId, transferType: 'ESCALATION', targetUnitType: { in: ['ICU', 'CCU'] }, status: 'APPROVED' },
        }),
        prisma.wardTransferRequest.count({
          where: { tenantId, transferType: 'ESCALATION', targetUnitType: { in: ['ICU', 'CCU'] }, status: 'COMPLETED' },
        }),
        prisma.wardTransferRequest.count({
          where: { tenantId, transferType: 'ESCALATION', targetUnitType: { in: ['ICU', 'CCU'] }, status: 'REJECTED' },
        }),
      ]);

      return NextResponse.json({
        items,
        total,
        counts: {
          pending: pendingCount,
          approved: approvedCount,
          completed: completedCount,
          rejected: rejectedCount,
        },
      });
    } catch (err) {
      logger.error('[icu/incoming-transfers] GET error:', err);
      return NextResponse.json({ error: 'Failed to fetch incoming transfers' }, { status: 500 });
    }
  },
  { permissionKey: 'icu.view' }
);
