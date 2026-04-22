import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/obgyn/labor/[patientId]/admit
 * Admits a patient to the labor ward (creates labor_episode form).
 * Body: { gravida, para, edd, membranesStatus, presentationType, chiefComplaint, notes }
 *
 * POST /api/obgyn/labor/[patientId]/admit  (action: 'discharge' | 'transfer')
 * Discharges or transfers a patient.
 * Body: { episodeId, action: 'discharge'|'transfer', deliveryMode?, deliveryTime?, notes? }
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const patientId = String((params as Record<string, string>)?.patientId || '').trim();
    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;

    // ── Discharge / Transfer ──────────────────────────────────────────────
    if (action === 'discharge' || action === 'transfer') {
      const episodeId = String(body?.episodeId || '').trim();
      if (!episodeId) {
        return NextResponse.json({ error: 'episodeId required for discharge/transfer' }, { status: 400 });
      }

      const episode = await prisma.obgynForm.findFirst({
        where: { id: episodeId, tenantId, patientId, type: 'labor_episode' },
      });
      if (!episode) {
        return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
      }

      const newStatus = action === 'discharge' ? 'DELIVERED' : 'TRANSFERRED';
      const episodeDataRecord = episode.data as Record<string, unknown> | null;
      const updatedData = {
        ...episodeDataRecord,
        status: newStatus,
        closedAt: new Date().toISOString(),
        deliveryMode: body?.deliveryMode ?? episodeDataRecord?.deliveryMode,
        deliveryTime: body?.deliveryTime ?? null,
        closingNotes: body?.notes ?? '',
      };

      await prisma.obgynForm.update({
        where: { id: episodeId },
        data: { data: updatedData },
      });

      return NextResponse.json({ success: true, status: newStatus });
    }

    // ── Admit ────────────────────────────────────────────────────────────
    // Check if already admitted
    const existing = await prisma.obgynForm.findFirst({
      where: {
        tenantId,
        patientId,
        type: 'labor_episode',
        // We'll check data.status in JS
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing && (existing.data as Record<string, unknown> | null)?.status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'Patient already has an active labor episode' },
        { status: 409 }
      );
    }

    const episodeData = {
      status: 'ACTIVE',
      admittedAt: new Date().toISOString(),
      gravida: body?.gravida ?? '',
      para: body?.para ?? '',
      edd: body?.edd ?? '',
      membranesStatus: body?.membranesStatus ?? 'INTACT',
      presentationType: body?.presentationType ?? 'CEPHALIC',
      chiefComplaint: body?.chiefComplaint ?? '',
      notes: body?.notes ?? '',
    };

    const episode = await prisma.obgynForm.create({
      data: {
        tenantId,
        patientId,
        type: 'labor_episode',
        data: episodeData,
        createdBy: userId || null,
      },
    });

    return NextResponse.json({ success: true, episode });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'obgyn.forms.edit' }
);
