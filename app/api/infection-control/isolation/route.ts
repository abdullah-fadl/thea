import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Prisma delegate for models not yet in schema
const db = prisma as unknown as Record<string, {
  findMany: (args?: unknown) => Promise<any[]>;
  findFirst: (args?: unknown) => Promise<any | null>;
  create: (args?: unknown) => Promise<any>;
  update: (args?: unknown) => Promise<any>;
}>;

const ISOLATION_TYPES = ['CONTACT', 'DROPLET', 'AIRBORNE', 'PROTECTIVE', 'ENTERIC', 'COMBINED'];
const ISOLATION_REASONS = ['MRSA', 'VRE', 'C_DIFF', 'TB', 'COVID', 'CHICKENPOX', 'MEASLES', 'NEUTROPENIA', 'OTHER'];
const STATUSES = ['ACTIVE', 'DISCONTINUED', 'CLEARED'];

/**
 * GET /api/infection-control/isolation
 * List isolation precautions with filters: status, isolationType, patientMasterId
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const isolationType = url.searchParams.get('isolationType');
    const patientMasterId = url.searchParams.get('patientMasterId');
    const limit = Math.min(500, parseInt(url.searchParams.get('limit') || '200'));

    const where: any = { tenantId };
    if (status && STATUSES.includes(status)) where.status = status;
    if (isolationType && ISOLATION_TYPES.includes(isolationType)) where.isolationType = isolationType;
    if (patientMasterId) where.patientMasterId = patientMasterId;

    const items = await db.isolationPrecaution.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Compute summary counts
    type IsolationRow = { status: string; isolationType: string };
    const all = await db.isolationPrecaution.findMany({
      where: { tenantId },
      select: { status: true, isolationType: true },
      take: 500,
    }) as unknown as IsolationRow[];

    const summary = {
      total: all.length,
      active: all.filter((i) => i.status === 'ACTIVE').length,
      discontinued: all.filter((i) => i.status === 'DISCONTINUED').length,
      cleared: all.filter((i) => i.status === 'CLEARED').length,
      byType: {
        CONTACT: all.filter((i) => i.isolationType === 'CONTACT' && i.status === 'ACTIVE').length,
        DROPLET: all.filter((i) => i.isolationType === 'DROPLET' && i.status === 'ACTIVE').length,
        AIRBORNE: all.filter((i) => i.isolationType === 'AIRBORNE' && i.status === 'ACTIVE').length,
        PROTECTIVE: all.filter((i) => i.isolationType === 'PROTECTIVE' && i.status === 'ACTIVE').length,
        ENTERIC: all.filter((i) => i.isolationType === 'ENTERIC' && i.status === 'ACTIVE').length,
        COMBINED: all.filter((i) => i.isolationType === 'COMBINED' && i.status === 'ACTIVE').length,
      },
    };

    return NextResponse.json({ items, summary });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'infection_control.view' }
);

/**
 * POST /api/infection-control/isolation
 * Create new isolation precaution
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json();

    const {
      patientMasterId,
      isolationType,
      reason,
      organism,
      roomNumber,
      bedLabel,
      isNegativePressure,
      ppeGown,
      ppeGloves,
      ppeMaskSurgical,
      ppeMaskN95,
      ppePapr,
      ppeEyeProtection,
      ppeShoeCovers,
      notes,
      episodeId,
      encounterId,
    } = body;

    if (!patientMasterId) {
      return NextResponse.json({ error: 'patientMasterId is required' }, { status: 400 });
    }
    if (!isolationType || !ISOLATION_TYPES.includes(isolationType)) {
      return NextResponse.json(
        { error: `isolationType must be one of: ${ISOLATION_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const record = await db.isolationPrecaution.create({
      data: {
        tenantId,
        patientMasterId,
        episodeId: episodeId || null,
        encounterId: encounterId || null,
        isolationType,
        reason: reason && ISOLATION_REASONS.includes(reason) ? reason : reason || null,
        organism: organism || null,
        startedAt: new Date(),
        startedByUserId: userId,
        startedByName: user?.displayName || user?.email || null,
        roomNumber: roomNumber || null,
        bedLabel: bedLabel || null,
        isNegativePressure: Boolean(isNegativePressure),
        isAnteroom: false,
        ppeGown: Boolean(ppeGown),
        ppeGloves: Boolean(ppeGloves),
        ppeMaskSurgical: Boolean(ppeMaskSurgical),
        ppeMaskN95: Boolean(ppeMaskN95),
        ppePapr: Boolean(ppePapr),
        ppeEyeProtection: Boolean(ppeEyeProtection),
        ppeShoeCovers: Boolean(ppeShoeCovers),
        signagePosted: false,
        status: 'ACTIVE',
        notes: notes || null,
      },
    });

    logger.info('Isolation precaution created', {
      category: 'clinical',
      tenantId,
      userId,
      isolationType,
      patientMasterId,
    });

    return NextResponse.json({ success: true, id: record.id, record });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'infection_control.manage' }
);

/**
 * PATCH /api/infection-control/isolation
 * Update isolation precaution status (discontinue or clear)
 */
export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json();
    const { id, status, discontinuedReason, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await db.isolationPrecaution.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Isolation precaution not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (status && STATUSES.includes(status)) {
      updateData.status = status;
      if (status === 'DISCONTINUED' || status === 'CLEARED') {
        updateData.endedAt = new Date();
        updateData.endedByUserId = userId;
        updateData.endedByName = user?.displayName || user?.email || null;
      }
    }
    if (discontinuedReason) updateData.discontinuedReason = discontinuedReason;
    if (notes !== undefined) updateData.notes = notes;

    const updated = await db.isolationPrecaution.update({
      where: { id },
      data: updateData,
    });

    logger.info('Isolation precaution updated', {
      category: 'clinical',
      tenantId,
      userId,
      isolationId: id,
      newStatus: status,
    });

    return NextResponse.json({ success: true, record: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'infection_control.manage' }
);
