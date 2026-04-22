import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { ErStaffAssignmentRole } from '@prisma/client';
import { writeErAuditLog } from '@/lib/er/audit';
import { assertEncounterNotClosedByHandoff, ER_HANDOFF_CLOSED_ERROR } from '@/lib/er/handoff';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { getFinalStatusBlock } from '@/lib/er/finalStatusGuard';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const doctorNoteBodySchema = z.object({
  encounterId: z.string().min(1, 'encounterId is required'),
  type: z.enum(['PROGRESS', 'ASSESSMENT_PLAN']),
  content: z.string().min(1, 'content is required'),
}).passthrough();

type DoctorNoteType = 'PROGRESS' | 'ASSESSMENT_PLAN';

function requiredString(value: any): string {
  return String(value || '').trim();
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }) => {

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, doctorNoteBodySchema);
  if ('error' in v) return v.error;

  const encounterId = requiredString(v.data.encounterId);
  const type = v.data.type as DoctorNoteType;
  const content = requiredString(v.data.content);

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId: encounterId });
  if (deathGuard) return deathGuard;

  const encounter = await prisma.erEncounter.findFirst({ where: { tenantId, id: encounterId } });
  if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  const finalBlock = getFinalStatusBlock(encounter.status as string, 'doctor.note');
  if (finalBlock) {
    return NextResponse.json(finalBlock.body, { status: finalBlock.status });
  }

  const assignment = await prisma.erStaffAssignment.findFirst({
    where: {
      encounterId,
      role: ErStaffAssignmentRole.PRIMARY_DOCTOR,
      unassignedAt: null,
      userId,
    },
  });
  const isDoctorOfRecord = Boolean(assignment) || String((encounter as Record<string, unknown>).seenByDoctorUserId || '') === userId;
  if (!isDoctorOfRecord) {
    return NextResponse.json({ error: 'Forbidden: not doctor-of-record for this encounter' }, { status: 403 });
  }
  try {
    await assertEncounterNotClosedByHandoff({ tenantId, encounterId });
  } catch (err: any) {
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: err?.handoffId || null }, { status: 409 });
  }

  const now = new Date();
  const note = await prisma.erDoctorNote.create({
    data: {
      encounterId,
      authorId: userId,
      noteType: type,
      freeText: content,
      createdAt: now,
    } as any,
  });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'doctor_note',
    entityId: note.id,
    action: 'CREATE',
    after: { id: note.id, encounterId, type, content, createdAt: now, createdByUserId: userId },
    ip,
  });

  return NextResponse.json({
    success: true,
    note: {
      id: note.id,
      encounterId,
      type,
      content,
      createdAt: now,
      createdByUserId: userId,
    },
  });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
