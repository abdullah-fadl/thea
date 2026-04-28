import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

import { createAuditLog } from '@/lib/utils/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { assertEncounterNotCompleted } from '@/lib/opd/guards';
import { validateBody } from '@/lib/validation/helpers';
import { opdDispositionSchema } from '@/lib/validation/opd.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {

  const encounterCoreId = String((params as Record<string, string>)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
  if (deathGuard) return deathGuard;

  // [G-01] Guard: block writes on completed/closed encounters
  const completedGuard = await assertEncounterNotCompleted(tenantId, encounterCoreId);
  if (completedGuard) return completedGuard;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, opdDispositionSchema);
  if ('error' in v) return v.error;
  const { type, note: noteRaw } = v.data;
  const note = noteRaw || '';

  const encounterCore = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounterCore) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  if (encounterCore.encounterType !== 'OPD') {
    return NextResponse.json({ error: 'Encounter is not OPD' }, { status: 409 });
  }
  if (encounterCore.status === 'CLOSED') {
    return NextResponse.json({ error: 'Encounter is closed' }, { status: 409 });
  }

  const opd = await prisma.opdEncounter.findUnique({
    where: { encounterCoreId },
  });
  if (!opd) {
    return NextResponse.json({ error: 'OPD encounter not found' }, { status: 404 });
  }

  // Optimistic locking
  if (body._version != null && opd.version != null) {
    if (Number(body._version) !== Number(opd.version)) {
      return NextResponse.json(
        {
          error: 'Record was updated by another user. Please reload the page.',
          errorAr: 'تم تحديث السجل من شخص آخر. الرجاء إعادة تحميل الصفحة.',
          code: 'VERSION_CONFLICT',
        },
        { status: 409 }
      );
    }
  }

  const updatedOpd = await prisma.opdEncounter.update({
    where: { encounterCoreId },
    data: {
      dispositionType: type as any,
      dispositionNote: note || null,
      version: { increment: 1 },
    },
  });

  await createAuditLog(
    'opd_encounter',
    String(opd.id || encounterCoreId),
    'OPD_DISPOSITION_SET',
    userId || 'system',
    user?.email,
    { before: opd, after: updatedOpd },
    tenantId
  );

  return NextResponse.json({ success: true, opd: updatedOpd });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.edit' }
);
