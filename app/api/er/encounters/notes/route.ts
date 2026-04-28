import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { writeErAuditLog } from '@/lib/er/audit';
import { v4 as uuidv4 } from 'uuid';
import { assertEncounterNotClosedByHandoff, ER_HANDOFF_CLOSED_ERROR } from '@/lib/er/handoff';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { isHardeningLimitsEnabled, readJsonBodyWithLimit } from '@/lib/core/http/limits';
import { getFinalStatusBlock } from '@/lib/er/finalStatusGuard';
import { validateBody } from '@/lib/validation/helpers';
import { erEncounterNoteSchema } from '@/lib/validation/er.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
  const bodyRes = isHardeningLimitsEnabled()
    ? await readJsonBodyWithLimit<any>(req)
    : ({ ok: true, data: await req.json() } as const);
  if (!bodyRes.ok) return (bodyRes as { response: NextResponse }).response;
  const body = bodyRes.data;

  const v = validateBody(body, erEncounterNoteSchema);
  if ('error' in v) return v.error;
  const { encounterId, content } = v.data;

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId: encounterId });
  if (deathGuard) return deathGuard;

  const encounter = await prisma.erEncounter.findFirst({ where: { tenantId, id: encounterId } });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  const finalBlock = getFinalStatusBlock(encounter.status, 'encounter.note');
  if (finalBlock) {
    return NextResponse.json(finalBlock.body, { status: finalBlock.status });
  }
  try {
    await assertEncounterNotClosedByHandoff({ tenantId, encounterId });
  } catch (err: any) {
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: err?.handoffId || null }, { status: 409 });
  }

  const existing = await prisma.erNote.findFirst({ where: { encounterId } });
  const now = new Date();

  const doc = {
    id: existing?.id || uuidv4(),
    tenantId,
    encounterId,
    content: content || '',
    authorId: userId,
    createdAt: existing?.createdAt || now,
  };

  if (existing) {
    await prisma.erNote.update({
      where: { id: existing.id },
      data: { content: doc.content, authorId: userId } as Record<string, unknown>,
    });
  } else {
    await prisma.erNote.create({ data: doc as any });
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'note',
    entityId: doc.id,
    action: existing ? 'UPDATE' : 'CREATE',
    before: (existing as Record<string, unknown>) || null,
    after: doc,
    ip,
  });

  return NextResponse.json({ success: true, note: doc });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.encounter.edit' }
);
