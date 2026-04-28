import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/or/cases/[caseId]/operative-note
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params) => {
    try {
      const caseId = String((params as any)?.caseId || '').trim();
      if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });

      const record = await prisma.orOperativeNote.findFirst({
        where: { tenantId, caseId },
      });

      return NextResponse.json({ operativeNote: record ?? null });
    } catch (e: unknown) {
      logger.error('[OR operative-note GET]', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch operative note' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);

// POST /api/or/cases/[caseId]/operative-note
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId, user }, params) => {
    try {
      const caseId = String((params as any)?.caseId || '').trim();
      if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });

      const orCase = await prisma.orCase.findFirst({ where: { tenantId, id: caseId } });
      if (!orCase) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

      const body = await req.json();
      const userName = user?.displayName || user?.email || null;

      // Validate required fields before allowing sign-off
      if (body.status === 'SIGNED' || body.status === 'FINALIZED') {
        const requiredFields: { key: string; label: string }[] = [
          { key: 'preOpDiagnosis', label: 'Pre-op diagnosis' },
          { key: 'postOpDiagnosis', label: 'Post-op diagnosis' },
          { key: 'procedurePerformed', label: 'Procedure performed' },
          { key: 'findings', label: 'Findings' },
          { key: 'techniqueDescription', label: 'Technique description' },
        ];
        const emptyFields = requiredFields.filter(
          (f) => !body[f.key] || String(body[f.key]).trim() === ''
        );
        if (emptyFields.length > 0) {
          return NextResponse.json(
            {
              error: 'Cannot sign operative note with empty required fields',
              emptyFields: emptyFields.map((f) => f.label),
            },
            { status: 400 },
          );
        }
      }

      const record = await prisma.orOperativeNote.upsert({
        where: { caseId },
        create: {
          tenantId,
          caseId,
          surgeonUserId: userId,
          surgeonName: userName,
          preOpDiagnosis: body.preOpDiagnosis ?? null,
          postOpDiagnosis: body.postOpDiagnosis ?? null,
          procedurePerformed: body.procedurePerformed ?? null,
          procedureCode: body.procedureCode ?? null,
          operationType: body.operationType ?? null,
          laterality: body.laterality ?? null,
          incisionTime: body.incisionTime ? new Date(body.incisionTime) : null,
          closureTime: body.closureTime ? new Date(body.closureTime) : null,
          totalDurationMin: body.totalDurationMin ?? null,
          assistantSurgeon: body.assistantSurgeon ?? null,
          anesthesiologist: body.anesthesiologist ?? null,
          scrubNurse: body.scrubNurse ?? null,
          circulatingNurse: body.circulatingNurse ?? null,
          anesthesiaType: body.anesthesiaType ?? null,
          findings: body.findings ?? null,
          techniqueDescription: body.techniqueDescription ?? null,
          complications: body.complications ?? null,
          estimatedBloodLossMl: body.estimatedBloodLossMl ?? null,
          drains: body.drains ?? null,
          specimens: body.specimens ?? null,
          implants: body.implants ?? null,
          closureMethod: body.closureMethod ?? null,
          dressingType: body.dressingType ?? null,
          postOpInstructions: body.postOpInstructions ?? null,
          dietInstructions: body.dietInstructions ?? null,
          activityLevel: body.activityLevel ?? null,
          followUpPlan: body.followUpPlan ?? null,
          disposition: body.disposition ?? null,
          status: body.status ?? 'DRAFT',
        },
        update: {
          surgeonUserId: userId,
          surgeonName: userName,
          preOpDiagnosis: body.preOpDiagnosis ?? null,
          postOpDiagnosis: body.postOpDiagnosis ?? null,
          procedurePerformed: body.procedurePerformed ?? null,
          procedureCode: body.procedureCode ?? null,
          operationType: body.operationType ?? null,
          laterality: body.laterality ?? null,
          incisionTime: body.incisionTime ? new Date(body.incisionTime) : null,
          closureTime: body.closureTime ? new Date(body.closureTime) : null,
          totalDurationMin: body.totalDurationMin ?? null,
          assistantSurgeon: body.assistantSurgeon ?? null,
          anesthesiologist: body.anesthesiologist ?? null,
          scrubNurse: body.scrubNurse ?? null,
          circulatingNurse: body.circulatingNurse ?? null,
          anesthesiaType: body.anesthesiaType ?? null,
          findings: body.findings ?? null,
          techniqueDescription: body.techniqueDescription ?? null,
          complications: body.complications ?? null,
          estimatedBloodLossMl: body.estimatedBloodLossMl ?? null,
          drains: body.drains ?? null,
          specimens: body.specimens ?? null,
          implants: body.implants ?? null,
          closureMethod: body.closureMethod ?? null,
          dressingType: body.dressingType ?? null,
          postOpInstructions: body.postOpInstructions ?? null,
          dietInstructions: body.dietInstructions ?? null,
          activityLevel: body.activityLevel ?? null,
          followUpPlan: body.followUpPlan ?? null,
          disposition: body.disposition ?? null,
          status: body.status ?? 'DRAFT',
          signedAt: body.status === 'SIGNED' ? new Date() : undefined,
          amendedAt: body.status === 'AMENDED' ? new Date() : undefined,
          amendmentReason: body.amendmentReason ?? undefined,
        },
      });

      return NextResponse.json({ operativeNote: record }, { status: 201 });
    } catch (e: unknown) {
      logger.error('[OR operative-note POST]', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to save operative note' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);
