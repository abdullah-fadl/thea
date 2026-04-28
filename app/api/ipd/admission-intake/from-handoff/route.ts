import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { writeErAuditLog } from '@/lib/er/audit';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { validateBody } from '@/lib/validation/helpers';
import { admissionIntakeSchema } from '@/lib/validation/ipd.schema';

// ErAdmissionHandover stores extra clinical data as top-level fields
// that are not yet in the Prisma schema (stored as JSONB columns or dynamic).
import type { Prisma } from '@prisma/client';

interface HandoffExtras {
  finalStatus?: string;
  encounterId?: string;
  patient?: Prisma.InputJsonValue | null;
  reasonForAdmission?: string | null;
  doctorSummary?: string | null;
  nursingSummary?: string | null;
  pendingTasks?: Prisma.InputJsonValue[];
  pendingResults?: Prisma.InputJsonValue[];
  riskFlags?: Prisma.InputJsonValue;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }) => {

  if (!canAccessChargeConsole({ email: user?.email, tenantId, role: user?.role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, admissionIntakeSchema);
  if ('error' in v) return v.error;
  const { handoffId } = v.data;

  const handoff = await prisma.erAdmissionHandover.findFirst({
    where: { tenantId, id: handoffId },
  });
  if (!handoff) {
    return NextResponse.json({ error: 'Handoff not found' }, { status: 404 });
  }

  const h = handoff as typeof handoff & HandoffExtras;
  const finalStatus = String(h.finalStatus || '').toUpperCase();
  if (finalStatus !== 'ADMITTED' && finalStatus !== 'TRANSFERRED') {
    return NextResponse.json({ error: 'Only ADMITTED/TRANSFERRED handoffs can create an IPD episode' }, { status: 409 });
  }

  const existingIntake = await prisma.ipdAdmissionIntake.findFirst({
    where: { tenantId, handoffId },
  });
  if (existingIntake?.id && existingIntake.episodeId) {
    return NextResponse.json({
      success: true,
      noOp: true,
      intakeId: existingIntake.id,
      episodeId: existingIntake.episodeId,
    });
  }

  const now = new Date();

  const episode = await prisma.ipdEpisode.create({
    data: {
      tenantId,
      source: { type: 'ER_ADMISSION_HANDOFF', handoffId },
      encounterId: String(h.encounterId || ''),
      patient: h.patient || null,
      reasonForAdmission: h.reasonForAdmission || null,
      doctorSummary: h.doctorSummary || null,
      nursingSummary: h.nursingSummary || null,
      pendingTasks: Array.isArray(h.pendingTasks) ? h.pendingTasks : [],
      pendingResults: Array.isArray(h.pendingResults) ? h.pendingResults : [],
      riskFlags: h.riskFlags || {},
      createdAt: now,
      createdByUserId: userId,
      status: 'ACTIVE',
    },
  });

  let intake;
  try {
    intake = await prisma.ipdAdmissionIntake.create({
      data: {
        tenantId,
        handoffId,
        episodeId: episode.id,
        encounterId: String(h.encounterId || ''),
        createdAt: now,
        createdByUserId: userId,
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002') {
      const existing = await prisma.ipdAdmissionIntake.findFirst({
        where: { tenantId, handoffId },
      });
      if (existing?.id && existing.episodeId) {
        return NextResponse.json({
          success: true,
          noOp: true,
          intakeId: existing.id,
          episodeId: existing.episodeId,
        });
      }
      return NextResponse.json({ error: 'Duplicate intake detected' }, { status: 409 });
    }
    throw err;
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'ipd_episode',
    entityId: episode.id,
    action: 'CREATE',
    after: episode,
    ip,
  });
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'ipd_admission_intake',
    entityId: intake.id,
    action: 'CREATE',
    after: intake,
    ip,
  });

  return NextResponse.json({
    success: true,
    intakeId: intake.id,
    episodeId: episode.id,
  });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
