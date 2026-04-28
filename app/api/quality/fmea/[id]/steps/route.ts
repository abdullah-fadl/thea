// =============================================================================
// Quality FMEA — Add Step
// POST /api/quality/fmea/[id]/steps
// =============================================================================
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const POST = withAuthTenant(
  withErrorHandler(
    async (
      req: NextRequest,
      { tenantId }: { tenantId: string },
      params: { id: string },
    ) => {
      const analysisId = String(params?.id ?? '').trim();
      if (!analysisId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

      // Verify analysis belongs to tenant
      const analysis = await prisma.fmeaAnalysis.findFirst({ where: { id: analysisId, tenantId } });
      if (!analysis) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const body = await req.json();
      const severity = Math.min(10, Math.max(1, Number(body.severity ?? 1)));
      const occurrence = Math.min(10, Math.max(1, Number(body.occurrence ?? 1)));
      const detectability = Math.min(10, Math.max(1, Number(body.detectability ?? 1)));
      const rpn = severity * occurrence * detectability;

      const step = await prisma.fmeaStep.create({
        data: {
          tenantId,
          analysisId,
          stepNumber: Number(body.stepNumber ?? 1),
          processStep: body.processStep,
          failureMode: body.failureMode,
          failureEffect: body.failureEffect,
          failureCause: body.failureCause,
          severity,
          occurrence,
          detectability,
          rpn,
          currentControls: body.currentControls ?? null,
          recommendedAction: body.recommendedAction ?? null,
          actionOwner: body.actionOwner ?? null,
          targetDate: body.targetDate ? new Date(body.targetDate) : null,
        },
      });

      // Update highRiskActions summary count
      const highRiskCount = await prisma.fmeaStep.count({
        where: { analysisId, rpn: { gte: 100 } },
      });
      await prisma.fmeaAnalysis.update({
        where: { id: analysisId },
        data: { updatedAt: new Date() },
      });

      return NextResponse.json({ step, highRiskActions: highRiskCount }, { status: 201 });
    },
  ),
  { permissionKey: 'quality.manage' },
);
