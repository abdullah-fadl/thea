import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { writeErAuditLog } from '@/lib/er/audit';
import { validateDisposition } from '@/lib/er/disposition';
import { v4 as uuidv4 } from 'uuid';
import { assertEncounterNotClosedByHandoff, ER_HANDOFF_CLOSED_ERROR } from '@/lib/er/handoff';
import { validateBody } from '@/lib/validation/helpers';
import { erEncounterDispositionSchema } from '@/lib/validation/er.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const routeParams = params || {};
  const encounterId = String((routeParams as Record<string, unknown>).encounterId || '');
  if (!encounterId) {
    return NextResponse.json({ error: 'Encounter ID is required' }, { status: 400 });
  }

  const disposition = await prisma.erDisposition.findFirst({ where: { tenantId, encounterId } });
  const validation = validateDisposition((disposition || undefined) as any);

  return NextResponse.json({ disposition: disposition || null, validation });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.encounter.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
  const routeParams = params || {};
  const encounterId = String((routeParams as Record<string, unknown>).encounterId || '');
  if (!encounterId) {
    return NextResponse.json({ error: 'Encounter ID is required' }, { status: 400 });
  }

  const encounter = await prisma.erEncounter.findFirst({ where: { tenantId, id: encounterId } });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  try {
    await assertEncounterNotClosedByHandoff({ tenantId, encounterId });
  } catch (err: unknown) {
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: (err as Record<string, unknown>)?.handoffId || null }, { status: 409 });
  }

  const body = await req.json();

  const v = validateBody(body, erEncounterDispositionSchema);
  if ('error' in v) return v.error;
  const { type } = v.data;

  const existing = await prisma.erDisposition.findFirst({ where: { tenantId, encounterId } });
  const now = new Date();

  // Allow draft saves; hard-stop is enforced in status transitions.
  const patch: any = {
    tenantId,
    encounterId,
    type,
    decidedBy: userId,
    decidedAt: now,
  };

  if (!existing) {
    patch.id = uuidv4();
  }

  // DISCHARGE
  if (type === 'DISCHARGE') {
    if ('finalDiagnosis' in body) {
      patch.finalDiagnosis = body.finalDiagnosis ?? null;
      patch.notes = body.finalDiagnosis ?? null;
    }
    if ('dischargeInstructions' in body) {
      patch.dischargeInstructions = body.dischargeInstructions ?? null;
      patch.destination = body.dischargeInstructions ?? null;
    }
  }

  // ADMIT
  if (type === 'ADMIT') {
    if ('admitService' in body) patch.destination = body.admitService ?? null;
    if ('reasonForAdmission' in body) {
      patch.reasonForAdmission = body.reasonForAdmission ?? null;
      patch.notes = body.reasonForAdmission ?? null;
    }
    if ('admitWardUnit' in body) patch.admitWardUnit = body.admitWardUnit ?? null;
    if ('handoffSbar' in body) patch.handoffSbar = body.handoffSbar ?? null;
  }

  // TRANSFER
  if (type === 'TRANSFER') {
    if ('destinationFacilityUnit' in body) patch.destination = body.destinationFacilityUnit ?? null;
    if ('reason' in body) patch.notes = body.reason ?? null;
    if ('transferType' in body) patch.transferType = body.transferType ?? null;
    if ('handoffSbar' in body) patch.handoffSbar = body.handoffSbar ?? null;
  }

  if (existing) {
    await prisma.erDisposition.update({
      where: { id: existing.id },
      data: patch,
    });
  } else {
    await prisma.erDisposition.create({ data: patch });
  }

  const saved = await prisma.erDisposition.findFirst({ where: { tenantId, encounterId } });
  const validation = validateDisposition((saved || undefined) as any);

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'disposition',
    entityId: String(saved?.id || patch.id || encounterId),
    action: existing ? 'UPDATE' : 'CREATE',
    before: (existing as Record<string, unknown> | null) || null,
    after: (saved as Record<string, unknown> | null) || patch,
    ip,
  });

  return NextResponse.json({ success: true, disposition: saved, validation });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.disposition.update' }
);
