import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** GET /api/or/cases/[caseId]/nursing-doc */
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params) => {
    try {
      const caseId = String((params as any)?.caseId || '').trim();
      if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });

      const nursingDoc = await prisma.orNursingDoc?.findFirst?.({
        where: { tenantId, caseId },
      }).catch(() => null);

      return NextResponse.json({ nursingDoc: nursingDoc || null });
    } catch (e: unknown) {
      logger.error('[OR nursing-doc GET]', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch nursing doc' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.nursing.view' },
);

/** POST /api/or/cases/[caseId]/nursing-doc — Upsert */
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId, user }, params) => {
    try {
      const caseId = String((params as any)?.caseId || '').trim();
      if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });

      // Verify case
      const orCase = await prisma.orCase.findFirst({ where: { tenantId, id: caseId } });
      if (!orCase) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

      const body = await req.json();
      const {
        position, positionAids, positionVerifiedBy,
        skinPrepAgent, skinPrepArea, skinPrepPerformedBy, skinIntegrityPreOp, skinIntegrityPostOp,
        tourniquetUsed = false, tourniquetSite, tourniquetPressure, tourniquetOnTime, tourniquetOffTime,
        electrocauteryUsed = false, electrocauteryType, electrocauterySettings, groundPadPlacement,
        estimatedBloodLossMl, irrigationUsedMl, drainType, drainOutput,
        nursingNotes, documentedByName,
      } = body;

      // Auto-compute tourniquet total minutes
      let tourniquetTotalMin: number | null = null;
      if (tourniquetUsed && tourniquetOnTime && tourniquetOffTime) {
        const onMs = new Date(tourniquetOnTime).getTime();
        const offMs = new Date(tourniquetOffTime).getTime();
        if (offMs > onMs) {
          tourniquetTotalMin = Math.round((offMs - onMs) / 60000);
        }
      }

      const data: any = {
        tenantId,
        caseId,
        position: position || null,
        positionAids: positionAids || null,
        positionVerifiedBy: positionVerifiedBy || null,
        skinPrepAgent: skinPrepAgent || null,
        skinPrepArea: skinPrepArea || null,
        skinPrepPerformedBy: skinPrepPerformedBy || null,
        skinIntegrityPreOp: skinIntegrityPreOp || null,
        skinIntegrityPostOp: skinIntegrityPostOp || null,
        tourniquetUsed: Boolean(tourniquetUsed),
        tourniquetSite: tourniquetSite || null,
        tourniquetPressure: tourniquetPressure ? Number(tourniquetPressure) : null,
        tourniquetOnTime: tourniquetOnTime ? new Date(tourniquetOnTime) : null,
        tourniquetOffTime: tourniquetOffTime ? new Date(tourniquetOffTime) : null,
        tourniquetTotalMin,
        electrocauteryUsed: Boolean(electrocauteryUsed),
        electrocauteryType: electrocauteryType || null,
        electrocauterySettings: electrocauterySettings || null,
        groundPadPlacement: groundPadPlacement || null,
        estimatedBloodLossMl: estimatedBloodLossMl != null ? Number(estimatedBloodLossMl) : null,
        irrigationUsedMl: irrigationUsedMl != null ? Number(irrigationUsedMl) : null,
        drainType: drainType || null,
        drainOutput: drainOutput || null,
        nursingNotes: nursingNotes || null,
        documentedByUserId: userId,
        documentedByName: documentedByName || null,
      };

      // Check if existing doc for this case
      const existing = await prisma.orNursingDoc?.findFirst?.({
        where: { tenantId, caseId },
      }).catch(() => null);

      let nursingDoc;
      if (existing) {
        nursingDoc = await prisma.orNursingDoc?.update?.({
          where: { id: existing.id },
          data,
        });
      } else {
        nursingDoc = await prisma.orNursingDoc?.create?.({ data });
      }

      // Audit log for surgical safety checklist documentation
      const auditAction = existing ? 'UPDATE' : 'CREATE';
      await createAuditLog(
        'or_nursing_doc',
        nursingDoc?.id || caseId,
        auditAction,
        userId || 'system',
        user?.email,
        {
          caseId,
          phase: 'surgical_safety_checklist',
          position: position || null,
          skinPrepAgent: skinPrepAgent || null,
          tourniquetUsed: Boolean(tourniquetUsed),
          electrocauteryUsed: Boolean(electrocauteryUsed),
          estimatedBloodLossMl: estimatedBloodLossMl ?? null,
        },
        tenantId,
        req,
      );

      return NextResponse.json({ nursingDoc }, { status: existing ? 200 : 201 });
    } catch (e: unknown) {
      logger.error('[OR nursing-doc POST]', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to save nursing doc' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.nursing.view' },
);
