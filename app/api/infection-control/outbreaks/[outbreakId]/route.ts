import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_STATUSES = ['ACTIVE', 'CONTAINED', 'RESOLVED', 'MONITORING'];

/**
 * GET /api/infection-control/outbreaks/[outbreakId]
 * Get single outbreak detail
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolved = params instanceof Promise ? await params : params;
    const outbreakId = resolved?.outbreakId as string;

    if (!outbreakId) {
      return NextResponse.json({ error: 'outbreakId is required' }, { status: 400 });
    }

    const outbreak = await prisma.outbreakEvent.findFirst({
      where: { id: outbreakId, tenantId },
    });

    if (!outbreak) {
      return NextResponse.json({ error: 'Outbreak not found' }, { status: 404 });
    }

    return NextResponse.json({ outbreak });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'infection_control.view' }
);

/**
 * PATCH /api/infection-control/outbreaks/[outbreakId]
 * Update outbreak: add cases, control measures, update status, notify authorities
 */
export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
    const resolved = params instanceof Promise ? await params : params;
    const outbreakId = resolved?.outbreakId as string;

    if (!outbreakId) {
      return NextResponse.json({ error: 'outbreakId is required' }, { status: 400 });
    }

    const existing = await prisma.outbreakEvent.findFirst({
      where: { id: outbreakId, tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Outbreak not found' }, { status: 404 });
    }

    const body = await req.json();
    const updateData: any = {};

    // Status update
    if (body.status && VALID_STATUSES.includes(body.status)) {
      updateData.status = body.status;
      if (body.status === 'RESOLVED') {
        updateData.resolutionDate = new Date();
        updateData.resolutionNotes = body.resolutionNotes || null;
      }
    }

    // Add a new case
    if (body.newCase) {
      const existingCases = Array.isArray(existing.cases) ? existing.cases : [];
      const newCase = {
        patientId: body.newCase.patientId || null,
        patientName: body.newCase.patientName || '',
        mrn: body.newCase.mrn || '',
        onsetDate: body.newCase.onsetDate || new Date().toISOString().split('T')[0],
        cultureResult: body.newCase.cultureResult || '',
        status: body.newCase.status || 'ACTIVE',
        addedBy: (user as unknown as { name?: string })?.name || user?.email || userId,
        addedAt: new Date().toISOString(),
      };
      const updatedCases = [...existingCases, newCase];
      updateData.cases = updatedCases;
      updateData.totalCases = updatedCases.length;
      updateData.activeCases = updatedCases.filter((c: { status?: string }) => c.status === 'ACTIVE').length;
      updateData.recoveredCases = updatedCases.filter((c: { status?: string }) => c.status === 'RECOVERED').length;
    }

    // Add control measure
    if (body.newControlMeasure) {
      const existingMeasures = Array.isArray(existing.controlMeasures) ? existing.controlMeasures : [];
      updateData.controlMeasures = [
        ...existingMeasures,
        {
          measure: body.newControlMeasure.measure || '',
          implementedAt: new Date().toISOString(),
          responsiblePerson: body.newControlMeasure.responsiblePerson || (user as unknown as { name?: string })?.name || user?.email || '',
          status: body.newControlMeasure.status || 'IN_PROGRESS',
        },
      ];
    }

    // Authority notification
    if (body.notifyAuthority) {
      updateData.notifiedAuthorities = true;
      updateData.notifiedDate = new Date();
      updateData.notifiedTo = body.notifyAuthority.to || 'MOH';
    }

    // Environmental action
    if (body.newEnvironmentalAction) {
      const existingActions = Array.isArray(existing.environmentalActions) ? existing.environmentalActions : [];
      updateData.environmentalActions = [
        ...existingActions,
        {
          action: body.newEnvironmentalAction.action || '',
          date: new Date().toISOString(),
          area: body.newEnvironmentalAction.area || '',
          result: body.newEnvironmentalAction.result || '',
        },
      ];
    }

    // Staff communication
    if (body.newCommunication) {
      const existingComms = Array.isArray(existing.staffCommunication) ? existing.staffCommunication : [];
      updateData.staffCommunication = [
        ...existingComms,
        {
          date: new Date().toISOString(),
          method: body.newCommunication.method || 'Email',
          audience: body.newCommunication.audience || '',
          message: body.newCommunication.message || '',
        },
      ];
    }

    // General fields
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.sourceIdentified !== undefined) updateData.sourceIdentified = Boolean(body.sourceIdentified);
    if (body.sourceDescription) updateData.sourceDescription = body.sourceDescription;
    if (body.transmissionRoute) updateData.transmissionRoute = body.transmissionRoute;
    if (body.lessonsLearned) updateData.lessonsLearned = body.lessonsLearned;

    const updated = await prisma.outbreakEvent.update({
      where: { id: outbreakId },
      data: updateData,
    });

    logger.info('Outbreak event updated', {
      category: 'clinical',
      tenantId,
      userId,
      outbreakId,
    });

    return NextResponse.json({ success: true, outbreak: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'infection_control.manage' }
);
