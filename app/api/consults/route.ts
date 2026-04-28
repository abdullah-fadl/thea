import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// GET /api/consults
// Query params: status, specialty, episodeId
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status');
      const specialty = searchParams.get('specialty');
      const episodeId = searchParams.get('episodeId');

      const where: any = { tenantId };
      if (status) where.status = status;
      if (specialty) where.specialty = specialty;
      if (episodeId) where.episodeId = episodeId;

      const items = await prisma.consultRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      return NextResponse.json({ items });
    } catch (e) {
      logger.error('[Consults GET] Failed to fetch consults', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch consults' }, { status: 500 });
    }
  },
  { permissionKey: 'consults.view' },
);

// POST /api/consults
// Body: { patientMasterId, specialty, urgency, clinicalQuestion, clinicalSummary, consultantId?, episodeId? }
export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const {
        patientMasterId,
        specialty,
        urgency,
        clinicalQuestion,
        clinicalSummary,
        consultantId,
        episodeId,
      } = body;

      if (!patientMasterId || !specialty || !urgency || !clinicalQuestion) {
        return NextResponse.json(
          { error: 'patientMasterId, specialty, urgency, and clinicalQuestion are required' },
          { status: 400 },
        );
      }

      const consult = await prisma.consultRequest.create({
        data: {
          tenantId,
          patientMasterId,
          specialty,
          urgency,
          clinicalQuestion,
          clinicalSummary: clinicalSummary ?? null,
          consultantId: consultantId ?? null,
          status: 'PENDING',
          requestedBy: userId,
          ...(episodeId ? { episodeId } : {}),
        },
      });

      return NextResponse.json({ consult }, { status: 201 });
    } catch (e) {
      logger.error('[Consults POST] Failed to create consult', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to create consult' }, { status: 500 });
    }
  },
  { permissionKey: 'consults.create' },
);
