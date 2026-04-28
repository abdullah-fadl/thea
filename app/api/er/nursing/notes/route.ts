import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { writeErAuditLog } from '@/lib/er/audit';
import { v4 as uuidv4 } from 'uuid';
import { assertEncounterNotClosedByHandoff, ER_HANDOFF_CLOSED_ERROR } from '@/lib/er/handoff';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { getFinalStatusBlock } from '@/lib/er/finalStatusGuard';
import { validateBody } from '@/lib/validation/helpers';
import { erNursingNoteSchema } from '@/lib/validation/er.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type NoteType = 'SHIFT' | 'PROGRESS';

function isDevAccount(_email: string | null | undefined): boolean {
  return false; // backdoor removed
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, erNursingNoteSchema);
  if ('error' in v) return v.error;
  const { encounterId, type, content } = v.data;

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId: encounterId });
  if (deathGuard) return deathGuard;

  const encounter = await prisma.erEncounter.findFirst({ where: { tenantId, id: encounterId } });
  if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  const finalBlock = getFinalStatusBlock(encounter.status, 'nursing.note');
  if (finalBlock) {
    return NextResponse.json(finalBlock.body, { status: finalBlock.status });
  }

  const dev = false;
  if (!dev) {
    const assignment = await prisma.erStaffAssignment.findFirst({
      where: {
        encounterId,
        role: 'PRIMARY_NURSE',
        unassignedAt: null,
        userId,
      },
    });
    if (!assignment) {
      return NextResponse.json(
        { error: 'Forbidden: encounter is not assigned to you as Primary Nurse' },
        { status: 403 }
      );
    }
  }
  try {
    await assertEncounterNotClosedByHandoff({ tenantId, encounterId });
  } catch (err: any) {
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: err?.handoffId || null }, { status: 409 });
  }

  const now = new Date();
  const note = {
    id: uuidv4(),
    tenantId,
    encounterId,
    nurseId: userId,
    type: type,
    content,
    createdAt: now,
  };

  await prisma.erNursingNote.create({ data: note as any });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'nursing_note',
    entityId: note.id,
    action: 'CREATE',
    after: { encounterId, nurseId: userId, type, createdAt: now },
    ip,
  });

  return NextResponse.json({ success: true, note });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
