import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// GET /api/physiotherapy/referrals
// Query params: status, patientMasterId
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status');
      const patientMasterId = searchParams.get('patientMasterId');

      const where: any = { tenantId };
      if (status) where.status = status;
      if (patientMasterId) where.patientMasterId = patientMasterId;

      const items = await prisma.ptReferral.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      return NextResponse.json({ items });
    } catch (e) {
      logger.error('[PT referrals GET] Failed to fetch referrals', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 });
    }
  },
  { permissionKey: 'physiotherapy.view' },
);

// POST /api/physiotherapy/referrals
// Body: { patientMasterId, reason, urgency, specialty, notes, encounterId, episodeId }
export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const { patientMasterId, reason, urgency, specialty, notes, encounterId, episodeId } = body;

      if (!patientMasterId || !reason || !urgency || !specialty) {
        return NextResponse.json(
          { error: 'patientMasterId, reason, urgency, and specialty are required' },
          { status: 400 },
        );
      }

      const referral = await prisma.ptReferral.create({
        data: {
          tenantId,
          patientMasterId,
          reason,
          urgency,
          specialty,
          notes: notes ?? null,
          status: 'PENDING',
          ...(encounterId ? { encounterId } : {}),
          ...(episodeId ? { episodeId } : {}),
          referredBy: userId,
          createdByUserId: userId,
        },
      });

      return NextResponse.json({ referral }, { status: 201 });
    } catch (e) {
      logger.error('[PT referrals POST] Failed to create referral', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to create referral' }, { status: 500 });
    }
  },
  { permissionKey: 'physiotherapy.create' },
);
