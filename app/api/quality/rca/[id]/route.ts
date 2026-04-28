// =============================================================================
// Quality RCA — Get & Update
// GET /api/quality/rca/[id]
// PUT /api/quality/rca/[id]
// =============================================================================
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(
    async (
      _req: NextRequest,
      { tenantId }: { tenantId: string },
      params: { id: string },
    ) => {
      const id = String(params?.id ?? '').trim();
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

      const analysis = await prisma.rcaAnalysis.findFirst({ where: { id, tenantId } });
      if (!analysis) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ analysis });
    },
  ),
  { permissionKey: 'quality.view' },
);

export const PUT = withAuthTenant(
  withErrorHandler(
    async (
      req: NextRequest,
      { tenantId, userId }: { tenantId: string; userId: string },
      params: { id: string },
    ) => {
      const id = String(params?.id ?? '').trim();
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

      const existing = await prisma.rcaAnalysis.findFirst({ where: { id, tenantId } });
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const body = await req.json();
      const data: any = {};

      if (body.status !== undefined) {
        data.status = body.status;
        if (body.status === 'APPROVED') {
          data.approvedBy = userId;
          data.approvedAt = new Date();
        }
      }
      if (body.fishbone !== undefined) data.fishbone = body.fishbone;
      if (body.whyChain !== undefined) data.whyChain = body.whyChain;
      if (body.rootCauses !== undefined) data.rootCauses = body.rootCauses;
      if (body.recommendations !== undefined) data.recommendations = body.recommendations;
      if (body.timeline !== undefined) data.timeline = body.timeline;
      if (body.lessonsLearned !== undefined) data.lessonsLearned = body.lessonsLearned;
      if (body.problemStatement !== undefined) data.problemStatement = body.problemStatement;
      if (body.teamMembers !== undefined) data.teamMembers = body.teamMembers;
      if (body.contributingFactors !== undefined) data.contributingFactors = body.contributingFactors;

      const updated = await prisma.rcaAnalysis.update({ where: { id }, data });
      return NextResponse.json({ analysis: updated });
    },
  ),
  { permissionKey: 'quality.manage' },
);
