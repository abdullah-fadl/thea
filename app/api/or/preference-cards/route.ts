import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ────────────────────────────────────────────────────────────────────────────
 * GET — list preference cards with optional filters
 * ──────────────────────────────────────────────────────────────────────────── */

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = new URL(req.url);
    const surgeonId = searchParams.get('surgeonId') || undefined;
    const specialty = searchParams.get('specialty') || undefined;
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;

    const where: any = { tenantId };
    if (surgeonId) where.surgeonId = surgeonId;
    if (specialty) where.specialty = specialty;
    if (status) where.status = status;
    if (search) {
      where.procedureName = { contains: search, mode: 'insensitive' };
    }

    const cards = await (prisma as Record<string, any>).orPreferenceCard.findMany({
      where,
      orderBy: { lastUsedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ cards });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' }
);

/* ────────────────────────────────────────────────────────────────────────────
 * POST — create a new preference card
 * ──────────────────────────────────────────────────────────────────────────── */

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      surgeonId, surgeonName, procedureName, procedureCode, specialty,
      instruments, sutures, implants, equipment, medications,
      positioning, skinPrep, draping, specialRequests,
      estimatedDuration, roomPreference,
    } = body;

    if (!surgeonName || !procedureName || !instruments) {
      return NextResponse.json(
        { error: 'surgeonName, procedureName, and instruments are required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(instruments) || instruments.length === 0) {
      return NextResponse.json(
        { error: 'instruments must be a non-empty array' },
        { status: 400 }
      );
    }

    const card = await (prisma as Record<string, any>).orPreferenceCard.create({
      data: {
        tenantId,
        surgeonId: surgeonId || userId,
        surgeonName: String(surgeonName),
        procedureName: String(procedureName),
        procedureCode: procedureCode ? String(procedureCode) : null,
        specialty: specialty ? String(specialty) : null,
        instruments,
        sutures: sutures || [],
        implants: implants || [],
        equipment: equipment || [],
        medications: medications || [],
        positioning: positioning ? String(positioning) : null,
        skinPrep: skinPrep ? String(skinPrep) : null,
        draping: draping ? String(draping) : null,
        specialRequests: specialRequests ? String(specialRequests) : null,
        estimatedDuration: estimatedDuration ? Number(estimatedDuration) : null,
        roomPreference: roomPreference ? String(roomPreference) : null,
        status: 'ACTIVE',
        version: 1,
        lastUsedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, id: card.id, card }, { status: 201 });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.manage' }
);

/* ────────────────────────────────────────────────────────────────────────────
 * PUT — update an existing preference card
 * ──────────────────────────────────────────────────────────────────────────── */

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await (prisma as Record<string, any>).orPreferenceCard.findFirst({
      where: { id: String(id), tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Preference card not found' }, { status: 404 });
    }

    const updateData: any = {};

    /* Archiving */
    if (fields.status === 'ARCHIVED' || fields.status === 'ACTIVE') {
      updateData.status = fields.status;
    }

    /* Scalar fields */
    const scalars = [
      'surgeonName', 'procedureName', 'procedureCode', 'specialty',
      'positioning', 'skinPrep', 'draping', 'specialRequests', 'roomPreference',
    ] as const;
    for (const key of scalars) {
      if (fields[key] !== undefined) {
        updateData[key] = fields[key] ? String(fields[key]) : null;
      }
    }

    if (fields.estimatedDuration !== undefined) {
      updateData.estimatedDuration = fields.estimatedDuration ? Number(fields.estimatedDuration) : null;
    }

    /* JSON array fields */
    const jsonFields = ['instruments', 'sutures', 'implants', 'equipment', 'medications'] as const;
    let majorChange = false;
    for (const key of jsonFields) {
      if (fields[key] !== undefined) {
        updateData[key] = fields[key];
        if (key === 'instruments') majorChange = true;
      }
    }

    /* Auto-increment version on major changes (instruments change) */
    if (majorChange) {
      updateData.version = (existing.version || 1) + 1;
    }

    /* Mark last used */
    if (fields.markUsed) {
      updateData.lastUsedAt = new Date();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await (prisma as Record<string, any>).orPreferenceCard.update({
      where: { id: String(id) },
      data: updateData,
    });

    return NextResponse.json({ success: true, card: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.manage' }
);
